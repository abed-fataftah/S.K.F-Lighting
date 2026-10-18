import { describe, expect, it } from "vitest";
import { getPathname } from "./navigation";

// covers: DW-2 (spec 0001 Languages row: Arabic URLs carry no /ar prefix)
describe("getPathname", () => {
  it("builds the home link as / with no locale prefix", () => {
    expect(getPathname({ href: "/", locale: "ar" })).toBe("/");
  });

  it("builds storefront links without an /ar prefix", () => {
    expect(getPathname({ href: "/products/lamp", locale: "ar" })).toBe("/products/lamp");
  });

  it("keeps query strings on the link", () => {
    expect(getPathname({ href: { pathname: "/search", query: { q: "ثريا" } }, locale: "ar" })).toBe(
      "/search?q=%D8%AB%D8%B1%D9%8A%D8%A7",
    );
  });
});
