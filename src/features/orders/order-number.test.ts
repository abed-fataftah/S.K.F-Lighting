import { describe, expect, it } from "vitest";
import { formatOrderNumber, orderYear } from "./order-number";

// covers: AC-7 (spec 0002)
describe("formatOrderNumber", () => {
  it.each([
    [2026, 42, "26-00042"],
    [2026, 1, "26-00001"],
    [2027, 99_999, "27-99999"],
    [2027, 100_000, "27-100000"],
    [2105, 7, "05-00007"],
  ])("year %i, sequence %i reads %s", (year, seq, expected) => {
    expect(formatOrderNumber(year, seq)).toBe(expected);
  });

  it.each([0, -1, 1.5, Number.NaN])("throws on sequence %d", (seq) => {
    expect(() => formatOrderNumber(2026, seq)).toThrow(RangeError);
  });

  it.each([26, 20_260, 2026.5])("throws on a year that is not four digits (%d)", (year) => {
    expect(() => formatOrderNumber(year, 1)).toThrow(RangeError);
  });
});

describe("orderYear", () => {
  it("uses the shop's time zone, so 00:30 on 1 January in Jerusalem is already the new year", () => {
    expect(orderYear(new Date("2026-12-31T22:30:00Z"))).toBe(2027);
  });

  it("keeps the old year until midnight in Jerusalem", () => {
    expect(orderYear(new Date("2026-12-31T21:59:59Z"))).toBe(2026);
  });

  it("follows summer time too (UTC+3)", () => {
    expect(orderYear(new Date("2026-07-01T12:00:00Z"))).toBe(2026);
  });
});
