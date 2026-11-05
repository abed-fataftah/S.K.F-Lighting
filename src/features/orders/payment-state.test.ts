import { describe, expect, it } from "vitest";
import { customerPaymentRows, paymentBadgeVariant, paymentState } from "./payment-state";

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

// covers: AC-12 (spec 0023)
describe("customerPaymentRows", () => {
  it.each([
    [false, 0, 25_000, []],
    [
      false,
      10_000,
      25_000,
      [
        { key: "paidAmount", amount: 10_000 },
        { key: "remainingAmount", amount: 15_000 },
      ],
    ],
    [false, 25_000, 25_000, [{ key: "paidAmount", amount: 25_000 }]],
    [true, 0, 25_000, []],
    [true, 10_000, 25_000, [{ key: "refundDue", amount: 10_000 }]],
  ] as const)("cancelled %s, %i paid of %i", (cancelled, paid, total, rows) => {
    expect(customerPaymentRows(cancelled, paid, total)).toEqual(rows);
  });
});
