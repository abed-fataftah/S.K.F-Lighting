import { describe, expect, it } from "vitest";
import { safeAdminNext, withNext } from "./next-path";

// covers: AC-1 (spec 0004)
describe("safeAdminNext", () => {
  it.each([
    "/admin",
    "/admin/orders",
    "/admin/orders/26-00042",
    "/admin/orders?page=2",
    "/admin/products/new",
  ])("keeps %j", (next) => {
    expect(safeAdminNext(next)).toBe(next);
  });

  it.each([
    null,
    undefined,
    "",
    "//evil.com",
    "/admin//evil.com",
    "/admin\\x",
    "/admin/\\evil.com",
    "https://evil.com/admin",
    "javascript:alert(1)",
    "/adminx",
    "/",
    "/cart",
    "admin/orders",
    "/admin/\norders",
  ])("sends %j to the orders list", (next) => {
    expect(safeAdminNext(next)).toBe("/admin/orders");
  });
});

describe("withNext", () => {
  it("carries a dashboard path, encoded", () => {
    expect(withNext("/admin/login", "/admin/orders?page=2")).toBe(
      "/admin/login?next=%2Fadmin%2Forders%3Fpage%3D2",
    );
    expect(withNext("/admin/mfa", "/admin/orders/26-00042")).toBe(
      "/admin/mfa?next=%2Fadmin%2Forders%2F26-00042",
    );
  });

  it("keeps the orders list when it was asked for", () => {
    expect(withNext("/admin/mfa", "/admin/orders")).toBe("/admin/mfa?next=%2Fadmin%2Forders");
  });

  it.each([null, undefined, "", "//evil.com", "/cart"])("leaves %j off", (next) => {
    expect(withNext("/admin/login", next)).toBe("/admin/login");
  });
});
