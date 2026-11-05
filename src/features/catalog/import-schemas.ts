// The spreadsheet import (spec 0007): its limits, columns, problem codes, and the field rules that
// the browser's review and `importProducts` both run, so the two always give the same answer.
// Pure. Each field check answers with a problem code, never a Zod message, so a row problem and a
// server refusal read the same in the problems table.
import { z } from "zod";
import { tidyText, toWesternDigits } from "@/lib/arabic";
import { arabicText, tidiedText } from "@/lib/text-schemas";
import { MEDIA_LIMITS } from "./media-rules";
import {
  PRODUCT_CODE,
  PRODUCT_LIMITS,
  SUGGESTED_SPEC_LABELS,
  optionKey,
  priceField,
} from "./schemas";

export const IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxProducts: 500,
  maxRows: 5000,
  /** Products per `importProducts` call; the page sends one batch after another. */
  batchSize: 25,
  /** Distinct codes per `readImportContext` call: 500 sheet products plus 1,000 photos. */
  maxContextCodes: 1500,
  maxPhotoBytes: 30 * 1024 * 1024,
  maxPhotosPerRun: 1000,
  maxPhotosPerProduct: MEDIA_LIMITS.maxImages,
  uploadsAtOnce: 4,
} as const;

export const SHEET_EXTENSIONS = ["xlsx", "csv"] as const;
export const PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** The template's columns, in its order (AC-2). Only the first four must be in an uploaded sheet. */
export const IMPORT_COLUMNS = [
  { key: "code", header: "الكود", required: true },
  { key: "name", header: "الاسم", required: false },
  { key: "main", header: "القسم الرئيسي", required: false },
  { key: "sub", header: "القسم الفرعي", required: false },
  { key: "size", header: "الحجم", required: true },
  { key: "price", header: "السعر", required: true },
  { key: "colours", header: "الألوان", required: true },
  { key: "description", header: "الوصف", required: false },
  { key: "diameter", header: SUGGESTED_SPEC_LABELS[0], required: false },
  { key: "height", header: SUGGESTED_SPEC_LABELS[1], required: false },
  { key: "base", header: SUGGESTED_SPEC_LABELS[2], required: false },
  { key: "power", header: SUGGESTED_SPEC_LABELS[3], required: false },
  { key: "light", header: SUGGESTED_SPEC_LABELS[4], required: false },
  { key: "visible", header: "ظاهر", required: false },
  { key: "available", header: "متوفر", required: false },
] as const;

export type ColumnKey = (typeof IMPORT_COLUMNS)[number]["key"];

export const SPEC_COLUMNS = ["diameter", "height", "base", "power", "light"] as const;

/** Cells read from a product's first row only; a later row leaves them empty or repeats them (AC-4). */
export const PRODUCT_COLUMNS = [
  "name",
  "main",
  "sub",
  "colours",
  "description",
  ...SPEC_COLUMNS,
  "visible",
  "available",
] as const satisfies readonly ColumnKey[];

export const headerOf = (key: ColumnKey): string =>
  IMPORT_COLUMNS.find((column) => column.key === key)!.header;

export const YES = "نعم";
export const NO = "لا";

/** Problems that stop the whole file (AC-3), shown in the notice banner. */
export const FILE_ERRORS = [
  "file_type",
  "file_too_large",
  "file_unreadable",
  "missing_column",
  "duplicate_column",
  "csv_encoding",
  "too_many_rows",
] as const;
export type FileError = (typeof FILE_ERRORS)[number];

