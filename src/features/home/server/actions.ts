"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  homeImageKey,
  isMediaContentType,
  MEDIA_LIMITS,
  MEDIA_TYPES,
} from "@/features/catalog/media-rules";
import { tidyText } from "@/lib/arabic";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { banners } from "@/server/db/schema";
import { createSignedUpload, removeKeys } from "@/server/storage/admin";
import {
  deleteBannerSchema,
  homeSearchSchema,
  homeUploadSchema,
  saveBannerSchema,
  saveHomepageSchema,
} from "../schemas";
import {
  deleteBannerInDb,
  saveBannerInDb,
  saveHomepageInDb,
  searchHomeProductsInDb,
  type EditorBanner,
  type PickerProduct,
} from "./homepage-db";
import { storedImageFits } from "./media-check";

// The homepage editor's actions (spec 0011, API surface). Each runs `requireAdmin()` first, which
// checks the session with Supabase Auth (`getVerifiedUser()`), before anything is read or written.
// Writes refresh Home and the editor. Logs carry ids only, never typed text.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const logError = (event: string, error: unknown, fields: Readonly<Record<string, unknown>> = {}) =>
  console.error(
    JSON.stringify({ event, error: error instanceof Error ? error.name : "unknown", ...fields }),
  );

const refresh = () => {
  revalidatePath(routes.home);
  revalidatePath(routes.admin.homepage);
};

/** After commit, best effort (AC-13): a failed removal is logged and left to the weekly sweep. */
const removeAfter = (keys: readonly string[], event: string) => {
  if (!keys.length) return;
  after(async () => {
    try {
      await removeKeys(keys);
    } catch (error) {
      logError(event, error);
    }
  });
};

export type SearchHomeProductsResult = Ok<readonly PickerProduct[]> | Fail<"forbidden" | "invalid">;

/** The product picker (AC-12). */
export async function searchHomeProducts(input: unknown): Promise<SearchHomeProductsResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = homeSearchSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const q = tidyText(parsed.data.q);
  if (!q) return ok([]);
  return ok(await searchHomeProductsInDb(await getDb(), q, parsed.data.exclude));
}

export type HomeImageUploadResult =
  | Ok<{ readonly storageKey: string; readonly token: string; readonly signedUrl: string }>
  | Fail<"forbidden" | "invalid_type" | "too_large">;

/** A signed upload for one banner or circle photo; only the server chooses the key (AC-13). */
export async function createHomeImageUpload(input: unknown): Promise<HomeImageUploadResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = homeUploadSchema.safeParse(input);
  if (!parsed.success || !isMediaContentType(parsed.data.contentType)) return fail("invalid_type");
  const type = MEDIA_TYPES[parsed.data.contentType];
  if (type.kind !== "image") return fail("invalid_type");
  if (parsed.data.size > MEDIA_LIMITS.imageMaxBytes) return fail("too_large");

  const storageKey = homeImageKey(parsed.data.target, crypto.randomUUID(), type.ext);
  const upload = await createSignedUpload(storageKey);
  return ok({ storageKey, ...upload });
}

export type SaveBannerError =
  | "forbidden"
  | "invalid"
  | "stale"
  | "not_found"
  | "too_many_banners"
  | "media_invalid"
  | "link_not_found"
  | "failed";

export type SaveBannerResult =
  | Ok<{ readonly banner: EditorBanner; readonly version: number }>
  | Fail<SaveBannerError, { readonly fieldErrors?: FieldErrors }>;

/** Creates or edits one banner at once, from the dialog (AC-10). */
export async function saveBanner(input: unknown): Promise<SaveBannerResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = saveBannerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const data = parsed.data;
  const db = await getDb();

  // An edit that keeps its picture sends the stored key back; it is not checked again (AC-10).
  const [stored] = data.id
    ? await db.select({ imageKey: banners.imageKey }).from(banners).where(eq(banners.id, data.id))
    : [];
  if (data.id && !stored) return fail("not_found");
  if (stored?.imageKey !== data.imageKey && !(await storedImageFits(data.imageKey))) {
    log("banner_media_invalid", { bannerId: data.id ?? null });
    return fail("media_invalid");
  }

  let outcome: Awaited<ReturnType<typeof saveBannerInDb>>;
  try {
    outcome = await saveBannerInDb(db, data);
  } catch (error) {
    logError("banner_save_failed", error, { bannerId: data.id ?? null });
    return fail("failed");
  }
  if (outcome.kind !== "saved") return fail(outcome.kind);

  log(outcome.created ? "banner_created" : "banner_saved", {
    bannerId: outcome.banner.id,
    version: outcome.version,
  });
  removeAfter(outcome.replacedKey ? [outcome.replacedKey] : [], "banner_media_remove_failed");
  refresh();
  return ok({ banner: outcome.banner, version: outcome.version });
}

export type DeleteBannerResult =
  Ok<{ readonly version: number }> | Fail<"forbidden" | "stale" | "not_found" | "failed">;

/** Deletes one banner, then its picture after commit (AC-10, AC-13). */
export async function deleteBanner(input: unknown): Promise<DeleteBannerResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = deleteBannerSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");

  let outcome: Awaited<ReturnType<typeof deleteBannerInDb>>;
  try {
    outcome = await deleteBannerInDb(await getDb(), parsed.data);
  } catch (error) {
    logError("banner_delete_failed", error, { bannerId: parsed.data.id });
    return fail("failed");
  }
  if (outcome.kind !== "deleted") return fail(outcome.kind);
  log("banner_deleted", { bannerId: parsed.data.id, version: outcome.version });
  removeAfter([outcome.imageKey], "banner_media_remove_failed");
  refresh();
  return ok({ version: outcome.version });
}

export type SaveHomepageError =
  "forbidden" | "invalid" | "stale" | "too_many_active" | "too_many_featured" | "failed";

export type SaveHomepageResult =
  | Ok<{ readonly version: number }>
  | Fail<SaveHomepageError>
  | Fail<"product_unavailable", { readonly productIds: readonly string[] }>;

/** "حفظ التغييرات": banner order and ticks, the featured list, and the Home categories (AC-9). */
export async function saveHomepage(input: unknown): Promise<SaveHomepageResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = saveHomepageSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");

  let outcome: Awaited<ReturnType<typeof saveHomepageInDb>>;
  try {
    outcome = await saveHomepageInDb(await getDb(), parsed.data);
  } catch (error) {
    logError("homepage_save_failed", error);
    return fail("failed");
  }
  switch (outcome.kind) {
    case "saved":
      log("homepage_saved", { version: outcome.version });
      refresh();
      return ok({ version: outcome.version });
    case "product_unavailable":
      return { ok: false, error: "product_unavailable", productIds: outcome.productIds };
    default:
      return fail(outcome.kind);
  }
}
