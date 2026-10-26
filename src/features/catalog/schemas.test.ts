import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/form-errors";
import { mediaKey } from "./media-rules";
import {
  createCategorySchema,
  moveCategorySchema,
  productEditorSchema,
  updateCategorySchema,
  type ProductEditorInput,
} from "./schemas";

// covers: AC-2 (spec 0004); AC-9, AC-11 (spec 0005); AC-2 to AC-5, AC-8, AC-9, AC-16, AC-18 (spec 0006)

const ID = "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b";
const CATEGORY = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const RED = "c0000000-0000-4000-8000-000000000001";
const FILE = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const FILE2 = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

const valid: ProductEditorInput = {
  id: ID,
  version: null,
  name: "ثريا كريستال",
  code: " ch-1020 ",
  categoryId: CATEGORY,
  subCategoryId: "",
  description: "",
  specs: [],
  visible: true,
  available: true,
  price: "1,250",
  sizes: [],
  colours: [],
  pairs: [],
  media: [],
};

const parse = (patch: Partial<ProductEditorInput>) =>
  productEditorSchema.parse({ ...valid, ...patch });

const errorsOf = (patch: Partial<ProductEditorInput>) => {
  const result = productEditorSchema.safeParse({ ...valid, ...patch });
  return result.success ? {} : fieldErrorsOf(result.error);
};

const twoByOne = {
  sizes: [
    { label: "صغير", price: "100" },
    { label: "كبير", price: "200" },
  ],
  colours: [{ colourId: RED }],
  pairs: [
    { size: 0, colour: 0, available: true },
    { size: 1, colour: 0, available: false },
  ],
} satisfies Partial<ProductEditorInput>;

describe("productEditorSchema: basics", () => {
  it("trims and uppercases the code and reads the single price as agorot", () => {
    expect(parse({})).toMatchObject({
      id: ID,
      name: "ثريا كريستال",
      code: "CH-1020",
      categoryId: CATEGORY,
      subCategoryId: undefined,
      description: undefined,
      price: 125_000,
    });
  });

  it.each([
    ["١٬٢٥٠", 125_000],
    ["١٩٫٩", 1990],
    ["1000000", 100_000_000],
  ])("reads the typed price %j", (price, agorot) => {
    expect(parse({ price }).price).toBe(agorot);
  });

  it.each(["0", "-3", "19.999", "1000000.01", "12,50", "abc"])("refuses the price %j", (price) => {
    expect(errorsOf({ price }).price).toEqual({ code: "price_invalid" });
  });

  it("says required for an empty single price or code", () => {
    expect(errorsOf({ price: " " }).price).toEqual({ code: "required" });
    expect(errorsOf({ price: undefined }).price).toEqual({ code: "required" });
    expect(errorsOf({ code: "" }).code).toEqual({ code: "required" });
  });

  it.each(["-AB", "AB CD", "Ab_1", "A".repeat(31), "أ1"])("refuses the code %j", (code) => {
    expect(errorsOf({ code }).code).toEqual({ code: "code_invalid" });
  });

  it("takes a code typed with Arabic digits", () => {
    expect(parse({ code: "ch-١٠٢٠" }).code).toBe("CH-1020");
  });

  it("asks for Arabic in the name and a filled description", () => {
    expect(errorsOf({ name: "Philips 60W" }).name).toEqual({ code: "arabic_required" });
    expect(parse({ name: "ثريا كريستال Philips 60W" }).name).toBe("ثريا كريستال Philips 60W");
    expect(errorsOf({ description: "LED 60W" }).description?.code).toBe("arabic_required");
    expect(parse({ description: "  " }).description).toBeUndefined();
  });

  it("checks name and description lengths", () => {
    expect(errorsOf({ name: "ث" }).name?.code).toBe("too_short");
    expect(errorsOf({ name: "ث".repeat(121) }).name?.code).toBe("too_long");
    expect(errorsOf({ description: "ث".repeat(4001) }).description).toEqual({
      code: "too_long",
      params: { max: 4000 },
    });
  });

  it("keeps a description's lines", () => {
    expect(parse({ description: "سطر أول\n\n\n\nسطر ثانٍ" }).description).toBe(
      "سطر أول\n\nسطر ثانٍ",
    );
  });

  it("refuses an id that is not a uuid", () => {
    expect(errorsOf({ id: "products/x" }).id).toBeDefined();
  });
});

describe("productEditorSchema: category (AC-18; spec 0008 AC-17)", () => {
  it("needs a main category, shown beside other errors", () => {
    expect(errorsOf({ categoryId: "", price: "0" })).toEqual({
      price: { code: "price_invalid" },
      categoryId: { code: "category_required" },
    });
  });

  it("no longer takes a typed new category name", () => {
    const data = parse({ newCategoryName: "إنارة" } as Partial<ProductEditorInput>);
    expect(data).not.toHaveProperty("newCategoryName");
  });

  it("keeps the sub category id", () => {
    expect(parse({ subCategoryId: RED.toUpperCase() }).subCategoryId).toBe(RED);
  });
});

