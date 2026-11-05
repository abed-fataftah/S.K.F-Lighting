import { describe, expect, it } from "vitest";
import { formatOrderNumber, isOrderNumber, orderYear, parseOrderNumberInput } from "./order-number";

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
  it("uses the shop's clock, where 22:30 UTC on 31 December is already the new year", () => {
    expect(orderYear(new Date("2026-12-31T22:30:00Z"))).toBe(2027);
  });

  it("keeps the old year until midnight on the shop's clock", () => {
    expect(orderYear(new Date("2026-12-31T21:59:59Z"))).toBe(2026);
  });

  it("follows summer time too (UTC+3)", () => {
    expect(orderYear(new Date("2026-07-01T12:00:00Z"))).toBe(2026);
  });
});

// covers: AC-1 (spec 0013)
describe("isOrderNumber", () => {
  it.each(["26-00042", "26-123456"])("accepts %s", (text) => {
    expect(isOrderNumber(text)).toBe(true);
  });

  it.each(["2600042", "26-0042", "26-00042x", " 26-00042", "", "٢٦-٠٠٠٤٢"])(
    "refuses %j",
    (text) => {
      expect(isOrderNumber(text)).toBe(false);
    },
  );
});

// covers: AC-2 (spec 0015)
describe("parseOrderNumberInput", () => {
  it.each([
    ["26-00042", "26-00042"],
    ["2600042", "26-00042"],
    ["٢٦-٠٠٠٤٢", "26-00042"],
    ["۲۶۰۰۰۴۲", "26-00042"],
    ["26 00042", "26-00042"],
    ["26–00042", "26-00042"],
    ["26−00042", "26-00042"],
    ["  26-00042‏ ", "26-00042"],
    ["27-100000", "27-100000"],
    ["123456789012", "12-3456789012"],
  ])("reads %j as %s", (raw, expected) => {
    expect(parseOrderNumberInput(raw)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "2600",
    "260004",
    "abc",
    "26/00042",
    "#26-00042",
    "1234567890123",
    "26-0004a",
  ])("refuses %j", (raw) => {
    expect(parseOrderNumberInput(raw)).toBeNull();
  });

  it("always gives a number isOrderNumber accepts", () => {
    expect(isOrderNumber(parseOrderNumberInput("2600042")!)).toBe(true);
  });
});
