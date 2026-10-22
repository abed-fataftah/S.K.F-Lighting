// The product editor (spec 0006): the one object the editor sends to `saveProduct`, checked by
// the same schema in the browser and on the server. Nested rows report errors by their full path
// (`sizes.1.label`), so the editor can put each message under its own row.
import { z } from "zod";
import { tidyText } from "@/lib/arabic";
import { parseShekels } from "@/lib/money";
import { arabicText, digitsField, tidiedText } from "@/lib/text-schemas";
import { MEDIA_LIMITS, isKeyForProduct, parseMediaKey } from "./media-rules";

export const PRODUCT_CODE = /^[A-Z0-9][A-Z0-9-]{0,29}$/;

export const PRODUCT_LIMITS = {
  maxSizes: 12,
  maxColours: 12,
  maxSpecs: 30,
  maxMedia: MEDIA_LIMITS.maxImages + MEDIA_LIMITS.maxVideos,
} as const;

/** The rows a new product opens with (AC-9); never added to a product that already exists. */
export const SUGGESTED_SPEC_LABELS = [
  "القطر (سم)",
  "الارتفاع (سم)",
  "نوع القاعدة",
  "القدرة",
  "لون الإضاءة",
] as const;

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
  .transform((value) => value?.trim().toLowerCase() || undefined)
  .pipe(z.guid({ error: "category_required" }).optional());

/** A required row label: empty after tidying says "required", not "too short". */
const filled = <S extends z.ZodType<unknown, string>>(schema: S) =>
  z
    .string()
    .refine((text) => tidyText(text) !== "", { message: "required" })
    .pipe(schema);

/** Size labels and colour names compare after tidying, ignoring case. */
export const optionKey = (text: string) => tidyText(text).toLowerCase();

const sizeRow = z.object({
  // The stored label, compared exactly with the rows; null for a size added in this edit.
  originalLabel: z
    .string()
    .max(200)
    .nullish()
    .transform((value) => value ?? null),
  label: filled(tidiedText({ max: 40 })),
  price: priceField,
});

const colourRow = z
  .object({
    colourId: z
      .string()
      .optional()
      .transform((value) => value?.toLowerCase() || undefined)
      .pipe(z.guid().optional()),
    newName: arabicText({ optional: true, max: 40 }).optional(),
  })
  .refine((row) => !!row.colourId !== !!row.newName, { message: "invalid", path: ["newName"] });

const specLabel = filled(arabicText({ max: 40 }));
const specValue = tidiedText({ max: 120 });

// A row with an empty value is dropped on save; a value with an empty label is a field error.
const specRow = z
  .object({ label: z.string(), value: z.string() })
  .superRefine((row, ctx) => {
    if (!tidyText(row.value)) return;
    for (const [field, schema] of [
      ["label", specLabel],
      ["value", specValue],
    ] as const) {
      const parsed = schema.safeParse(row[field]);
      if (parsed.success) continue;
      const [issue] = parsed.error.issues;
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: [field],
        params: issue.code === "custom" ? issue.params : undefined,
      });
    }
  })
  .transform((row) => {
    const value = specValue.safeParse(row.value);
    if (!value.success || !value.data) return null;
    return { label: specLabel.parse(row.label), value: value.data };
  });

const pairRow = z.object({
  size: z.number().int().min(0).nullable(),
  colour: z.number().int().min(0).nullable(),
  available: z.boolean(),
});

const mediaRow = z.object({
  storageKey: z.string().max(200),
  kind: z.enum(["image", "video"]),
  width: z.number().int().min(1).max(MEDIA_LIMITS.maxEdge).nullish(),
  height: z.number().int().min(1).max(MEDIA_LIMITS.maxEdge).nullish(),
});

/** True when none of these top level fields already failed, so a cross field rule can run. */
const fieldsParsed =
  (...fields: readonly string[]) =>
  ({ issues }: { readonly issues: readonly { readonly path?: readonly PropertyKey[] }[] }) =>
    issues.every((issue) => !fields.includes(String(issue.path?.[0])));

/** The index of each row whose key repeats an earlier row's. */
function repeats(keys: readonly (string | null)[]): readonly number[] {
  const seen = new Set<string>();
  return keys.flatMap((key, index) => {
    if (key === null) return [];
    if (seen.has(key)) return [index];
    seen.add(key);
    return [];
  });
}

/** Pairs are exactly every size with every colour, each once (AC-16). */
function pairsComplete(
  sizeCount: number,
  colourCount: number,
  pairs: readonly z.output<typeof pairRow>[],
): boolean {
  const sizes = sizeCount ? Array.from({ length: sizeCount }, (_, i) => i) : [null];
  const colours = colourCount ? Array.from({ length: colourCount }, (_, i) => i) : [null];
  const expected = sizeCount || colourCount ? sizes.length * colours.length : 0;
  if (pairs.length !== expected) return false;
  const wanted = new Set(sizes.flatMap((s) => colours.map((c) => `${s}:${c}`)));
  const given = new Set(pairs.map((pair) => `${pair.size}:${pair.colour}`));
  return given.size === expected && [...given].every((key) => wanted.has(key));
}

