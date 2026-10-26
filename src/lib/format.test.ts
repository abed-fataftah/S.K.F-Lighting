import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPhone,
  formatTime,
  SHOP_TIME_ZONE,
  shopYear,
} from "./format";
import { formatPrice } from "./money";

// covers: AC-1, AC-3 to AC-8, AC-16 (spec 0005)
const at = (iso: string) => new Date(iso);

// The invisible characters tidyText removes (AC-6, AC-10).
const HIDDEN = /[\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;
const WESTERN_ONLY = /^[^٠-٩۰-۹]*$/;

describe("SHOP_TIME_ZONE", () => {
  it("is the West Bank clock", () => {
    expect(SHOP_TIME_ZONE).toBe("Asia/Hebron");
  });
});

describe("formatDate", () => {
  it.each([
    ["2026-10-20T13:45:00Z", "20/10/2026"],
    ["2026-03-04T22:30:00Z", "05/03/2026"],
    ["2026-01-01T09:00:00Z", "01/01/2026"],
    ["2026-12-31T22:30:00Z", "01/01/2027"],
  ])("%s reads %s on the shop's clock", (iso, expected) => {
    expect(formatDate(at(iso))).toBe(expected);
  });

  it("throws on an invalid date", () => {
    expect(() => formatDate(new Date("nope"))).toThrow(RangeError);
  });
});

describe("formatTime", () => {
  it.each([
    ["2026-10-20T13:45:00Z", "4:45 م"],
    ["2026-10-19T21:05:00Z", "12:05 ص"],
    ["2026-10-20T09:00:00Z", "12:00 م"],
    ["2026-10-20T08:59:00Z", "11:59 ص"],
    ["2026-10-20T20:59:00Z", "11:59 م"],
  ])("%s reads %s", (iso, expected) => {
    expect(formatTime(at(iso))).toBe(expected);
  });

  it.each([
    ["2026-03-27T12:00:00Z", "2:00 م", "winter time, the day before the change"],
    ["2026-03-28T12:00:00Z", "3:00 م", "summer time from 28 March"],
    ["2026-10-23T12:00:00Z", "3:00 م", "still summer time on 23 October"],
    ["2026-10-24T12:00:00Z", "2:00 م", "winter time again, while Jerusalem still says 3:00"],
  ])("%s reads %s (%s)", (iso, expected) => {
    expect(formatTime(at(iso))).toBe(expected);
  });

  it("throws on an invalid date", () => {
    expect(() => formatTime(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("formatDateTime", () => {
  it("joins the date and the time with a middle dot", () => {
    expect(formatDateTime(at("2026-10-20T13:45:00Z"))).toBe("20/10/2026 · 4:45 م");
  });

  it("keeps the date and time on the same day near midnight", () => {
    expect(formatDateTime(at("2026-10-19T21:05:00Z"))).toBe("20/10/2026 · 12:05 ص");
  });

  it("throws on an invalid date", () => {
    expect(() => formatDateTime(new Date("nope"))).toThrow(RangeError);
  });
});

describe("shopYear", () => {
  it.each([
    ["2026-12-31T21:59:59Z", 2026],
    ["2026-12-31T22:00:00Z", 2027],
    ["2026-07-01T12:00:00Z", 2026],
  ])("%s is in %i on the shop's clock", (iso, year) => {
    expect(shopYear(at(iso))).toBe(year);
  });

  it("throws on an invalid date", () => {
    expect(() => shopYear(new Date("nope"))).toThrow(RangeError);
  });
});

describe("formatNumber", () => {
  it.each([
    [1250, "1,250"],
    [7, "7"],
    [0, "0"],
    [-0, "0"],
    [-3, "-3"],
    [999, "999"],
    [1000, "1,000"],
    [-1_234_567, "-1,234,567"],
    [Number.MAX_SAFE_INTEGER, "9,007,199,254,740,991"],
  ])("%d reads %s", (n, expected) => {
    expect(formatNumber(n)).toBe(expected);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "throws on %d",
    (n) => {
      expect(() => formatNumber(n)).toThrow(RangeError);
    },
  );

  it("throws on a string", () => {
    expect(() => formatNumber("12" as unknown as number)).toThrow(RangeError);
  });
});

describe("formatPhone", () => {
  it.each([
    ["+970599123456", "059 912 3456"],
    ["+972521234567", "052 123 4567"],
    ["+970561234567", "056 123 4567"],
  ])("%s reads %s", (e164, expected) => {
    expect(formatPhone(e164)).toBe(expected);
  });

  it.each(["0599123456", "+97022741234", "+1 202 555 0100", "", "+9705991234567"])(
    "returns %j unchanged",
    (value) => {
      expect(formatPhone(value)).toBe(value);
    },
  );
});

describe("no hidden marks and only Western digits (AC-1, AC-6)", () => {
  const instants = [
    "2026-10-20T13:45:00Z",
    "2026-10-19T21:05:00Z",
    "2026-03-28T12:00:00Z",
    "2026-10-24T12:00:00Z",
  ].map(at);
  const outputs = [
    ...instants.flatMap((d) => [formatDate(d), formatTime(d), formatDateTime(d)]),
    ...[0, 1, 99, 100, 1905, -5000, 125_000, 123_456_789].map(formatPrice),
    ...[0, -3, 1250, 1_000_000].map(formatNumber),
    formatPhone("+970599123456"),
  ];

  it.each(outputs)("%j has no invisible direction or format character", (text) => {
    expect(text).not.toMatch(HIDDEN);
    expect(text).toMatch(WESTERN_ONLY);
  });
});
