import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/form-errors";
import { productFormSchema } from "./schemas";

// covers: AC-2 (spec 0004); AC-9, AC-11 (spec 0005)

const CATEGORY = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const valid = {
  name: "ثريا كريستال",
  code: " ch-1020 ",
  categoryId: CATEGORY,
  newCategoryName: "",
  price: "1,250",
};

const errorsOf = (input: Record<string, unknown>) => {
  const result = productFormSchema.safeParse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("productFormSchema", () => {
  it("trims and uppercases the code and reads the price as agorot", () => {
    expect(productFormSchema.parse(valid)).toEqual({
      name: "ثريا كريستال",
      code: "CH-1020",
      categoryId: CATEGORY,
      newCategoryName: undefined,
      price: 125_000,
    });
  });

  it.each([
    ["١٬٢٥٠", 125_000],
    ["١٩٫٩", 1990],
    ["1000000", 100_000_000],
  ])("reads the typed price %j", (price, agorot) => {
    expect(productFormSchema.parse({ ...valid, price }).price).toBe(agorot);
  });

  it.each(["0", "-3", "19.999", "1000000.01", "12,50", "abc"])("refuses the price %j", (price) => {
    expect(errorsOf({ ...valid, price }).price).toEqual({ code: "price_invalid" });
  });

  it("says required for an empty price or code", () => {
    expect(errorsOf({ ...valid, price: " " }).price).toEqual({ code: "required" });
    expect(errorsOf({ ...valid, code: "" }).code).toEqual({ code: "required" });
  });

  it.each(["-AB", "AB CD", "Ab_1", "A".repeat(31), "أ1"])("refuses the code %j", (code) => {
    expect(errorsOf({ ...valid, code }).code).toEqual({ code: "code_invalid" });
  });

  it("takes a code typed with Arabic digits", () => {
    expect(productFormSchema.parse({ ...valid, code: "ch-١٠٢٠" }).code).toBe("CH-1020");
  });

  it("asks for Arabic in the name and in a new category name", () => {
    expect(errorsOf({ ...valid, name: "Philips 60W" }).name).toEqual({ code: "arabic_required" });
    expect(errorsOf({ ...valid, newCategoryName: "Lamps" }).newCategoryName?.code).toBe(
      "arabic_required",
    );
  });

  it("checks name and category name lengths", () => {
    expect(errorsOf({ ...valid, name: "ث" }).name?.code).toBe("too_short");
    expect(errorsOf({ ...valid, name: "ث".repeat(121) }).name?.code).toBe("too_long");
    expect(errorsOf({ ...valid, newCategoryName: "ث".repeat(61) }).newCategoryName?.code).toBe(
      "too_long",
    );
  });

  it("needs a category or a new category name, shown beside other errors", () => {
    expect(errorsOf({ ...valid, categoryId: "", price: "0" })).toEqual({
      price: { code: "price_invalid" },
      categoryId: { code: "category_required" },
    });
    expect(
      productFormSchema.parse({ ...valid, categoryId: "", newCategoryName: " إنارة " }),
    ).toMatchObject({ categoryId: undefined, newCategoryName: "إنارة" });
  });
});