/** Problems listed in the table, one row each; each has a problem text and a fix text in ar.json. */
export const PROBLEM_CODES = [
  // A sheet row (AC-4 to AC-8, AC-11).
  "code_missing",
  "code_invalid",
  "conflicting_value",
  "price_invalid",
  "size_mixed",
  "size_invalid",
  "size_duplicate",
  "too_many_sizes",
  "colour_invalid",
  "colour_duplicate",
  "too_many_colours",
  "name_missing",
  "name_invalid",
  "category_missing",
  "category_invalid",
  "description_too_long",
  "description_invalid",
  "spec_too_long",
  "too_many_specs",
  "yes_no_invalid",
  "archived",
  "skipped",
  // Found while the import runs (AC-15).
  "code_taken",
  "changed_during_import",
  "save_failed",
  "invalid",
  // A photo (AC-12, AC-13).
  "photo_name_invalid",
  "photo_no_product",
  "photo_archived",
  "photo_product_skipped",
  "photo_duplicate_number",
  "photo_over_limit",
  "photo_too_large",
  "photo_run_limit",
  "photo_unreadable",
  "photo_upload_failed",
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export const isProblemCode = (value: unknown): value is ProblemCode =>
  typeof value === "string" && (PROBLEM_CODES as readonly string[]).includes(value);

/** A product code as the sheet and a photo name give it: Western digits, tidied, upper case (AC-4). */
export const normalizeCode = (text: string): string =>
  tidyText(toWesternDigits(text)).toUpperCase();

export const isProductCode = (code: string): boolean => PRODUCT_CODE.test(code);

// Field checks. Each takes the cell as text and answers with the clean value or a problem code.

export type Checked<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problem: ProblemCode };

const good = <T>(value: T): Checked<T> => ({ ok: true, value });
const bad = (problem: ProblemCode): Checked<never> => ({ ok: false, problem });

const nameText = arabicText({ min: 2, max: 120 });
const categoryText = arabicText({ min: 2, max: 60 });
const descriptionText = arabicText({ optional: true, max: 4000, multiline: true });
const specText = tidiedText({ max: 120 });
const optionText = tidiedText({ max: 40 });
const colourNameText = arabicText({ max: 40 });

const issueOf = (result: { readonly error?: z.ZodError }) => result.error?.issues[0]?.message;

export const checkName = (text: string): Checked<string> => {
  const parsed = nameText.safeParse(text);
  return parsed.success ? good(parsed.data) : bad("name_invalid");
};

export const checkCategoryName = (text: string): Checked<string> => {
  const parsed = categoryText.safeParse(text);
  return parsed.success ? good(parsed.data) : bad("category_invalid");
};

export const checkDescription = (text: string): Checked<string | undefined> => {
  const parsed = descriptionText.safeParse(text);
  if (parsed.success) return good(parsed.data);
  return bad(issueOf(parsed) === "too_long" ? "description_too_long" : "description_invalid");
};

export const checkSpecValue = (text: string): Checked<string> => {
  const parsed = specText.safeParse(text);
  return parsed.success ? good(parsed.data) : bad("spec_too_long");
};

/** Empty, نعم, or لا (AC-6); empty is `undefined`, so the stored or the default value applies. */
export const checkYesNo = (text: string): Checked<boolean | undefined> => {
  const clean = tidyText(text);
  if (clean === "") return good(undefined);
  if (clean === YES) return good(true);
  if (clean === NO) return good(false);
  return bad("yes_no_invalid");
};

/** Shekels as typed, to agorot: above 0, at most ₪1,000,000 (AC-5). */
export const checkPrice = (text: string): Checked<number> => {
  const parsed = priceField.safeParse(text);
  return parsed.success ? good(parsed.data) : bad("price_invalid");
};

export const checkSizeLabel = (text: string): Checked<string> => {
  const parsed = optionText.safeParse(text);
  return parsed.success ? good(parsed.data) : bad("size_invalid");
};

export const checkColourName = (text: string): Checked<string> => {
  const parsed = optionText.safeParse(text);
  return parsed.success ? good(parsed.data) : bad("colour_invalid");
};

/** A colour the shop does not list yet is created as in the editor, so its name needs Arabic. */
export const isNewColourNameValid = (name: string): boolean =>
  colourNameText.safeParse(name).success;

