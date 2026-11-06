import { describe, expect, it } from "vitest";
import { checkReportDays, parseReportPeriod, resolvePeriod } from "./period";

// covers: AC-2, AC-3, AC-14 (spec 0024)

const TODAY = "2026-11-06";

describe("resolvePeriod", () => {
  it("resolves each preset to shop days, both ends included", () => {
    expect(resolvePeriod("today", TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(resolvePeriod("7d", TODAY)).toEqual({ from: "2026-10-31", to: TODAY });
    expect(resolvePeriod("30d", TODAY)).toEqual({ from: "2026-10-08", to: TODAY });
    expect(resolvePeriod("month", TODAY)).toEqual({ from: "2026-11-01", to: TODAY });
  });

  it("gives one day for this month on its first day", () => {
    expect(resolvePeriod("month", "2026-11-01")).toEqual({ from: "2026-11-01", to: "2026-11-01" });
  });

  it("crosses a year end", () => {
    expect(resolvePeriod("7d", "2027-01-03")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(resolvePeriod("30d", "2027-01-03")).toEqual({ from: "2026-12-05", to: "2027-01-03" });
  });

  it("holds a 31 day month to today", () => {
    expect(resolvePeriod("month", "2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(resolvePeriod("30d", "2026-12-31")).toEqual({ from: "2026-12-02", to: "2026-12-31" });
  });
});

describe("parseReportPeriod", () => {
  const month = { from: "2026-11-01", to: TODAY };

  it("means this month with no range, and with an unknown one, without an error", () => {
    for (const params of [{}, { range: "week" }, { range: ["year", "7d"] }]) {
      expect(parseReportPeriod(params, TODAY)).toEqual({
        period: { range: "month", ...month },
        typed: null,
        errors: {},
      });
    }
  });

  it("reads a preset and ignores days given with it", () => {
    expect(parseReportPeriod({ range: "7d", from: "2026-01-01", to: TODAY }, TODAY).period).toEqual(
      { range: "7d", from: "2026-10-31", to: TODAY },
    );
  });

  it("opens the custom chip on this month's days, prefilled, with no error", () => {
    for (const params of [{ range: "custom" }, { range: "custom", from: "", to: "" }]) {
      expect(parseReportPeriod(params, TODAY)).toEqual({
        period: { range: "custom", ...month },
        typed: month,
        errors: {},
      });
    }
  });

  it("uses a valid custom range", () => {
    const params = { range: "custom", from: "2026-03-02", to: "2026-04-10" };
    expect(parseReportPeriod(params, TODAY)).toEqual({
      period: { range: "custom", from: "2026-03-02", to: "2026-04-10" },
      typed: { from: "2026-03-02", to: "2026-04-10" },
      errors: {},
    });
  });

  it.each([
    [{ to: TODAY }, { from: "from_invalid" }, { from: "", to: TODAY }],
    [
      { from: "2026-02-30", to: TODAY },
      { from: "from_invalid" },
      { from: "2026-02-30", to: TODAY },
    ],
    [{ from: "2026-11-01" }, { to: "to_invalid" }, { from: "2026-11-01", to: "" }],
    [{ from: "2026-11-01", to: "6/11/2026" }, { to: "to_invalid" }, null],
    [{ from: "2026-11-01", to: "2026-11-07" }, { to: "future" }, null],
    [{ from: "2026-11-05", to: "2026-11-04" }, { from: "from_after_to" }, null],
    [{ from: "2025-01-01", to: "2026-01-02" }, { from: "too_long" }, null],
  ])("keeps the typed days, shows this month, and errs %j", (days, errors, typed) => {
    const result = parseReportPeriod({ range: "custom", ...days }, TODAY);
    expect(result.errors).toEqual(errors);
    expect(result.period).toEqual({ range: "custom", ...month });
    expect(result.typed).toEqual(typed ?? days);
  });

  it("reports only the first failure, in the AC-3 order", () => {
    // Both days are broken: the start is named first.
    expect(parseReportPeriod({ range: "custom", from: "x", to: "y" }, TODAY).errors).toEqual({
      from: "from_invalid",
    });
    // Past today and before the start: the future error comes first.
    expect(
      parseReportPeriod({ range: "custom", from: "2026-12-05", to: "2026-12-01" }, TODAY).errors,
    ).toEqual({ to: "future" });
  });
});

describe("checkReportDays", () => {
  it("passes exactly 366 days and fails 367", () => {
    expect(checkReportDays("2025-11-06", TODAY, TODAY)).toEqual({
      ok: true,
      days: { from: "2025-11-06", to: TODAY },
    });
    expect(checkReportDays("2025-11-05", TODAY, TODAY)).toEqual({
      ok: false,
      field: "from",
      code: "too_long",
    });
  });

  it("passes a range ending today, and one day", () => {
    expect(checkReportDays(TODAY, TODAY, TODAY).ok).toBe(true);
  });

  it("allows any past start", () => {
    expect(checkReportDays("2001-03-01", "2001-03-31", TODAY).ok).toBe(true);
  });
});