describe("productEditorSchema: sizes and colours (AC-4, AC-5)", () => {
  it("reads each size's price and leaves the single price out", () => {
    const data = parse({ ...twoByOne, price: "not read" });
    expect(data.price).toBeNull();
    expect(data.sizes).toEqual([
      { originalLabel: null, label: "صغير", price: 10_000 },
      { originalLabel: null, label: "كبير", price: 20_000 },
    ]);
  });

  it("refuses a repeated size label on the second row, after tidying and ignoring case", () => {
    const errors = errorsOf({
      sizes: [
        { label: "XL", price: "1" },
        { label: " xl ", price: "2" },
      ],
      pairs: [
        { size: 0, colour: null, available: true },
        { size: 1, colour: null, available: true },
      ],
    });
    expect(errors).toEqual({ "sizes.1.label": { code: "duplicate" } });
  });

  it("says required for an empty size label and checks its price", () => {
    const errors = errorsOf({
      sizes: [{ label: "  ", price: "0" }],
      pairs: [{ size: 0, colour: null, available: true }],
    });
    expect(errors).toEqual({
      "sizes.0.label": { code: "required" },
      "sizes.0.price": { code: "price_invalid" },
    });
  });

  it("refuses a 13th size as an invalid payload", () => {
    const sizes = Array.from({ length: 13 }, (_, i) => ({ label: `S${i}`, price: "1" }));
    const pairs = sizes.map((_, i) => ({ size: i, colour: null, available: true }));
    expect(errorsOf({ sizes, pairs }).sizes).toEqual({ code: "invalid" });
  });

  it("refuses the same colour twice and a repeated new colour name", () => {
    const pairs = [0, 1].map((c) => ({ size: null, colour: c, available: true }));
    expect(errorsOf({ colours: [{ colourId: RED }, { colourId: RED }], pairs })).toEqual({
      "colours.1.newName": { code: "duplicate" },
    });
    expect(errorsOf({ colours: [{ newName: "ذهبي" }, { newName: " ذهبي " }], pairs })).toEqual({
      "colours.1.newName": { code: "duplicate" },
    });
  });

  it("asks for Arabic in a new colour name", () => {
    const pairs = [{ size: null, colour: 0, available: true }];
    expect(errorsOf({ colours: [{ newName: "Gold" }], pairs })["colours.0.newName"]?.code).toBe(
      "arabic_required",
    );
  });

  it("gives colours only the single price", () => {
    const pairs = [{ size: null, colour: 0, available: true }];
    expect(parse({ colours: [{ colourId: RED }], pairs, price: "40" }).price).toBe(4_000);
  });
});

describe("productEditorSchema: pairs shape (AC-16)", () => {
  it.each([
    ["a missing pair", twoByOne.pairs.slice(0, 1)],
    ["a repeated pair", [twoByOne.pairs[0], twoByOne.pairs[0]]],
    ["an index out of range", [twoByOne.pairs[0], { size: 2, colour: 0, available: true }]],
    ["a colour where there is none", [{ size: 0, colour: 0, available: true }]],
  ])("refuses %s", (_name, pairs) => {
    const patch =
      _name === "a colour where there is none"
        ? { sizes: [twoByOne.sizes[0]], pairs }
        : { ...twoByOne, pairs };
    expect(errorsOf(patch).pairs).toEqual({ code: "invalid" });
  });

  it("wants no pairs for a simple product", () => {
    expect(errorsOf({ pairs: [{ size: null, colour: null, available: true }] }).pairs).toEqual({
      code: "invalid",
    });
  });
});

describe("productEditorSchema: specs (AC-9)", () => {
  it("drops rows with an empty value and keeps the order", () => {
    const data = parse({
      specs: [
        { label: "القطر (سم)", value: " 60 " },
        { label: "الارتفاع (سم)", value: "" },
        { label: "القدرة", value: "60W" },
        { label: "القدرة", value: "LED" },
      ],
    });
    expect(data.specs).toEqual([
      { label: "القطر (سم)", value: "60" },
      { label: "القدرة", value: "60W" },
      { label: "القدرة", value: "LED" },
    ]);
  });

  it("needs a label beside a value, in Arabic, and checks both lengths", () => {
    expect(
      errorsOf({
        specs: [
          { label: "", value: "60" },
          { label: "Power", value: "60" },
          { label: "القدرة", value: "x".repeat(121) },
        ],
      }),
    ).toEqual({
      "specs.0.label": { code: "required" },
      "specs.1.label": { code: "arabic_required" },
      "specs.2.value": { code: "too_long", params: { max: 120 } },
    });
  });

  it("refuses a 31st row", () => {
    const specs = Array.from({ length: 31 }, () => ({ label: "القدرة", value: "1" }));
    expect(errorsOf({ specs }).specs).toEqual({ code: "invalid" });
  });
});

