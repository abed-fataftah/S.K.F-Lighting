import { describe, expect, it } from "vitest";
import { daysOf, parseStatsPeriod, resolveStatsPeriod } from "./period";

// covers: AC-1 (spec 0027): the period comes from ?period=, and anything else is 7d.
describe("parseStatsPeriod", () => {
  it.each(["today", "7d", "30d"] as const)("reads %s", (value) => {
    expect(parseStatsPeriod(value)).toBe(value);
  });

  it.each([undefined, "", "month", "custom", "90d", "7D"])("reads %j as 7d", (value) => {
    expect(parseStatsPeriod(value)).toBe("7d");
  });

  it("takes the first of repeated values", () => {
    expect(parseStatsPeriod(["30d", "today"])).toBe("30d");
  });
});

describe("resolveStatsPeriod", () => {
  const today = "2026-11-07";

  it("resolves today, and the last 7 and 30 shop days including today", () => {
    expect(resolveStatsPeriod("today", today)).toEqual({ preset: "today", from: today, to: today });
    expect(resolveStatsPeriod("7d", today)).toEqual({
      preset: "7d",
      from: "2026-11-01",
      to: today,
    });
    expect(resolveStatsPeriod("30d", today)).toEqual({
      preset: "30d",
      from: "2026-10-09",
      to: today,
    });
  });
});

describe("daysOf", () => {
  it("lists every day, both ends included, across a month end", () => {
    expect(daysOf({ from: "2026-10-30", to: "2026-11-02" })).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("lists one day for today", () => {
    expect(daysOf({ from: "2026-11-07", to: "2026-11-07" })).toEqual(["2026-11-07"]);
  });
});