export const productEditorSchema = z
  .object({
    id: z.guid().transform((id) => id.toLowerCase()),
    // Null creates the product; otherwise the version the editor loaded (AC-11).
    version: z.number().int().min(1).nullable(),
    name: arabicText({ min: 2, max: 120 }),
    code: productCodeField,
    categoryId: optionalId,
    subCategoryId: optionalId,
    description: arabicText({ optional: true, max: 4000, multiline: true }),
    specs: z
      .array(specRow)
      .max(PRODUCT_LIMITS.maxSpecs)
      .transform((rows) => rows.filter((row) => row !== null)),
    visible: z.boolean(),
    available: z.boolean(),
    // The single price: read only when there are no sizes.
    price: z.string().max(40).optional(),
    sizes: z.array(sizeRow).max(PRODUCT_LIMITS.maxSizes),
    colours: z.array(colourRow).max(PRODUCT_LIMITS.maxColours),
    pairs: z.array(pairRow).max(PRODUCT_LIMITS.maxSizes * PRODUCT_LIMITS.maxColours),
    media: z.array(mediaRow).max(PRODUCT_LIMITS.maxMedia),
  })
  .superRefine(
    (form, ctx) => {
      // Categories are made on the categories page (spec 0008 AC-17); the editor only picks one.
      if (!form.categoryId) {
        ctx.addIssue({ code: "custom", message: "category_required", path: ["categoryId"] });
      }
    },
    { when: fieldsParsed("categoryId", "subCategoryId") },
  )
  .superRefine(
    (form, ctx) => {
      if (form.sizes.length > 0) return;
      const parsed = priceField.safeParse(form.price ?? "");
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", message: parsed.error.issues[0].message, path: ["price"] });
      }
    },
    { when: fieldsParsed("price", "sizes") },
  )
  .superRefine(
    (form, ctx) => {
      for (const index of repeats(form.sizes.map((size) => optionKey(size.label)))) {
        ctx.addIssue({ code: "custom", message: "duplicate", path: ["sizes", index, "label"] });
      }
    },
    { when: fieldsParsed("sizes") },
  )
  .superRefine(
    (form, ctx) => {
      const keys = form.colours.map((row) =>
        row.colourId ? `id:${row.colourId}` : row.newName ? `name:${optionKey(row.newName)}` : null,
      );
      for (const index of repeats(keys)) {
        ctx.addIssue({ code: "custom", message: "duplicate", path: ["colours", index, "newName"] });
      }
    },
    { when: fieldsParsed("colours") },
  )
  .superRefine(
    (form, ctx) => {
      if (!pairsComplete(form.sizes.length, form.colours.length, form.pairs)) {
        ctx.addIssue({ code: "custom", message: "invalid", path: ["pairs"] });
      }
    },
    { when: fieldsParsed("sizes", "colours", "pairs") },
  )
  .superRefine(
    (form, ctx) => {
      const images = form.media.filter((item) => item.kind === "image");
      const fits = form.media.every((item) => {
        const key = parseMediaKey(item.storageKey);
        const sized = item.width != null && item.height != null;
        return (
          key !== null &&
          key.kind === item.kind &&
          isKeyForProduct(item.storageKey, form.id) &&
          (item.kind === "image" ? sized : item.width == null && item.height == null)
        );
      });
      if (
        !fits ||
        repeats(form.media.map((item) => item.storageKey)).length > 0 ||
        images.length > MEDIA_LIMITS.maxImages ||
        form.media.length - images.length > MEDIA_LIMITS.maxVideos
      ) {
        ctx.addIssue({ code: "custom", message: "invalid", path: ["media"] });
      }
    },
    { when: fieldsParsed("id", "media") },
  )
  .transform((form) => ({
    ...form,
    price: form.sizes.length === 0 ? priceField.parse(form.price ?? "") : null,
    media: form.media.map((item) => ({
      storageKey: item.storageKey,
      kind: item.kind,
      width: item.width ?? null,
      height: item.height ?? null,
    })),
  }));

export type ProductEditorInput = z.input<typeof productEditorSchema>;
export type ProductEditorData = z.output<typeof productEditorSchema>;

/** Field order for moving focus to the first error. */
export const editorFieldOrder = [
  "name",
  "code",
  "categoryId",
  "subCategoryId",
  "description",
  "media",
  "specs",
  "price",
  "sizes",
  "colours",
  "pairs",
] as const;

// The category dialog (spec 0008 AC-2, AC-3): the same schema in the browser and in the actions.
// Names may be Latin ("LED"), so they are tidied text, not Arabic only.
export const CATEGORY_LIMITS = { nameMin: 2, nameMax: 60, descriptionMax: 500 } as const;

const optionalGuid = z
  .string()
  .optional()
  .transform((value) => value?.trim().toLowerCase() || undefined)
  .pipe(z.guid({ error: "invalid" }).optional());

/** A form switch or checkbox: present as `on` (or `true`) when checked, missing when not. */
const formSwitch = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true");

export const categoryFormSchema = z.object({
  name: tidiedText({ min: CATEGORY_LIMITS.nameMin, max: CATEGORY_LIMITS.nameMax }),
  description: tidiedText({
    optional: true,
    max: CATEGORY_LIMITS.descriptionMax,
    multiline: true,
  }),
  isVisible: formSwitch,
});

/** Add: a main (no `parentId`) or a sub under the main `parentId`. */
export const createCategorySchema = categoryFormSchema.extend({ parentId: optionalGuid });

export const updateCategorySchema = categoryFormSchema.extend({
  id: z.guid().transform((id) => id.toLowerCase()),
});

export const moveCategorySchema = z.object({
  id: z.guid().transform((id) => id.toLowerCase()),
  direction: z.enum(["up", "down"]),
});

export const categoryIdSchema = z.object({ id: z.guid().transform((id) => id.toLowerCase()) });

export type CreateCategoryData = z.output<typeof createCategorySchema>;
export type UpdateCategoryData = z.output<typeof updateCategorySchema>;
