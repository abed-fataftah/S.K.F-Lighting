"use server";

import { after } from "next/server";
import { z } from "zod";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import {
  createSignedUpload,
  listProductFolder,
  removeKeys,
  removeProductFolder,
} from "@/server/storage/admin";
import {
  MEDIA_TYPES,
  isMediaContentType,
  leftoverKeys,
  maxBytesFor,
  mediaKey,
  productFolder,
  storedObjectFits,
  type StoredObject,
} from "../media-rules";
import { productEditorSchema, type ProductEditorData } from "../schemas";
import { deleteProductInDb, restoreProductInDb } from "./product-lifecycle";
import { saveProductInDb } from "./save-product";

// The product editor's actions (spec 0006, API surface). Each one checks `requireAdmin()` before
// it reads or writes anything. Logs carry the product id and code, never a typed file name.
// No `revalidatePath`: every dashboard page renders on each request (spec 0001), and a revalidate
// here would re-render the open page, giving `/admin/products/new` a fresh id under the editor.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const logError = (event: string, error: unknown, fields: Readonly<Record<string, unknown>>) =>
  console.error(
    JSON.stringify({ event, error: error instanceof Error ? error.name : "unknown", ...fields }),
  );

export type SaveProductError =
  | "forbidden"
  | "invalid"
  | "code_taken"
  | "category_required"
  | "stale"
  | "not_found"
  | "archived"
  | "media_invalid"
  | "save_failed";

export type SavedProduct = {
  readonly id: string;
  readonly slug: string;
  readonly version: number;
  readonly visible: boolean;
  readonly mainCategoryId: string;
  readonly subCategoryId: string | null;
};

export type SaveProductResult =
  Ok<SavedProduct> | Fail<SaveProductError, { readonly fieldErrors?: FieldErrors }>;

const withFields = (error: SaveProductError, fieldErrors: FieldErrors): SaveProductResult => ({
  ok: false,
  error,
  fieldErrors,
});

const keyOf = (productId: string, object: StoredObject) =>
  `${productFolder(productId)}${object.name}`;

/** Every media key is in the product's folder with a real type and size that fit (AC-16). */
function mediaFits(data: ProductEditorData, folder: readonly StoredObject[]): boolean {
  const byKey = new Map(folder.map((object) => [keyOf(data.id, object), object]));
  return data.media.every((item) => storedObjectFits(item.storageKey, byKey.get(item.storageKey)));
}

/** Creates or updates a whole product in one transaction (spec 0006, `saveProduct` order of work). */
export async function saveProduct(input: unknown): Promise<SaveProductResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");

  const parsed = productEditorSchema.safeParse(input);
  if (!parsed.success) return withFields("invalid", fieldErrorsOf(parsed.error));
  const data = parsed.data;

  // One listing of the folder: it proves the media and, after the save, finds the leftovers.
  let folder: readonly StoredObject[] | null = null;
  try {
    folder = await listProductFolder(data.id);
  } catch (error) {
    logError("product_media_list_failed", error, { productId: data.id, code: data.code });
    if (data.media.length) return fail("save_failed");
  }
  if (data.media.length && (!folder || !mediaFits(data, folder))) {
    log("product_media_invalid", { productId: data.id, code: data.code });
    return fail("media_invalid");
  }

  let outcome: Awaited<ReturnType<typeof saveProductInDb>>;
  try {
    outcome = await saveProductInDb(await getDb(), data);
  } catch (error) {
    logError("product_save_failed", error, { productId: data.id, code: data.code });
    return fail("save_failed");
  }

  switch (outcome.kind) {
    case "code_taken":
      return withFields("code_taken", { code: { code: "code_taken" } });
    case "code_changed":
      return withFields("invalid", { code: { code: "invalid" } });
    case "category_required":
      return withFields("category_required", { categoryId: { code: "category_required" } });
    case "colour_invalid":
      return withFields("invalid", {
        [`colours.${outcome.index}.newName`]: {
          code: outcome.reason === "duplicate" ? "duplicate" : "invalid",
        },
      });
    case "stale":
    case "not_found":
    case "archived":
      return fail(outcome.kind);
    case "saved": {
      log(data.version === null ? "product_created" : "product_saved", {
        productId: data.id,
        code: data.code,
        version: outcome.version,
      });
      const listed = folder;
      if (listed) {
        // Best effort (AC-15): a failure is logged and the weekly sweep catches up.
        const kept = new Set(data.media.map((item) => item.storageKey));
        after(async () => {
          const keys = leftoverKeys(listed, kept, data.id, new Date());
          if (!keys.length) return;
          try {
            await removeKeys(keys);
          } catch (error) {
            logError("product_media_cleanup_failed", error, { productId: data.id });
          }
        });
      }
      return ok({
        id: outcome.id,
        slug: outcome.slug,
        version: outcome.version,
        visible: outcome.status === "active",
        mainCategoryId: outcome.category.mainId,
        subCategoryId: outcome.category.subId,
      });
    }
  }
}

