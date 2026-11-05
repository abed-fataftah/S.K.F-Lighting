import { describe, expect, it } from "vitest";
import { isOrderPagePath, REFRESH_EVERY_MS, shouldRefresh } from "./auto-refresh";

// covers: AC-16 (spec 0014)

const due = { lastAt: 0, now: REFRESH_EVERY_MS, visible: true, busy: false };

describe("shouldRefresh", () => {
  it("refreshes a visible, idle tab once a minute has passed", () => {
    expect(shouldRefresh(due)).toBe(true);
    expect(shouldRefresh({ ...due, now: REFRESH_EVERY_MS * 5 })).toBe(true);
  });

  it("waits under a minute, in a hidden tab, and while the owner is busy", () => {
    expect(shouldRefresh({ ...due, now: REFRESH_EVERY_MS - 1 })).toBe(false);
    expect(shouldRefresh({ ...due, visible: false })).toBe(false);
    expect(shouldRefresh({ ...due, busy: true })).toBe(false);
  });
});

describe("isOrderPagePath", () => {
  it("is true for one order's page only", () => {
    expect(isOrderPagePath("/admin/orders/26-00042")).toBe(true);
    expect(isOrderPagePath("/admin/orders")).toBe(false);
    expect(isOrderPagePath("/admin/orders/")).toBe(false);
    expect(isOrderPagePath("/admin/orders/26-00042/print")).toBe(false);
    expect(isOrderPagePath("/admin/products/26-00042")).toBe(false);
  });
});
