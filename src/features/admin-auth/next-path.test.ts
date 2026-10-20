import { describe, expect, it } from "vitest";
import { safeAdminNext } from "./next-path";

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
