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