describe("productEditorSchema: media (AC-8, AC-16)", () => {
  const photo = (file = FILE) => ({
    storageKey: mediaKey(ID, file, "webp"),
    kind: "image" as const,
    width: 1200,
    height: 800,
  });
  const video = { storageKey: mediaKey(ID, FILE2, "mp4"), kind: "video" as const };

  it("takes photos with their size and one video without", () => {
    expect(parse({ media: [photo(), video] }).media).toEqual([
      { ...photo(), width: 1200, height: 800 },
      { ...video, width: null, height: null },
    ]);
  });

  it.each([
    ["a repeated key", [photo(), photo()]],
    [
      "a key in another product's folder",
      [{ ...photo(), storageKey: mediaKey(RED, FILE, "webp") }],
    ],
    ["a photo with width 0", [{ ...photo(), width: 0 }]],
    ["a photo wider than 2,000", [{ ...photo(), width: 2001 }]],
    ["a photo without a size", [{ ...photo(), width: undefined }]],
    [
      "a kind that does not match the key",
      [{ ...video, kind: "image" as const, width: 1, height: 1 }],
    ],
    ["two videos", [video, { ...video, storageKey: mediaKey(ID, FILE, "mp4") }]],
  ])("refuses %s", (_name, media) => {
    const mediaErrors = Object.entries(errorsOf({ media })).filter(([key]) =>
      key.startsWith("media"),
    );
    expect(mediaErrors).not.toEqual([]);
    expect(mediaErrors.every(([, error]) => error.code === "invalid")).toBe(true);
  });

  it("refuses a 9th photo", () => {
    const media = Array.from({ length: 9 }, (_, i) => photo(`${FILE.slice(0, -1)}${i}`));
    expect(errorsOf({ media }).media).toEqual({ code: "invalid" });
  });
});

// covers: AC-2, AC-3 (spec 0008)
describe("category schemas", () => {
  const MAIN = "8A1D2B3C-4D5E-4F60-8A71-B2C3D4E5F607";

  it("tidies the name and description and reads the switch", () => {
    expect(
      createCategorySchema.parse({
        name: "  ثريات   ونجف ",
        description: "  ",
        isVisible: "on",
        parentId: MAIN,
      }),
    ).toEqual({
      name: "ثريات ونجف",
      description: undefined,
      isVisible: true,
      parentId: MAIN.toLowerCase(),
    });
    expect(createCategorySchema.parse({ name: "LED", parentId: "" })).toEqual({
      name: "LED",
      description: undefined,
      isVisible: false,
      parentId: undefined,
    });
  });

  it("checks the name and description lengths after tidying", () => {
    const errors = (input: Record<string, unknown>) => {
      const result = createCategorySchema.safeParse(input);
      return result.success ? {} : fieldErrorsOf(result.error);
    };
    expect(errors({ name: " ث " })).toMatchObject({ name: { code: "too_short" } });
    expect(errors({ name: "ث".repeat(61) })).toMatchObject({ name: { code: "too_long" } });
    expect(errors({ name: "ثريات", description: "و".repeat(501) })).toMatchObject({
      description: { code: "too_long" },
    });
    expect(errors({ name: "ثريات", parentId: "not an id" })).toMatchObject({
      parentId: { code: "invalid" },
    });
  });

  it("needs an id to edit and a direction to move", () => {
    expect(updateCategorySchema.safeParse({ name: "ثريات" }).success).toBe(false);
    expect(moveCategorySchema.safeParse({ id: MAIN, direction: "left" }).success).toBe(false);
    expect(moveCategorySchema.parse({ id: MAIN, direction: "up" }).id).toBe(MAIN.toLowerCase());
  });
});

// covers: AC-11 (spec 0011)
describe("category schemas: the Home circle", () => {
  const FILE = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";

  it("tidies the circle line and keeps an empty one as none", () => {
    expect(
      createCategorySchema.parse({ name: "ثريات", homeSubtitle: "  مودرن  وكلاسيك " }),
    ).toMatchObject({ homeSubtitle: "مودرن وكلاسيك" });
    expect(createCategorySchema.parse({ name: "ثريات", homeSubtitle: "  " }).homeSubtitle).toBe(
      undefined,
    );
  });

  it("allows at most 40 characters on the line", () => {
    const result = createCategorySchema.safeParse({ name: "ثريات", homeSubtitle: "ب".repeat(41) });
    expect(result.success ? {} : fieldErrorsOf(result.error)).toMatchObject({
      homeSubtitle: { code: "too_long", params: { max: 40 } },
    });
  });

  it("reads a photo key, an empty one as a removal, and a missing one as unchanged", () => {
    const key = `categories/${FILE}.webp`;
    expect(createCategorySchema.parse({ name: "ثريات", imageKey: key }).imageKey).toBe(key);
    expect(createCategorySchema.parse({ name: "ثريات", imageKey: "" }).imageKey).toBeNull();
    expect(createCategorySchema.parse({ name: "ثريات" }).imageKey).toBeUndefined();
    expect(
      createCategorySchema.safeParse({ name: "ثريات", imageKey: `banners/${FILE}.webp` }).success,
    ).toBe(false);
  });
});