/** The الألوان cell split on `,` and `،`, each name tidied; empty pieces (a trailing comma) drop. */
export const splitColours = (text: string): readonly string[] =>
  text
    .split(/[,،]/)
    .map((name) => tidyText(name))
    .filter((name) => name !== "");

/** The index of each item whose key repeats an earlier one. */
export function repeatedIndexes(keys: readonly string[]): readonly number[] {
  const seen = new Set<string>();
  return keys.flatMap((key, index) => {
    if (seen.has(key)) return [index];
    seen.add(key);
    return [];
  });
}

// What the page sends `importProducts` for one product, and the schema the server checks it with
// again (AC-16). Cells stay text; the schema turns prices into agorot.

export type ImportProductInput = {
  readonly code: string;
  /** The product's spreadsheet rows (header = 1), first row first. */
  readonly rows: readonly number[];
  readonly name?: string;
  readonly mainCategory?: string;
  readonly subCategory?: string;
  readonly description?: string;
  readonly specs: readonly { readonly label: string; readonly value: string }[];
  readonly visible?: boolean;
  readonly available?: boolean;
  readonly sizes: readonly { readonly label: string; readonly price: string }[];
  readonly colours: readonly string[];
  /** The single price, only when there are no sizes. */
  readonly price?: string;
};

/** A text field whose check gives a problem code; the code becomes the issue message. */
const checkedField = <T>(check: (text: string) => Checked<T>) =>
  z.string().transform((text, ctx) => {
    const result = check(text);
    if (result.ok) return result.value;
    ctx.addIssue({ code: "custom", message: result.problem });
    return z.NEVER;
  });

const SPEC_LABELS: readonly string[] = SUGGESTED_SPEC_LABELS;

export const importProductSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCode)
      .refine(isProductCode, { message: "code_invalid" satisfies ProblemCode }),
    rows: z.array(z.number().int().min(2)).min(1).max(IMPORT_LIMITS.maxRows),
    name: checkedField(checkName).optional(),
    mainCategory: checkedField(checkCategoryName).optional(),
    subCategory: checkedField(checkCategoryName).optional(),
    description: checkedField(checkDescription).optional(),
    specs: z
      .array(
        z.object({
          label: z.string().refine((label) => SPEC_LABELS.includes(label), "invalid"),
          value: checkedField(checkSpecValue).refine((value) => value !== "", "invalid"),
        }),
      )
      .max(SPEC_LABELS.length),
    visible: z.boolean().optional(),
    available: z.boolean().optional(),
    sizes: z
      .array(z.object({ label: checkedField(checkSizeLabel), price: checkedField(checkPrice) }))
      .max(PRODUCT_LIMITS.maxSizes, "too_many_sizes" satisfies ProblemCode),
    colours: z
      .array(checkedField(checkColourName))
      .max(PRODUCT_LIMITS.maxColours, "too_many_colours" satisfies ProblemCode),
    price: checkedField(checkPrice).optional(),
  })
  .superRefine((product, ctx) => {
    const problem = (message: ProblemCode) => ctx.addIssue({ code: "custom", message });
    if (repeatedIndexes(product.specs.map((spec) => spec.label)).length) problem("invalid");
    if (repeatedIndexes(product.sizes.map((size) => optionKey(size.label))).length) {
      problem("size_duplicate");
    }
    if (repeatedIndexes(product.colours.map(optionKey)).length) problem("colour_duplicate");
    if (product.sizes.length === 0 ? product.price === undefined : product.price !== undefined) {
      problem(product.sizes.length === 0 ? "price_invalid" : "size_mixed");
    }
    if (product.sizes.length > 0 && product.rows.length !== product.sizes.length) {
      problem("size_mixed");
    }
  });

export type ImportProductData = z.output<typeof importProductSchema>;

/** The problem a failed parse names: its first issue's code when it is one, else `invalid`. */
export function problemOf(error: z.ZodError): ProblemCode {
  const message = error.issues[0]?.message;
  return isProblemCode(message) ? message : "invalid";
}
