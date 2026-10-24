import { describe, expect, it } from "vitest";
import {
  IMPORT_COLUMNS,
  checkCategoryName,
  checkColourName,
  checkDescription,
  checkName,
  checkPrice,
  checkSizeLabel,
  checkSpecValue,
  checkYesNo,
  importProductSchema,
  isNewColourNameValid,
  normalizeCode,
  problemOf,
  repeatedIndexes,
  splitColours,
  type ImportProductInput,
} from "./import-schemas";

// covers: AC-2, AC-4, AC-5, AC-6, AC-16 (spec 0007). The field checks the review and
// `importProducts` share, so a row problem and a server refusal name the same code.

const product = (fields: Partial<ImportProductInput> = {}): ImportProductInput => ({
  code: "CH-100",
  rows: [2],
  specs: [],
  sizes: [],
  colours: [],
  price: "450",
  ...fields,
});

const refusal = (input: unknown) => {
  const parsed = importProductSchema.safeParse(input);
  if (parsed.success) throw new Error("expected the product to be refused");
  return problemOf(parsed.error);
};

describe("IMPORT_COLUMNS (AC-2)", () => {
  it("lists the template headers in the spec's order", () => {
    expect(IMPORT_COLUMNS.map((column) => column.header)).toEqual([
      "الكود",
      "الاسم",
      "القسم الرئيسي",
      "القسم الفرعي",
      "الحجم",
      "السعر",
      "الألوان",
      "الوصف",
      "القطر (سم)",
      "الارتفاع (سم)",
      "نوع القاعدة",
      "القدرة",
      "لون الإضاءة",
      "ظاهر",
      "متوفر",
    ]);
  });

  it("requires only the code, size, price, and colours columns", () => {
    const required = IMPORT_COLUMNS.filter((column) => column.required).map((c) => c.key);
    expect(required).toEqual(["code", "size", "price", "colours"]);
  });
});

describe("normalizeCode (AC-4)", () => {
  it.each([
    ["ch-١٠٠", "CH-100"],
    ["  ch-100  ", "CH-100"],
    ["Lmp-٢٠", "LMP-20"],
  ])("reads %j as %j", (text, code) => {
    expect(normalizeCode(text)).toBe(code);
  });
});

describe("checkPrice (AC-5)", () => {
  it.each([
    ["450", 45_000],
    ["19.9", 1_990],
    ["١٬٢٥٠", 125_000],
    ["1000000", 100_000_000],
  ])("turns %j into %i agorot", (text, agorot) => {
    expect(checkPrice(text)).toEqual({ ok: true, value: agorot });
  });

  it.each(["", "0", "-5", "abc", "1000000.01", "12.345"])("refuses %j as price_invalid", (text) => {
    expect(checkPrice(text)).toEqual({ ok: false, problem: "price_invalid" });
  });
});

describe("checkYesNo (AC-6)", () => {
  it("reads an empty cell as not given, so the stored or default value applies", () => {
    expect(checkYesNo("  ")).toEqual({ ok: true, value: undefined });
  });

  it("reads نعم and لا, tidied", () => {
    expect(checkYesNo(" نعم ")).toEqual({ ok: true, value: true });
    expect(checkYesNo("لا")).toEqual({ ok: true, value: false });
  });

  it.each(["yes", "1", "ايوه"])("refuses %j as yes_no_invalid", (text) => {
    expect(checkYesNo(text)).toEqual({ ok: false, problem: "yes_no_invalid" });
  });
});

describe("text cells (AC-5, AC-6)", () => {
  it("takes an Arabic name and refuses a Latin only or one letter name", () => {
    expect(checkName("ثريا كريستال")).toEqual({ ok: true, value: "ثريا كريستال" });
    expect(checkName("Chandelier")).toEqual({ ok: false, problem: "name_invalid" });
    expect(checkName("ث")).toEqual({ ok: false, problem: "name_invalid" });
  });

  it("refuses a category name over 60 characters", () => {
    expect(checkCategoryName("ثريات")).toEqual({ ok: true, value: "ثريات" });
    expect(checkCategoryName("ث".repeat(61))).toEqual({ ok: false, problem: "category_invalid" });
  });

  it("keeps an empty description as not given and names an overlong one", () => {
    expect(checkDescription("   ")).toEqual({ ok: true, value: undefined });
    expect(checkDescription("ث".repeat(4000)).ok).toBe(true);
    expect(checkDescription("ث".repeat(4001))).toEqual({
      ok: false,
      problem: "description_too_long",
    });
  });

  it("refuses a description with no Arabic as description_invalid, not too long", () => {
    expect(checkDescription("crystal chandelier")).toEqual({
      ok: false,
      problem: "description_invalid",
    });
  });

  it("allows a spec value of 120 characters and refuses 121", () => {
    expect(checkSpecValue("x".repeat(120)).ok).toBe(true);
    expect(checkSpecValue("x".repeat(121))).toEqual({ ok: false, problem: "spec_too_long" });
  });

  it("takes size labels and colour names of 1 to 40 characters", () => {
    expect(checkSizeLabel("60 سم")).toEqual({ ok: true, value: "60 سم" });
    expect(checkSizeLabel("x".repeat(41))).toEqual({ ok: false, problem: "size_invalid" });
    expect(checkColourName("ذهبي")).toEqual({ ok: true, value: "ذهبي" });
    expect(checkColourName("")).toEqual({ ok: false, problem: "colour_invalid" });
  });

  it("needs Arabic in a colour the shop does not list yet", () => {
    expect(isNewColourNameValid("ذهبي")).toBe(true);
    expect(isNewColourNameValid("Gold")).toBe(false);
  });
});

