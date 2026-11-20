import { describe, expect, it } from "vitest";
import {
  activeAdminLink,
  activeTab,
  adminLinks,
  fitCount,
  isCurrentCategory,
  splitCategories,
  storefrontTabs,
} from "./nav";

// covers: AC-16, AC-18 (spec 0003, Value sourcing)
describe("activeTab", () => {
  it.each([
    ["/", "home"],
    ["/cart", "cart"],
    ["/checkout", "cart"],
    ["/checkout/done/26-00042", "cart"],
    ["/c", "cats"],
    ["/c/chandeliers", "cats"],
    ["/c/chandeliers/crystal", "cats"],
    ["/p/gold-chandelier", "cats"],
    ["/search", "search"],
    ["/account/orders", "account"],
    ["/account/sign-in", "account"],
    ["/account", "account"],
    ["/account/reset-password", "account"],
    ["/orders/26-00042", "account"],
    ["/orders/track", "account"],
    ["/policies/terms", "home"],
    ["/no-such-page", "home"],
  ])("marks %s as %s", (path, tab) => {
    expect(activeTab(path)).toBe(tab);
  });

  it("matches a whole segment only: /cart is cart, not cats; /cartoon is home", () => {
    expect(activeTab("/cart")).toBe("cart");
    expect(activeTab("/cartoon")).toBe("home");
    expect(activeTab("/catalog")).toBe("home");
  });

  // covers: AC-8 (spec 0018)
  it("lists the five tabs in the bar's order, with حسابي always going to My Orders", () => {
    expect(storefrontTabs.map((tab) => tab.href)).toEqual([
      "/",
      "/c",
      "/cart",
      "/search",
      "/account/orders",
    ]);
  });
});

describe("activeAdminLink", () => {
  it("marks the dashboard home only on /admin itself", () => {
    expect(activeAdminLink("/admin")).toBe("home");
    expect(activeAdminLink("/admin/unknown")).toBeNull();
  });

  it.each([
    ["/admin/orders", "orders"],
    ["/admin/orders/26-00042", "orders"],
    ["/admin/products/new", "products"],
    ["/admin/products/import", "products"],
    ["/admin/homepage", "homepage"],
    ["/admin/settings", "settings"],
  ])("marks %s as %s", (path, link) => {
    expect(activeAdminLink(path)).toBe(link);
  });

  it("prefers the longest matching link", () => {
    // /admin/homepage starts with /admin but must not count as the dashboard home.
    expect(activeAdminLink("/admin/homepage/banners")).toBe("homepage");
  });

  it("lists the nine links in the handoff order, visits after reports", () => {
    expect(adminLinks.map((link) => link.id)).toEqual([
      "home",
      "orders",
      "customers",
      "reports",
      "stats",
      "products",
      "categories",
      "homepage",
      "settings",
    ]);
  });
});

// covers: AC-5 (spec 0029)
describe("isCurrentCategory", () => {
  it.each([
    ["/c/chandeliers", "chandeliers", true],
    ["/c/chandeliers/crystal", "chandeliers", true],
    ["/c/chandeliers-big", "chandeliers", false],
    ["/c", "chandeliers", false],
    ["/p/chandeliers", "chandeliers", false],
    ["/c/ثريات", "ثريات", true],
    [`/c/${encodeURIComponent("ثريات")}/كريستال`, "ثريات", true],
    ["/c/إنارة", "ثريات", false],
  ])("%s is %s's page: %s", (pathname, slug, expected) => {
    expect(isCurrentCategory(pathname, slug)).toBe(expected);
  });
});

describe("splitCategories", () => {
  const list = ["a", "b", "c", "d"] as const;

  it("shows the first ones in order and moves the rest to more", () => {
    expect(splitCategories(list, 3)).toEqual({ shown: ["a", "b", "c"], more: ["d"] });
  });

  it("shows them all when they fit", () => {
    expect(splitCategories(list, 6)).toEqual({ shown: list, more: [] });
  });

  it("moves them all to more when none fit", () => {
    expect(splitCategories(list, -1)).toEqual({ shown: [], more: list });
  });
});

// covers: AC-5 (spec 0029)
describe("fitCount", () => {
  const widths = [100, 80, 120, 90] as const;

  it("shows every link when they fit alone, with no room kept for more", () => {
    // 390 of links and 3 gaps of 4.
    expect(fitCount(widths, 402, 70, 4)).toBe(4);
  });

  it("keeps room for the more button once the links overflow", () => {
    // more (70) + 100 + 80 + 120 and three gaps = 382; the fourth link needs 94 more.
    expect(fitCount(widths, 401, 70, 4)).toBe(3);
    expect(fitCount(widths, 381, 70, 4)).toBe(2);
  });

  it("puts every link in more when not even the first fits beside it", () => {
    expect(fitCount(widths, 150, 70, 4)).toBe(0);
  });

  it("fits nothing into no room and everything of an empty list", () => {
    expect(fitCount(widths, 0, 70, 4)).toBe(0);
    expect(fitCount([], 0, 70, 4)).toBe(0);
  });

  it("never skips a long link to fit a shorter one after it", () => {
    expect(fitCount([50, 300, 40], 200, 60, 0)).toBe(1);
  });
});
