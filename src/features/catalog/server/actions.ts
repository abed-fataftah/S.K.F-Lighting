"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import type { Fail, Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { requireAdmin } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { productFormSchema } from "../schemas";
import { createProductInDb } from "./create-product";

export type ProductFormError = "forbidden" | "invalid" | "save_failed";

export type CreatedProduct = {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
};

/** Null before the first submit. */
export type ProductFormState =
  Ok<CreatedProduct> | Fail<ProductFormError, { readonly fieldErrors?: FieldErrors }> | null;

const invalid = (fieldErrors: FieldErrors): ProductFormState => ({
  ok: false,
  error: "invalid",
  fieldErrors,
});

/** The four field product form of slice 1 (spec 0004 AC-2). Admin only: checked before anything. */
export async function createProduct(
  _previous: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const admin = await requireAdmin();
  if (!admin.ok) return { ok: false, error: "forbidden" };

  const parsed = productFormSchema.safeParse(formValues(form));
  if (!parsed.success) return invalid(fieldErrorsOf(parsed.error));

  let outcome: Awaited<ReturnType<typeof createProductInDb>>;
  try {
    outcome = await createProductInDb(await getDb(), parsed.data);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "product_create_failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
    return { ok: false, error: "save_failed" };
  }

  switch (outcome.kind) {
    case "code_taken":
      return invalid({ code: { code: "code_taken" } });
    case "category_missing":
      return invalid({ categoryId: { code: "category_required" } });
    case "slug_taken":
      return { ok: false, error: "save_failed" };
    case "created":
      console.info(JSON.stringify({ event: "product_created", code: parsed.data.code }));
      // A new category shows in the select when the owner adds another product.
      revalidatePath(routes.admin.productNew);
      return {
        ok: true,
        data: { productId: outcome.productId, slug: outcome.slug, name: parsed.data.name },
      };
  }
}
