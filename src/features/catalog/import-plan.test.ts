import { describe, expect, it } from "vitest";
import { importProductSchema, type ImportProductInput } from "./import-schemas";
import { contextCodes, reviewImport, toEditorData, type ImportContext } from "./import-plan";
import type { ParsedSheet } from "./import-sheet";
import { productEditorSchema } from "./schemas";
import type { ProductEditorState } from "./server/admin-queries";

// covers: AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-14 (spec 0007)

const MAIN = "00000000-0000-4000-8000-000000000001";
const SUB = "00000000-0000-4000-8000-000000000002";
const GOLD = "00000000-0000-4000-8000-0000000000a1";
const BLACK = "00000000-0000-4000-8000-0000000000a2";
const PRODUCT = "00000000-0000-4000-8000-0000000000f1";
const NEW_ID = "00000000-0000-4000-8000-0000000000f2";
const KEY = `products/${PRODUCT}/00000000-0000-4000-8000-0000000000e1.webp`;

const sheetProduct = (fields: Partial<ImportProductInput>) =>
  importProductSchema.parse({
    code: "CH-100",
    rows: [2],
    specs: [],
    sizes: [],
    colours: [],
    ...fields,
  });

const resolved = {
  mainId: MAIN,
  subId: null,
  colours: [
    { id: GOLD, name: "ذهبي" },
    { id: BLACK, name: "أسود" },
  ],
};

const stored: ProductEditorState = {
  id: PRODUCT,
  version: 4,
  name: "ثريا قديمة",
  code: "CH-100",
  slug: "ثريا-قديمة-CH-100",
  mainCategoryId: MAIN,
  subCategoryId: SUB,
  description: "وصف محفوظ",
  specs: [
    { label: "القطر (سم)", value: "50" },
    { label: "ملاحظة", value: "يدوي" },
  ],
  visible: true,
  available: false,
  isArchived: false,
  hasOrders: true,
  price: "",
  sizes: [
    { originalLabel: "صغير", label: "صغير", price: "100" },
    { originalLabel: "كبير", label: "كبير", price: "150" },
  ],
  colours: [
    { colourId: GOLD, name: "ذهبي" },
    { colourId: BLACK, name: "أسود" },
  ],
  pairs: [
    { size: 0, colour: 0, available: true },
    { size: 0, colour: 1, available: false },
    { size: 1, colour: 0, available: true },
    { size: 1, colour: 1, available: false },
  ],
  media: [{ storageKey: KEY, kind: "image", width: 800, height: 600 }],
};

const merge = (fields: Partial<ImportProductInput>, from: ProductEditorState | null = stored) => {
  const result = toEditorData(sheetProduct(fields), from, resolved, () => NEW_ID);
  if (!result.ok) throw new Error(result.problem);
  return result.data;
};

describe("toEditorData, a new product", () => {
  it("defaults to hidden and available, specs in column order, every pair ticked", () => {
    const data = merge(
      {
        name: "ثريا جديدة",
        mainCategory: "ثريات",
        specs: [{ label: "القطر (سم)", value: "60" }],
        sizes: [
          { label: "60 سم", price: "450" },
          { label: "80 سم", price: "650.5" },
        ],
        rows: [2, 3],
        colours: ["ذهبي", "فضي"],
      },
      null,
    );
    expect(data).toMatchObject({
      id: NEW_ID,
      version: null,
      name: "ثريا جديدة",
      categoryId: MAIN,
      visible: false,
      available: true,
      specs: [{ label: "القطر (سم)", value: "60" }],
      sizes: [
        { originalLabel: null, label: "60 سم", price: "450" },
        { originalLabel: null, label: "80 سم", price: "650.50" },
      ],
      colours: [{ colourId: GOLD }, { newName: "فضي" }],
      media: [],
    });
    expect(data.pairs).toHaveLength(4);
    expect(data.pairs.every((pair) => pair.available)).toBe(true);
    expect(productEditorSchema.safeParse(data).success).toBe(true);
  });

  it("makes a simple product from the single price", () => {
    const data = merge({ name: "أباجورة", price: "120" }, null);
    expect(data).toMatchObject({ sizes: [], colours: [], pairs: [], price: "120" });
    expect(productEditorSchema.parse(data).price).toBe(12_000);
  });

  it("needs a name", () => {
    expect(toEditorData(sheetProduct({ price: "5" }), null, resolved, () => NEW_ID)).toEqual({
      ok: false,
      problem: "name_missing",
    });
  });
});

