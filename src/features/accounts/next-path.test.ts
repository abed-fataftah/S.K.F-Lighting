import { describe, expect, it } from "vitest";
import { safeStorefrontNext } from "./next-path";

// covers: AC-6 (spec 0017), AC-8 (spec 0018)

describe("safeStorefrontNext", () => {
  it.each([
    "/",
    "/cart",
    "/checkout",
    "/p/lamp?size=2",
    "/c/lamps#p-12",
    "/orders/26-00042",
    "/account",
    "/account/orders",
    "/search?q=%D8%AB%D8%B1%D9%8A%D8%A7",
    "/administrator",
  ])("keeps the storefront path %j, query and hash included", (next) => {
    expect(safeStorefrontNext(next)).toBe(next);
  });

  it.each([
    [undefined],
    [null],
    [""],
    ["cart"],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/%2F%2Fevil.example"],
    ["/%5Cevil.example"],
    ["/cart\tx"],
    ["/cart%09x"],
    ["/cart%0Ax"],
    ["/%E0%A4%A"],
    ["/admin"],
    ["/admin/orders"],
    ["/admin?x=1"],
    ["/%61dmin"],
    ["/./admin"],
    ["/cart/../admin/orders"],
    ["/auth/confirm"],
    ["/account/sign-in"],
    ["/account/sign-in?tab=register"],
    ["/" + "a".repeat(512)],
  ])("sends %j to My Orders", (next) => {
    expect(safeStorefrontNext(next)).toBe("/account/orders");
  });

  it("accepts exactly 512 characters", () => {
    const next = "/" + "a".repeat(511);
    expect(safeStorefrontNext(next)).toBe(next);
  });
});
