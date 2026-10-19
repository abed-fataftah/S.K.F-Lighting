import { describe, expect, it } from "vitest";
import { activeAdminLink, activeTab, adminLinks, storefrontTabs } from "./nav";

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

  it("lists the five tabs in the bar's order, with حسابي always going to the orders page", () => {
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

  it("lists the eight links in the handoff order", () => {
    expect(adminLinks.map((link) => link.id)).toEqual([
      "home",
      "orders",
      "customers",
      "reports",
      "products",
      "categories",
      "homepage",
      "settings",
    ]);
  });
});
