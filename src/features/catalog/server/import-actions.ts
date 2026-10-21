"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { listProductFolder, removeKeys } from "@/server/storage/admin";
import { IMPORT_LIMITS, isProductCode } from "../import-schemas";
import type { ImportContext } from "../import-plan";
import {
  MEDIA_LIMITS,
  isKeyForProduct,
  leftoverKeys,
  parseMediaKey,
  productFolder,
  storedObjectFits,
  type StoredObject,
} from "../media-rules";
import { readEditorLookups, readProductsByCodes, type EditorLookups } from "./admin-queries";
import { importProductInDb, type ImportOutcome } from "./import-products";
import { setProductPhotosInDb } from "./product-photos";

// The spreadsheet import's actions (spec 0007, API surface). Each one checks `requireAdmin()` before
// it reads or writes anything, and never trusts the page's checks: every product is checked again
// and rebuilt here. Logs carry codes, ids, and counts, never file names or cell text.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const logError = (event: string, error: unknown, fields: Readonly<Record<string, unknown>>) =>
  console.error(
    JSON.stringify({ event, error: error instanceof Error ? error.name : "unknown", ...fields }),
  );

/** The categories and colours, for the template's lists sheet and the review. */
export async function getImportLookups(): Promise<Ok<EditorLookups> | Fail<"forbidden">> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  return ok(await readEditorLookups(await getDb()));
}

const contextSchema = z.object({
  codes: z
    .array(z.string().refine(isProductCode))
    .max(IMPORT_LIMITS.maxContextCodes)
    .refine((codes) => new Set(codes).size === codes.length),
});

/** Which of these codes are products already (any status), plus the lookups (AC-9, AC-14). */
export async function readImportContext(
  input: unknown,
): Promise<Ok<ImportContext> | Fail<"forbidden" | "invalid">> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = contextSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const db = await getDb();
  const [found, lookups] = await Promise.all([
    readProductsByCodes(db, parsed.data.codes),
    readEditorLookups(db),
  ]);
  return ok({ products: found, lookups });
}

const batchSchema = z.object({
  products: z.array(z.unknown()).min(1).max(IMPORT_LIMITS.batchSize),
});

export type ImportProductsResult =
  Ok<{ readonly results: readonly ImportOutcome[] }> | Fail<"forbidden" | "invalid">;

/** Up to 25 products, each saved in its own transaction; one product's refusal never stops the rest. */
export async function importProducts(input: unknown): Promise<ImportProductsResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  const db = await getDb();
  const results: ImportOutcome[] = [];
  for (const product of parsed.data.products) {
    try {
      results.push(await importProductInDb(db, product));
    } catch (error) {
      const code = (product as { code?: unknown } | null)?.code;
      logError("product_import_failed", error, { code: typeof code === "string" ? code : null });
      results.push({
        code: typeof code === "string" ? code : "",
        outcome: "skipped",
        problem: "save_failed",
      });
    }
  }

  log("products_imported", {
    created: results.filter((result) => result.outcome === "created").length,
    updated: results.filter((result) => result.outcome === "updated").length,
    skipped: results.filter((result) => result.outcome === "skipped").length,
  });
  revalidatePath(routes.admin.products);
  return ok({ results });
}

const photosSchema = z.object({
  productId: z.guid().transform((id) => id.toLowerCase()),
  images: z
    .array(
      z.object({
        storageKey: z.string().max(200),
        width: z.number().int().min(1).max(MEDIA_LIMITS.maxEdge),
        height: z.number().int().min(1).max(MEDIA_LIMITS.maxEdge),
      }),
    )
    .min(1)
    .max(MEDIA_LIMITS.maxImages),
});

export type SetProductPhotosResult =
  | Ok<{ readonly version: number }>
  | Fail<"forbidden" | "invalid" | "media_invalid" | "not_found" | "archived" | "save_failed">;

/**
 * The imported photos become the product's whole photo set (AC-13): only image keys under its
 * own folder, each once and present in Storage with a type and size that fit (AC-16).
 */
export async function setProductPhotos(input: unknown): Promise<SetProductPhotosResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = photosSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { productId, images } = parsed.data;

  const keys = images.map((image) => image.storageKey);
  const wellFormed = keys.every(
    (key) => isKeyForProduct(key, productId) && parseMediaKey(key)?.kind === "image",
  );
  if (!wellFormed || new Set(keys).size !== keys.length) return fail("media_invalid");

  let folder: readonly StoredObject[];
  try {
    folder = await listProductFolder(productId);
  } catch (error) {
    logError("product_media_list_failed", error, { productId });
    return fail("save_failed");
  }
  const byKey = new Map(
    folder.map((object) => [`${productFolder(productId)}${object.name}`, object]),
  );
  if (!keys.every((key) => storedObjectFits(key, byKey.get(key)))) {
    log("product_media_invalid", { productId });
    return fail("media_invalid");
  }

  let outcome: Awaited<ReturnType<typeof setProductPhotosInDb>>;
  try {
    outcome = await setProductPhotosInDb(await getDb(), productId, images);
  } catch (error) {
    logError("product_photos_failed", error, { productId });
    return fail("save_failed");
  }
  if (outcome.kind !== "saved") return fail(outcome.kind);

  log("product_photos_imported", { productId, photos: images.length, version: outcome.version });
  // Best effort (spec 0006 AC-15): the replaced files go once they are old enough; the sweep catches up.
  const kept = new Set(outcome.keptKeys);
  after(async () => {
    const leftovers = leftoverKeys(folder, kept, productId, new Date());
    if (!leftovers.length) return;
    try {
      await removeKeys(leftovers);
    } catch (error) {
      logError("product_media_cleanup_failed", error, { productId });
    }
  });
  return ok({ version: outcome.version });
}
