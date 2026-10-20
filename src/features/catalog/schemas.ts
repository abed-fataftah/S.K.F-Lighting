// The four field product form of slice 1 (spec 0004 AC-2), shared by the form and `createProduct`.
// Feature 7 replaces it with the full editor.
import { z } from "zod";
import { parseShekels } from "@/lib/money";
import { arabicText, digitsField } from "@/lib/text-schemas";

export const PRODUCT_CODE = /^[A-Z0-9][A-Z0-9-]{0,29}$/;

export const productCodeField = digitsField(
  (clean) => clean.toUpperCase(),
  z.string().min(1, "required").regex(PRODUCT_CODE, "code_invalid"),
);

/** Shekels as typed (`١٬٢٥٠`, `19.9`) to integer agorot. */
export const priceField = digitsField(
  (clean) => (clean ? parseShekels(clean) : undefined),
  z.number({ error: (issue) => (issue.input === undefined ? "required" : "price_invalid") }),
);

const optionalId = z
  .string()
  .optional()
  .transform((value) => value || undefined)
  .pipe(z.guid({ error: "category_required" }).optional());

export const productFormSchema = z
  .object({
    name: arabicText({ min: 2, max: 120 }),
    code: productCodeField,
    categoryId: optionalId,
    newCategoryName: arabicText({ optional: true, min: 2, max: 60 }),
    price: priceField,
  })
  .refine((form) => form.categoryId || form.newCategoryName, {
    path: ["categoryId"],
    message: "category_required",
    // Shown beside other field errors too, as long as the two category fields themselves parsed.
    when: ({ issues }) =>
      issues.every((issue) => !["categoryId", "newCategoryName"].includes(String(issue.path?.[0]))),
  });

export type ProductFormInput = z.output<typeof productFormSchema>;

export const productFieldOrder = [
  "name",
  "code",
  "categoryId",
  "newCategoryName",
  "price",
] as const;
