// What an import will do (spec 0007 AC-7 to AC-10, AC-12, AC-14). Pure: `toEditorData` merges one
// sheet product with the stored product into the editor's payload, so the import saves through
// the editor's own save; `reviewImport` gives the page its chips, counts, new names, product
// list, problems table, and what to send.
import { tidyText } from "@/lib/arabic";
import { toShekelsInput } from "@/lib/money";
import {
  isNewColourNameValid,
  isProductCode,
  type ImportProductData,
  type ImportProductInput,
  type ProblemCode,
} from "./import-schemas";
import { withSkippedRows, type ImportProblem, type ParsedSheet } from "./import-sheet";
import {
  byFileName,
  matchPhotos,
  parsePhotoName,
  type PhotoFile,
  type PhotoTarget,
} from "./photo-names";
import { PRODUCT_LIMITS, optionKey, type ProductEditorInput } from "./schemas";
import type { EditorLookups, ProductEditorState } from "./server/admin-queries";

/** The categories a product ends in, and the shop's colours, as the server found or made them. */
export type ResolvedNames = {
  readonly mainId: string;
  readonly subId: string | null;
  readonly colours: readonly { readonly id: string; readonly name: string }[];
};

/** Specs: a filled cell replaces the first stored row with its label, else is appended (AC-8). */
function mergeSpecs(
  stored: readonly { readonly label: string; readonly value: string }[],
  sheet: readonly { readonly label: string; readonly value: string }[],
): readonly { readonly label: string; readonly value: string }[] | null {
  const merged = [...stored];
  for (const spec of sheet) {
    const index = merged.findIndex((row) => tidyText(row.label) === spec.label);
    if (index >= 0) merged[index] = { label: merged[index].label, value: spec.value };
    else merged.push(spec);
  }
  return merged.length > PRODUCT_LIMITS.maxSpecs ? null : merged;
}

/**
 * The editor payload for one sheet product (AC-7, AC-8): a new product when `stored` is null,
 * else the stored one with the sheet's filled cells over it. Sizes, prices, and colours follow
 * the sheet exactly; a tick survives only for a pair that was live before.
 */
export function toEditorData(
  sheet: ImportProductData,
  stored: ProductEditorState | null,
  resolved: ResolvedNames,
  newId: () => string,
):
  | { readonly ok: true; readonly data: ProductEditorInput }
  | { readonly ok: false; readonly problem: ProblemCode } {
  const name = sheet.name ?? stored?.name;
  if (!name) return { ok: false, problem: "name_missing" };
  const specs = stored ? mergeSpecs(stored.specs, sheet.specs) : sheet.specs;
  if (!specs) return { ok: false, problem: "too_many_specs" };

  const sizes = sheet.sizes.map((size) => ({
    originalLabel:
      stored?.sizes.find((old) => optionKey(old.originalLabel) === optionKey(size.label))
        ?.originalLabel ?? null,
    label: size.label,
    price: toShekelsInput(size.price),
  }));

  const colourIds = sheet.colours.map(
    (colourName) =>
      resolved.colours.find((listed) => optionKey(listed.name) === optionKey(colourName))?.id ??
      null,
  );
  const colours = sheet.colours.map((colourName, index) => {
    const colourId = colourIds[index];
    return colourId ? { colourId } : { newName: colourName };
  });

  /** The stored tick of a pair that was live before: same size as loaded and same colour. */
  const storedTick = (size: number | null, colour: number | null): boolean => {
    if (!stored) return true;
    const label = size === null ? null : sizes[size].originalLabel;
    const colourId = colour === null ? null : colourIds[colour];
    // A size or colour new to the product starts ticked.
    if ((size !== null && label === null) || (colour !== null && colourId === null)) return true;
    const oldSize =
      label === null ? null : stored.sizes.findIndex((old) => old.originalLabel === label);
    const oldColour =
      colourId === null ? null : stored.colours.findIndex((old) => old.colourId === colourId);
    return (
      stored.pairs.find((pair) => pair.size === oldSize && pair.colour === oldColour)?.available ??
      true
    );
  };

  const sizeIndexes = sizes.length ? sizes.map((_, index) => index) : [null];
  const colourIndexes = colours.length ? colours.map((_, index) => index) : [null];
  const pairs =
    sizes.length || colours.length
      ? sizeIndexes.flatMap((size) =>
          colourIndexes.map((colour) => ({ size, colour, available: storedTick(size, colour) })),
        )
      : [];

  return {
    ok: true,
    data: {
      id: stored?.id ?? newId(),
      version: stored?.version ?? null,
      name,
      code: sheet.code,
      categoryId: resolved.mainId,
      subCategoryId: resolved.subId ?? undefined,
      newCategoryName: undefined,
      description: sheet.description ?? (stored?.description || undefined),
      specs: [...specs],
      visible: sheet.visible ?? stored?.visible ?? false,
      available: sheet.available ?? stored?.available ?? true,
      price:
        sizes.length === 0 && sheet.price !== undefined ? toShekelsInput(sheet.price) : undefined,
      sizes,
      colours,
      pairs,
      media: stored ? stored.media.map((item) => ({ ...item })) : [],
    },
  };
}

