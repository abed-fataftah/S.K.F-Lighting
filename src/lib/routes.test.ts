import { describe, expect, it } from "vitest";
import { routes } from "./routes";

// covers: AC-13 (spec 0004); AC-1 (spec 0006)
describe("routes.admin.ordersPage", () => {
  it("leaves page 1 plain", () => {
    expect(routes.admin.ordersPage(1)).toBe("/admin/orders");
    expect(routes.admin.ordersPage(2)).toBe("/admin/orders?page=2");
  });
});

describe("routes.admin.productsList", () => {
  it("keeps the plain list when nothing is filtered", () => {
    expect(routes.admin.productsList({})).toBe("/admin/products");
    expect(routes.admin.productsList({ q: "", filter: "all", page: 1 })).toBe("/admin/products");
  });

  it("puts every filter in the address, so they combine and can be shared", () => {
    const href = routes.admin.productsList({
      q: "ثريا 60",
      categoryId: "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607",
      filter: "hidden",
      page: 3,
    });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/admin/products");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "ثريا 60",
      categoryId: "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607",
      filter: "hidden",
      page: "3",
    });
  });
});

// covers: AC-8, AC-11 (spec 0008)
describe("category routes", () => {
  it("encodes Arabic slugs and keeps page 1 plain", () => {
    expect(routes.category("ثريات")).toBe(`/c/${encodeURIComponent("ثريات")}`);
    expect(routes.categoryPage("a", null)).toBe("/c/a");
    expect(routes.categoryPage("a", "b", 1)).toBe("/c/a/b");
    expect(routes.categoryPage("a", "b", 3)).toBe("/c/a/b?page=3");
  });

  it("jumps to the first new card on load more", () => {
    expect(routes.categoryMore("a", null, 2, 25)).toBe("/c/a?page=2#p-25");
  });
});

// covers: AC-5, AC-8 (spec 0010)
describe("filtered and search routes", () => {
  const filters = {
    sizes: ["60سم"],
    colours: ["ذهبي", "أسود"],
    min: 100,
    max: 200,
    available: true,
  };

  it("writes the filters in one fixed order, before the page", () => {
    const href = routes.categoryPage("a", null, 2, filters);
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/c/a");
    expect([...url.searchParams]).toEqual([
      ["size", "60سم"],
      ["colour", "ذهبي"],
      ["colour", "أسود"],
      ["min", "100"],
      ["max", "200"],
      ["available", "1"],
      ["page", "2"],
    ]);
  });

  it("keeps the filters on load more", () => {
    expect(routes.categoryMore("a", "b", 2, 25, { ...filters, colours: [] })).toBe(
      "/c/a/b?size=60%D8%B3%D9%85&min=100&max=200&available=1&page=2#p-25",
    );
  });

  it("puts q first on search, and an empty q is the prompt", () => {
    expect(routes.search()).toBe("/search");
    expect(routes.searchPage("")).toBe("/search");
    const url = new URL(routes.searchMore("ثريا 60", filters, 3, 49), "http://x");
    expect([...url.searchParams.keys()][0]).toBe("q");
    expect(url.searchParams.get("q")).toBe("ثريا 60");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.hash).toBe("#p-49");
  });
});

// covers: AC-6, AC-19 (spec 0009)
describe("routes.product", () => {
  it("is the bare page without a variant and adds ?v with one", () => {
    expect(routes.product("ثريا")).toBe(`/p/${encodeURIComponent("ثريا")}`);
    expect(routes.product("lamp", { variant: null })).toBe("/p/lamp");
    expect(routes.product("lamp", { variant: "0f8b6a52-3c7e-4c1a-9d1e-5b6f7a8c9d0e" })).toBe(
      "/p/lamp?v=0f8b6a52-3c7e-4c1a-9d1e-5b6f7a8c9d0e",
    );
  });
});