const uploadSchema = z.object({
  productId: z.guid().transform((id) => id.toLowerCase()),
  kind: z.enum(["image", "video"]),
  contentType: z.string(),
  size: z.number().int().min(1),
});

export type MediaUploadResult =
  | Ok<{ readonly storageKey: string; readonly token: string; readonly signedUrl: string }>
  | Fail<"forbidden" | "invalid_type" | "too_large">;

/**
 * A signed upload for one new file of a product (any uuid: a new product has no row yet). Only the
 * server chooses the key, and only for an allowed type and a declared size within its limit.
 */
export async function createMediaUpload(input: unknown): Promise<MediaUploadResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");

  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success || !isMediaContentType(parsed.data.contentType)) return fail("invalid_type");
  const { productId, kind, contentType, size } = parsed.data;
  const type = MEDIA_TYPES[contentType];
  if (type.kind !== kind) return fail("invalid_type");
  if (size > maxBytesFor(kind)) return fail("too_large");

  const storageKey = mediaKey(productId, crypto.randomUUID(), type.ext);
  const upload = await createSignedUpload(storageKey);
  return ok({ storageKey, ...upload });
}

const versionedSchema = z.object({
  id: z.guid().transform((id) => id.toLowerCase()),
  version: z.number().int().min(1),
});

export type DeleteProductResult =
  | Ok<{ readonly outcome: "deleted" } | { readonly outcome: "archived"; readonly version: number }>
  | Fail<"forbidden" | "stale" | "not_found" | "archived" | "save_failed">;

/** Deletes a product nothing ordered (and its folder, after commit), else archives it (AC-12). */
export async function deleteProduct(input: unknown): Promise<DeleteProductResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = versionedSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");
  const { id, version } = parsed.data;

  let outcome: Awaited<ReturnType<typeof deleteProductInDb>>;
  try {
    outcome = await deleteProductInDb(await getDb(), id, version);
  } catch (error) {
    logError("product_delete_failed", error, { productId: id });
    return fail("save_failed");
  }

  switch (outcome.kind) {
    case "stale":
    case "not_found":
      return fail(outcome.kind);
    case "already_archived":
      return fail("archived");
    case "archived":
      log("product_archived", { productId: id });
      return ok({ outcome: "archived", version: outcome.version });
    case "deleted":
      log("product_deleted", { productId: id });
      after(async () => {
        try {
          await removeProductFolder(id);
        } catch (error) {
          logError("product_folder_remove_failed", error, { productId: id });
        }
      });
      return ok({ outcome: "deleted" });
  }
}

export type RestoreProductResult =
  | Ok<{ readonly version: number }>
  | Fail<"forbidden" | "stale" | "not_found" | "not_archived" | "save_failed">;

/** An archived product comes back hidden (AC-12). */
export async function restoreProduct(input: unknown): Promise<RestoreProductResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = versionedSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");
  const { id, version } = parsed.data;

  try {
    const outcome = await restoreProductInDb(await getDb(), id, version);
    if (outcome.kind !== "restored") return fail(outcome.kind);
    log("product_restored", { productId: id });
    return ok({ version: outcome.version });
  } catch (error) {
    logError("product_restore_failed", error, { productId: id });
    return fail("save_failed");
  }
}