/** What the server says about the codes on the page (`readImportContext`). */
export type ImportContext = {
  readonly products: readonly {
    readonly code: string;
    readonly id: string;
    readonly status: "active" | "hidden" | "archived";
    readonly mainCategoryId: string;
  }[];
  readonly lookups: EditorLookups;
};

/** The codes to ask `readImportContext` about: the sheet's and the photos', each once. */
export function contextCodes(
  sheet: ParsedSheet | null,
  photos: readonly PhotoFile[],
): readonly string[] {
  const codes = new Set<string>();
  for (const product of sheet?.products ?? []) {
    if (isProductCode(product.code)) codes.add(product.code);
  }
  for (const photo of photos) {
    const parsed = parsePhotoName(photo.name);
    if (parsed) codes.add(parsed.code);
  }
  return [...codes];
}

export type ReviewItem = {
  readonly code: string;
  readonly kind: "create" | "update";
  readonly name: string | null;
  readonly photos: number;
};

export type PhotoPlan = {
  readonly code: string;
  /** The live product's id; null for a sheet product, whose id comes from its run outcome. */
  readonly productId: string | null;
  readonly fromSheet: boolean;
  readonly files: readonly { readonly id: string; readonly name: string }[];
};

export type Review = {
  readonly okRows: number;
  readonly problemRows: number;
  readonly unmatchedPhotos: number;
  readonly created: number;
  readonly updated: number;
  readonly newCategories: readonly string[];
  readonly newColours: readonly string[];
  readonly items: readonly ReviewItem[];
  readonly problems: readonly ImportProblem[];
  readonly send: readonly ImportProductInput[];
  readonly photos: readonly PhotoPlan[];
  readonly canConfirm: boolean;
};

const sameName = (a: string, b: string) => tidyText(a) === tidyText(b);

/** Sheet problems by row, then photo problems by file name (AC-14). */
export function orderProblems(problems: readonly ImportProblem[]): readonly ImportProblem[] {
  const rows = problems.filter((problem) => problem.file === null);
  const files = problems.filter((problem) => problem.file !== null);
  return [
    ...[...rows].sort((a, b) => (a.row ?? 0) - (b.row ?? 0)),
    ...[...files].sort((a, b) => byFileName(a.file!, b.file!)),
  ];
}

const UNMATCHED: readonly ProblemCode[] = [
  "photo_no_product",
  "photo_archived",
  "photo_product_skipped",
];

