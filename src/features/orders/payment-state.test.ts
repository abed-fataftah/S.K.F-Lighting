import { describe, expect, it } from "vitest";
import { paymentBadgeVariant, paymentState } from "./payment-state";

// covers: AC-11 (spec 0015)
describe("paymentState", () => {
  it.each([
    [0, 25_000, "none", "off"],
    [1, 25_000, "partial", "proc"],
    [24_999, 25_000, "partial", "proc"],
    [25_000, 25_000, "paid", "ok"],
    [30_000, 25_000, "paid", "ok"],
  ] as const)("reads %i paid of %i as %s (%s)", (paid, total, state, variant) => {
    expect(paymentState(paid, total)).toBe(state);
    expect(paymentBadgeVariant(paymentState(paid, total))).toBe(variant);
  });
});
