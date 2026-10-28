import { describe, expect, it } from "vitest";
import { cancelledLine, cancelProblem, customerCancelState } from "./customer-cancel";

// covers: AC-1, AC-6, AC-7 (spec 0016)

describe("customerCancelState", () => {
  it("allows every status before it leaves the shop while nothing is paid", () => {
    for (const status of ["new", "confirmed", "preparing", "ready"] as const) {
      expect(customerCancelState(status, 0)).toBe("allowed");
    }
  });

  it("sends a paid order to WhatsApp at any status before delivery", () => {
    for (const status of ["new", "confirmed", "preparing", "ready"] as const) {
      expect(customerCancelState(status, 1)).toBe("paid");
      expect(customerCancelState(status, 27_000)).toBe("paid");
    }
  });

  it("calls out for delivery shipped, also when it is paid", () => {
    expect(customerCancelState("out_for_delivery", 0)).toBe("shipped");
    expect(customerCancelState("out_for_delivery", 5_000)).toBe("shipped");
  });

  it("offers nothing for delivered and cancelled", () => {
    for (const paid of [0, 5_000]) {
      expect(customerCancelState("delivered", paid)).toBe("final");
      expect(customerCancelState("cancelled", paid)).toBe("final");
    }
  });
});

describe("cancelledLine", () => {
  it("reads as the customer's cancel for a guest, a customer, and an electrician", () => {
    expect(cancelledLine("guest")).toBe("byYou");
    expect(cancelledLine("customer")).toBe("byYou");
    expect(cancelledLine("electrician")).toBe("byYou");
  });

  it("reads as the shop's cancel for the owner, the system, and no one recorded", () => {
    expect(cancelledLine("admin")).toBe("byShop");
    expect(cancelledLine("system")).toBe("byShop");
    expect(cancelledLine(null)).toBe("byShop");
  });
});

describe("cancelProblem", () => {
  it("says the order changed for stale and not_allowed, and failed for the rest", () => {
    expect(cancelProblem("stale")).toBe("cancelChanged");
    expect(cancelProblem("not_allowed")).toBe("cancelChanged");
    expect(cancelProblem("invalid")).toBe("cancelFailed");
    expect(cancelProblem("not_found")).toBe("cancelFailed");
  });
});
