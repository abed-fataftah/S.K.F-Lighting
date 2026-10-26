import { describe, expect, it } from "vitest";
import { formatPrice, parseShekels, toShekelsInput } from "./money";

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

// covers: AC-2 (spec 0004), AC-9 (spec 0005)
describe("parseShekels", () => {
  it.each([
    ["20", 2000],
    ["19.9", 1990],
    ["19.90", 1990],
    ["19.05", 1905],
    ["0.01", 1],
    ["1250", 125_000],
    ["1,250", 125_000],
    ["1,000,000", 100_000_000],
    ["007", 700],
    [" 12 ", 1200],
  ])("%j is %d agorot", (text, agorot) => {
    expect(parseShekels(text)).toBe(agorot);
  });

  it.each([
    "",
    "0",
    "0.00",
    "-5",
    "19.999",
    "1.",
    ".5",
    "12,50",
    "1,2500",
    ",250",
    "1,000,000.01",
    "1000001",
    "9999999999",
    "١٢",
    "12 ₪",
    "1e3",
    "abc",
  ])("refuses %j", (text) => {
    expect(parseShekels(text)).toBeNull();
  });

  it("round trips with formatPrice", () => {
    expect(formatPrice(parseShekels("1,234.5") ?? 0)).toBe("₪1,234.50");
  });
});

// covers: AC-3, AC-4 (spec 0006)
describe("toShekelsInput", () => {
  it.each([
    [125_000, "1250"],
    [1990, "19.90"],
    [1905, "19.05"],
    [1, "0.01"],
    [100_000_000, "1000000"],
  ])("shows %i agorot as %j", (agorot, text) => {
    expect(toShekelsInput(agorot)).toBe(text);
  });

  it("reads back to the same amount", () => {
    for (const agorot of [1, 99, 100, 12_550, 99_999_999]) {
      expect(parseShekels(toShekelsInput(agorot))).toBe(agorot);
    }
  });

  it("refuses a fraction or a negative amount", () => {
    expect(() => toShekelsInput(1.5)).toThrow(RangeError);
    expect(() => toShekelsInput(-1)).toThrow(RangeError);
  });
});
