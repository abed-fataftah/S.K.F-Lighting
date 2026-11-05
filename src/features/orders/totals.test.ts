import { describe, expect, it } from "vitest";
import { computeLineTotal, computeOrderTotals } from "./totals";

// covers: AC-6 (spec 0002)
describe("computeLineTotal", () => {
  it.each([
    [12_500, 1, 12_500],
    [12_500, 3, 37_500],
    [0, 4, 0],
    [999, 0, 0],
  ])("unit price %i times quantity %i is %i agorot", (unitPrice, quantity, expected) => {
    expect(computeLineTotal(unitPrice, quantity)).toBe(expected);
  });

  it.each([
    [-1, 1],
    [1, -1],
    [10.5, 1],
    [10, 1.5],
    [Number.NaN, 1],
  ])("throws on a bad input (%d, %d), which is a bug in the caller", (unitPrice, quantity) => {
    expect(() => computeLineTotal(unitPrice, quantity)).toThrow(RangeError);
  });
});

describe("computeOrderTotals", () => {
  const lines = [
    { unitPrice: 12_500, quantity: 2 },
    { unitPrice: 3_000, quantity: 1 },
  ];

  it("adds the lines into the subtotal and the fee into the total", () => {
    expect(computeOrderTotals({ lines, deliveryFee: 2_000, discountTotal: 0 })).toEqual({
      subtotal: 28_000,
      total: 30_000,
    });
  });

  it("takes the discount off the total, not the subtotal", () => {
    expect(computeOrderTotals({ lines, deliveryFee: 2_000, discountTotal: 5_000 })).toEqual({
      subtotal: 28_000,
      total: 25_000,
    });
  });

  it("counts an adjusted unit price, so the totals follow a changed line", () => {
    const adjusted = [{ unitPrice: 10_000, quantity: 2 }, lines[1]];

    expect(computeOrderTotals({ lines: adjusted, deliveryFee: 0, discountTotal: 0 })).toEqual({
      subtotal: 23_000,
      total: 23_000,
    });
  });

  it("leaves returned units out of the subtotal", () => {
    const withReturn = [{ unitPrice: 12_500, quantity: 2, returnedQuantity: 1 }, lines[1]];

    expect(computeOrderTotals({ lines: withReturn, deliveryFee: 0, discountTotal: 0 })).toEqual({
      subtotal: 15_500,
      total: 15_500,
    });
  });

  it("gives zero for an order with no lines and no fee", () => {
    expect(computeOrderTotals({ lines: [], deliveryFee: 0, discountTotal: 0 })).toEqual({
      subtotal: 0,
      total: 0,
    });
  });

  it("allows a discount that brings the total to exactly 0", () => {
    expect(computeOrderTotals({ lines, deliveryFee: 0, discountTotal: 28_000 }).total).toBe(0);
  });

  it("throws when the discount would push the total below 0", () => {
    expect(() => computeOrderTotals({ lines, deliveryFee: 0, discountTotal: 28_001 })).toThrow(
      /below 0/,
    );
  });

  it("throws when more units are returned than were ordered", () => {
    const bad = [{ unitPrice: 100, quantity: 1, returnedQuantity: 2 }];

    expect(() => computeOrderTotals({ lines: bad, deliveryFee: 0, discountTotal: 0 })).toThrow(
      RangeError,
    );
  });

  it.each([
    { deliveryFee: -1, discountTotal: 0 },
    { deliveryFee: 0, discountTotal: -1 },
    { deliveryFee: 0.5, discountTotal: 0 },
  ])("throws on a bad fee or discount %o", (money) => {
    expect(() => computeOrderTotals({ lines, ...money })).toThrow(RangeError);
  });
});
