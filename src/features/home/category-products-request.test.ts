import { describe, expect, it } from "vitest";
import { CATEGORY_SLUG_MAX, readCategoryProductsRequest } from "./category-products-request";

// covers: AC-7, AC-11 (spec 0031)

const read = (query: string) => readCategoryProductsRequest(new URLSearchParams(query));

describe("readCategoryProductsRequest", () => {
  it("takes one category slug, tidied", () => {
    expect(read("category=lamps")).toEqual({ kind: "category", slug: "lamps" });
    expect(read(`category=${encodeURIComponent("  ثريات  ")}`)).toEqual({
      kind: "category",
      slug: "ثريات",
    });
  });

  it("refuses a missing, empty, or blank slug", () => {
    expect(read("")).toEqual({ kind: "bad_request" });
    expect(read("category=")).toEqual({ kind: "bad_request" });
    expect(read("category=%20%20")).toEqual({ kind: "bad_request" });
  });

  it("refuses a repeated param or any other param", () => {
    expect(read("category=a&category=b")).toEqual({ kind: "bad_request" });
    expect(read("category=a&page=2")).toEqual({ kind: "bad_request" });
    expect(read("main=a")).toEqual({ kind: "bad_request" });
  });

  it("takes up to 120 characters and refuses more", () => {
    expect(read(`category=${"a".repeat(CATEGORY_SLUG_MAX)}`).kind).toBe("category");
    expect(read(`category=${"a".repeat(CATEGORY_SLUG_MAX + 1)}`)).toEqual({ kind: "bad_request" });
  });
});