describe("toEditorData, an existing product", () => {
  const twoSizes = {
    rows: [2, 3],
    sizes: [
      { label: "صغير", price: "110" },
      { label: "كبير", price: "160" },
    ],
    colours: ["ذهبي", "أسود"],
  };

  it("keeps the stored value for every empty cell", () => {
    const data = merge(twoSizes);
    expect(data).toMatchObject({
      id: PRODUCT,
      version: 4,
      name: "ثريا قديمة",
      description: "وصف محفوظ",
      visible: true,
      available: false,
      specs: stored.specs,
      media: stored.media,
    });
  });

  it("replaces a spec by its label and appends a new one", () => {
    const data = merge({
      ...twoSizes,
      specs: [
        { label: "القطر (سم)", value: "55" },
        { label: "القدرة", value: "40 واط" },
      ],
    });
    expect(data.specs).toEqual([
      { label: "القطر (سم)", value: "55" },
      { label: "ملاحظة", value: "يدوي" },
      { label: "القدرة", value: "40 واط" },
    ]);
  });

  it("refuses an append past 30 specs", () => {
    const full = {
      ...stored,
      specs: Array.from({ length: 30 }, (_, i) => ({ label: `مواصفة ${i}`, value: "1" })),
    };
    expect(
      toEditorData(
        sheetProduct({ ...twoSizes, specs: [{ label: "القدرة", value: "1" }] }),
        full,
        resolved,
        () => NEW_ID,
      ),
    ).toEqual({ ok: false, problem: "too_many_specs" });
  });

  it("keeps sizes matched by label and the ticks of surviving pairs", () => {
    const data = merge({
      rows: [2, 3],
      sizes: [
        { label: "كبير", price: "160" },
        { label: "وسط", price: "130" },
      ],
      colours: ["أسود", "ذهبي"],
    });
    expect(data.sizes).toEqual([
      { originalLabel: "كبير", label: "كبير", price: "160" },
      { originalLabel: null, label: "وسط", price: "130" },
    ]);
    expect(data.colours).toEqual([{ colourId: BLACK }, { colourId: GOLD }]);
    // كبير أسود was off and survives; a new size starts ticked.
    expect(data.pairs).toEqual([
      { size: 0, colour: 0, available: false },
      { size: 0, colour: 1, available: true },
      { size: 1, colour: 0, available: true },
      { size: 1, colour: 1, available: true },
    ]);
  });

  it("matches a size label in another case or spacing to the stored one", () => {
    const withLatin = {
      ...stored,
      sizes: [{ originalLabel: "XL", label: "XL", price: "100" }],
      colours: [],
      pairs: [{ size: 0, colour: null, available: false }],
    };
    const data = merge({ sizes: [{ label: "xl", price: "100" }] }, withLatin);
    expect(data.sizes[0].originalLabel).toBe("XL");
    expect(data.pairs).toEqual([{ size: 0, colour: null, available: false }]);
  });

  it("takes filled cells over the stored ones", () => {
    const data = merge({ ...twoSizes, name: "اسم جديد", visible: false, available: true });
    expect(data).toMatchObject({ name: "اسم جديد", visible: false, available: true });
  });
});

const lookups: ImportContext["lookups"] = {
  categories: [{ id: MAIN, name: "ثريات", children: [{ id: SUB, name: "كريستال" }] }],
  colours: resolved.colours,
};

const ok = (product: Partial<ImportProductInput> & { code: string }) => ({
  ok: true as const,
  code: product.code,
  product: { rows: [2], specs: [], sizes: [], colours: [], ...product },
});

const parsed = (...products: ParsedSheet["products"]): ParsedSheet => ({ products, problems: [] });

