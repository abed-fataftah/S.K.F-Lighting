"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import {
  categoryIdSchema,
  createCategorySchema,
  moveCategorySchema,
  updateCategorySchema,
} from "../schemas";
import {
  createCategoryInDb,
  deleteCategoryInDb,
  moveCategoryInDb,
  updateCategoryInDb,
} from "./categories";

// The categories page's actions (spec 0008, API surface). Each runs `requireAdmin()` first, which
// checks the session with Supabase Auth (`getVerifiedUser()`), before anything is read or written.
// The dialog sends `FormData`, parsed with the same schema the browser uses. Each write refreshes
// `/admin/categories`; the storefront renders on every request, so it needs no refresh. Logs carry
// the category id only.

const log = (event: string, fields: Readonly<Record<string, unknown>>) =>
  console.info(JSON.stringify({ event, ...fields }));

const logError = (event: string, error: unknown) =>
  console.error(JSON.stringify({ event, error: error instanceof Error ? error.name : "unknown" }));

const refresh = () => revalidatePath(routes.admin.categories);

export type CategoryFormError =
  "forbidden" | "invalid" | "name_taken" | "too_deep" | "not_found" | "failed";

export type CategoryFormResult =
  Ok<{ readonly id: string }> | Fail<CategoryFormError, { readonly fieldErrors?: FieldErrors }>;

const nameTaken: CategoryFormResult = {
  ok: false,
  error: "name_taken",
  fieldErrors: { name: { code: "name_taken" } },
};

const invalid = (fieldErrors: FieldErrors): CategoryFormResult => ({
  ok: false,
  error: "invalid",
  fieldErrors,
});

/** Add a main, or a sub under `parentId` (AC-2). */
export async function createCategory(form: FormData): Promise<CategoryFormResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = createCategorySchema.safeParse(formValues(form));
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));

  let outcome: Awaited<ReturnType<typeof createCategoryInDb>>;
  try {
    outcome = await createCategoryInDb(await getDb(), parsed.data);
  } catch (error) {
    logError("category_create_failed", error);
    return fail("failed");
  }
  if (outcome.kind === "name_taken") return nameTaken;
  if (outcome.kind !== "created") return fail(outcome.kind);
  log("category_created", { categoryId: outcome.id });
  refresh();
  return ok({ id: outcome.id });
}

/** Edit the name, description, and visibility (AC-3). */
export async function updateCategory(form: FormData): Promise<CategoryFormResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = updateCategorySchema.safeParse(formValues(form));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    return fieldErrors.id ? fail("not_found") : invalid(fieldErrors);
  }

  let outcome: Awaited<ReturnType<typeof updateCategoryInDb>>;
  try {
    outcome = await updateCategoryInDb(await getDb(), parsed.data);
  } catch (error) {
    logError("category_update_failed", error);
    return fail("failed");
  }
  if (outcome.kind !== "updated")
    return outcome.kind === "name_taken" ? nameTaken : fail("not_found");
  log("category_updated", { categoryId: outcome.id, visible: parsed.data.isVisible });
  refresh();
  return ok({ id: outcome.id });
}

export type MoveCategoryResult =
  Ok<{ readonly id: string }> | Fail<"forbidden" | "not_found" | "at_edge" | "failed">;

/** ↑ or ↓ among siblings (AC-4). `at_edge` changes nothing; the page refreshes its order. */
export async function moveCategory(input: {
  readonly id: string;
  readonly direction: "up" | "down";
}): Promise<MoveCategoryResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = moveCategorySchema.safeParse(input);
  if (!parsed.success) return fail("not_found");

  let outcome: Awaited<ReturnType<typeof moveCategoryInDb>>;
  try {
    outcome = await moveCategoryInDb(await getDb(), parsed.data.id, parsed.data.direction);
  } catch (error) {
    logError("category_move_failed", error);
    return fail("failed");
  }
  if (outcome.kind !== "moved") return fail(outcome.kind);
  refresh();
  return ok({ id: outcome.id });
}

export type DeleteCategoryResult =
  Ok<{ readonly id: string }> | Fail<"forbidden" | "not_found" | "not_empty" | "failed">;

/** Deletes an empty category (AC-5). */
export async function deleteCategory(input: {
  readonly id: string;
}): Promise<DeleteCategoryResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return fail("forbidden");
  const parsed = categoryIdSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");

  let outcome: Awaited<ReturnType<typeof deleteCategoryInDb>>;
  try {
    outcome = await deleteCategoryInDb(await getDb(), parsed.data.id);
  } catch (error) {
    logError("category_delete_failed", error);
    return fail("failed");
  }
  if (outcome.kind !== "deleted") return fail(outcome.kind);
  log("category_deleted", { categoryId: outcome.id });
  refresh();
  return ok({ id: outcome.id });
}
