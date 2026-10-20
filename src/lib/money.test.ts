import { describe, expect, it } from "vitest";
import { formatPrice } from "./money";

// covers: AC-2 (spec 0005)
describe("formatPrice", () => {
  it.each([
    [2000, "₪20"],
    [125_000, "₪1,250"],
    [1990, "₪19.90"],
    [1905, "₪19.05"],
    [0, "₪0"],
    [-0, "₪0"],
    [1, "₪0.01"],
    [99, "₪0.99"],
    [100, "₪1"],
    [-5000, "-₪50"],
    [-1905, "-₪19.05"],
    [123_456_789, "₪1,234,567.89"],
    [Number.MAX_SAFE_INTEGER, "₪90,071,992,547,409.91"],
  ])("%d agorot reads %s", (agorot, expected) => {
    expect(formatPrice(agorot)).toBe(expected);
  });

  it("uses an ASCII hyphen minus for a negative amount", () => {
    expect(formatPrice(-5000).charCodeAt(0)).toBe(0x2d);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "throws on %d",
    (agorot) => {
      expect(() => formatPrice(agorot)).toThrow(RangeError);
    },
  );

  it("throws on a string", () => {
    expect(() => formatPrice("2000" as unknown as number)).toThrow(RangeError);
  });
});