describe("reviewImport", () => {
  const context: ImportContext = {
    products: [
      { code: "LIVE-1", id: PRODUCT, status: "active", mainCategoryId: MAIN },
      { code: "OLD-1", id: NEW_ID, status: "archived", mainCategoryId: MAIN },
    ],
    lookups,
  };

  it("counts new and updated products and lists new categories and colours", () => {
    const review = reviewImport(
      parsed(
        ok({
          code: "NEW-1",
          name: "ثريا",
          mainCategory: "مصابيح",
          subCategory: "حديثة",
          price: "5",
          rows: [2, 3],
        }),
        ok({
          code: "LIVE-1",
          subCategory: "كلاسيك",
          colours: ["ذهبي", "فضي"],
          price: "5",
          rows: [4],
        }),
        ok({
          code: "NEW-2",
          name: "ثريا",
          mainCategory: "ثريات",
          subCategory: "كريستال",
          price: "5",
          rows: [5],
        }),
      ),
      context,
      [],
    );
    expect(review).toMatchObject({
      okRows: 4,
      problemRows: 0,
      created: 2,
      updated: 1,
      newCategories: ["مصابيح", "مصابيح › حديثة", "ثريات › كلاسيك"],
      newColours: ["فضي"],
      canConfirm: true,
    });
    expect(review.items.map((item) => [item.code, item.kind])).toEqual([
      ["NEW-1", "create"],
      ["LIVE-1", "update"],
      ["NEW-2", "create"],
    ]);
  });

  it("holds back an archived code, a new product with no name or main, and a non Arabic new colour", () => {
    const review = reviewImport(
      parsed(
        ok({ code: "OLD-1", price: "5", rows: [2, 3] }),
        ok({ code: "NEW-1", mainCategory: "ثريات", price: "5", rows: [4] }),
        ok({ code: "NEW-2", name: "ثريا", price: "5", rows: [5] }),
        ok({ code: "LIVE-1", colours: ["RGB"], price: "5", rows: [6] }),
      ),
      context,
      [],
    );
    expect(review.problems.map(({ row, problem }) => [row, problem])).toEqual([
      [2, "archived"],
      [3, "skipped"],
      [4, "name_missing"],
      [5, "category_missing"],
      [6, "colour_invalid"],
    ]);
    expect(review).toMatchObject({ okRows: 0, problemRows: 5, canConfirm: false });
  });

  it("matches photos to sheet products and to live products the sheet leaves alone", () => {
    const bad = {
      ok: false as const,
      code: "BAD-1",
      rows: [3],
      problems: [{ row: 3, file: null, code: "BAD-1", problem: "price_invalid" as const }],
    };
    const review = reviewImport(
      parsed(ok({ code: "NEW-1", name: "ثريا", mainCategory: "ثريات", price: "5" }), bad),
      context,
      [
        { id: "a", name: "NEW-1.jpg", size: 10 },
        { id: "b", name: "NEW-1_2.jpg", size: 10 },
        { id: "c", name: "LIVE-1.jpg", size: 10 },
        { id: "d", name: "BAD-1.jpg", size: 10 },
        { id: "e", name: "NONE-1.jpg", size: 10 },
        { id: "f", name: "IMG_1.jpg", size: 10 },
      ],
    );
    expect(review.photos).toEqual([
      {
        code: "LIVE-1",
        productId: PRODUCT,
        fromSheet: false,
        files: [{ id: "c", name: "LIVE-1.jpg" }],
      },
      {
        code: "NEW-1",
        productId: null,
        fromSheet: true,
        files: [
          { id: "a", name: "NEW-1.jpg" },
          { id: "b", name: "NEW-1_2.jpg" },
        ],
      },
    ]);
    // BAD-1 is held back; NONE-1 and IMG (IMG_1.jpg is code IMG, position 1) are no product.
    expect(review.unmatchedPhotos).toBe(3);
    expect(review.items).toEqual([
      { code: "NEW-1", kind: "create", name: "ثريا", photos: 2 },
      { code: "LIVE-1", kind: "update", name: null, photos: 1 },
    ]);
    // Sheet rows first, then photos by file name.
    expect(review.problems.map((problem) => problem.row ?? problem.file)).toEqual([
      3,
      "BAD-1.jpg",
      "IMG_1.jpg",
      "NONE-1.jpg",
    ]);
  });

  it("can confirm photos alone", () => {
    const review = reviewImport(null, context, [{ id: "c", name: "LIVE-1.jpg", size: 10 }]);
    expect(review).toMatchObject({ canConfirm: true, created: 0, updated: 1, okRows: 0 });
  });
});

describe("contextCodes", () => {
  it("asks about each valid code once, from the sheet and the photo names", () => {
    expect(
      contextCodes(parsed(ok({ code: "A-1" }), ok({ code: "BAD CODE" })), [
        { id: "1", name: "a-1_2.jpg", size: 1 },
        { id: "2", name: "B-2.png", size: 1 },
        { id: "3", name: "notes.txt", size: 1 },
      ]),
    ).toEqual(["A-1", "B-2"]);
  });
});