export function reviewImport(
  sheet: ParsedSheet | null,
  context: ImportContext,
  photoFiles: readonly PhotoFile[],
): Review {
  const live = new Map(
    context.products.filter((p) => p.status !== "archived").map((p) => [p.code, p]),
  );
  const archived = new Set(
    context.products.filter((p) => p.status === "archived").map((p) => p.code),
  );
  const { categories, colours } = context.lookups;

  const problems: ImportProblem[] = [...(sheet?.problems ?? [])];
  const send: ImportProductInput[] = [];
  const skippedCodes = new Set<string>();
  const newCategories: string[] = [];
  const newColours: string[] = [];
  const addNew = (list: string[], name: string, same: (a: string, b: string) => boolean) => {
    if (!list.some((known) => same(known, name))) list.push(name);
  };

  for (const checked of sheet?.products ?? []) {
    if (!checked.ok) {
      problems.push(...checked.problems);
      skippedCodes.add(checked.code);
      continue;
    }
    const { product } = checked;
    const stored = live.get(product.code);
    const firstRow = product.rows[0];
    const refuse = (problem: ProblemCode, column?: string) => {
      problems.push(
        ...withSkippedRows(product.code, product.rows, [
          { row: firstRow, file: null, code: product.code, problem, ...(column ? { column } : {}) },
        ]),
      );
      skippedCodes.add(product.code);
    };

    if (archived.has(product.code)) {
      refuse("archived");
      continue;
    }
    if (!stored && !product.name) {
      refuse("name_missing", "الاسم");
      continue;
    }
    if (!stored && !product.mainCategory) {
      refuse("category_missing", "القسم الرئيسي");
      continue;
    }
    const unknownColours = product.colours.filter(
      (name) => !colours.some((listed) => optionKey(listed.name) === optionKey(name)),
    );
    if (unknownColours.some((name) => !isNewColourNameValid(name))) {
      refuse("colour_invalid", "الألوان");
      continue;
    }

    send.push(product);
    unknownColours.forEach((name) =>
      addNew(newColours, name, (a, b) => optionKey(a) === optionKey(b)),
    );

    // New categories (AC-9): a sub given alone sits under the product's stored main.
    const main = product.mainCategory
      ? categories.find((category) => sameName(category.name, product.mainCategory!))
      : categories.find((category) => category.id === stored?.mainCategoryId);
    if (product.mainCategory && !main) addNew(newCategories, product.mainCategory, sameName);
    if (product.subCategory) {
      const mainName = product.mainCategory ?? main?.name ?? "";
      const sub = main?.children.find((child) => sameName(child.name, product.subCategory!));
      if (!sub) addNew(newCategories, `${mainName} › ${product.subCategory}`, sameName);
    }
  }

  // Photos (AC-12): a sheet product written in this run, or a live product the sheet leaves alone.
  const targets = new Map<string, PhotoTarget>();
  for (const code of live.keys()) targets.set(code, "live");
  for (const product of send) targets.set(product.code, "sheet");
  for (const code of skippedCodes) targets.set(code, "skipped");
  for (const code of archived) targets.set(code, "archived");
  const matched = matchPhotos(photoFiles, targets);
  problems.push(...matched.problems);

  const photos: PhotoPlan[] = [...matched.byCode].map(([code, files]) => {
    const fromSheet = send.some((product) => product.code === code);
    return { code, productId: fromSheet ? null : (live.get(code)?.id ?? null), fromSheet, files };
  });
  const photoCount = (code: string) => matched.byCode.get(code)?.length ?? 0;

  const items: ReviewItem[] = [
    ...send.map((product) => ({
      code: product.code,
      kind: live.has(product.code) ? ("update" as const) : ("create" as const),
      name: product.name ?? null,
      photos: photoCount(product.code),
    })),
    ...photos
      .filter((plan) => !plan.fromSheet)
      .map((plan) => ({
        code: plan.code,
        kind: "update" as const,
        name: null,
        photos: plan.files.length,
      })),
  ];

  const problemRowCount = new Set(
    problems.flatMap((problem) => (problem.row === null ? [] : [problem.row])),
  ).size;

  return {
    okRows: send.reduce((sum, product) => sum + product.rows.length, 0),
    problemRows: problemRowCount,
    unmatchedPhotos: matched.problems.filter((problem) => UNMATCHED.includes(problem.problem))
      .length,
    created: items.filter((item) => item.kind === "create").length,
    updated: items.filter((item) => item.kind === "update").length,
    newCategories,
    newColours,
    items,
    problems: orderProblems(problems),
    send,
    photos,
    canConfirm: send.length > 0 || photos.length > 0,
  };
}