describe("splitColours (AC-5)", () => {
  it("splits on both comma kinds, tidies each name, and drops empty pieces", () => {
    expect(splitColours("ذهبي، فضي ,أسود,")).toEqual(["ذهبي", "فضي", "أسود"]);
  });

  it("gives no colours for an empty cell", () => {
    expect(splitColours("  ")).toEqual([]);
  });
});

describe("repeatedIndexes", () => {
  it("returns the index of every repeat after the first", () => {
    expect(repeatedIndexes(["a", "b", "a", "c", "b", "a"])).toEqual([2, 4, 5]);
  });

  it("returns nothing when every key is unique", () => {
    expect(repeatedIndexes([])).toEqual([]);
    expect(repeatedIndexes(["a", "b"])).toEqual([]);
  });
});

describe("importProductSchema, the server's second check (AC-16)", () => {
  it("normalises the code and turns prices into agorot", () => {
    const parsed = importProductSchema.parse(
      product({
        code: "ch-١٠٠",
        rows: [2, 3],
        price: undefined,
        sizes: [
          { label: "60 سم", price: "450" },
          { label: "80 سم", price: "650" },
        ],
        colours: ["ذهبي", "فضي"],
      }),
    );
    expect(parsed.code).toBe("CH-100");
    expect(parsed.sizes).toEqual([
      { label: "60 سم", price: 45_000 },
      { label: "80 سم", price: 65_000 },
    ]);
  });

  it("accepts a simple product with one price and no sizes", () => {
    expect(importProductSchema.parse(product()).price).toBe(45_000);
  });

  it.each<[string, Partial<ImportProductInput>, string]>([
    ["a code outside the code shape", { code: "CH 100!" }, "code_invalid"],
    ["no price and no sizes", { price: undefined }, "price_invalid"],
    ["a bad price", { price: "free" }, "price_invalid"],
    [
      "a single price beside sizes",
      { sizes: [{ label: "60 سم", price: "450" }], price: "450" },
      "size_mixed",
    ],
    [
      "more rows than sizes",
      { rows: [2, 3], price: undefined, sizes: [{ label: "60 سم", price: "450" }] },
      "size_mixed",
    ],
    [
      "two sizes equal apart from case and spacing",
      {
        rows: [2, 3],
        price: undefined,
        sizes: [
          { label: "Large", price: "1" },
          { label: " large ", price: "2" },
        ],
      },
      "size_duplicate",
    ],
    ["a repeated colour", { colours: ["ذهبي", "ذهبي "] }, "colour_duplicate"],
    [
      "13 colours",
      { colours: Array.from({ length: 13 }, (_, i) => `لون ${i}`) },
      "too_many_colours",
    ],
    ["a Latin only name", { name: "Lamp" }, "name_invalid"],
    [
      "a spec label the template does not have",
      { specs: [{ label: "الوزن", value: "2" }] },
      "invalid",
    ],
  ])("refuses %s as %s", (_, fields, problem) => {
    expect(refusal(product(fields))).toBe(problem);
  });

  it("refuses 13 sizes as too_many_sizes", () => {
    const rows = Array.from({ length: 13 }, (_, i) => i + 2);
    const sizes = rows.map((row) => ({ label: `مقاس ${row}`, price: "10" }));
    expect(refusal(product({ rows, sizes, price: undefined }))).toBe("too_many_sizes");
  });

  it("refuses a spec label given twice", () => {
    const specs = [
      { label: "القدرة", value: "40 واط" },
      { label: "القدرة", value: "60 واط" },
    ];
    expect(refusal(product({ specs }))).toBe("invalid");
  });

  it("refuses a product with no row number or a header row number", () => {
    expect(refusal(product({ rows: [] }))).toBe("invalid");
    expect(refusal(product({ rows: [1] }))).toBe("invalid");
  });

  it("names `invalid` for an issue that is not a problem code", () => {
    expect(refusal({ code: "CH-1" })).toBe("invalid");
  });
});
