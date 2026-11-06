// The report's period (spec 0024 AC-2, AC-3). Pure: the period lives in the address, read here
// against the shop's today (one `shopDateKey(new Date())` per request), so every number, the range
// line, and the export use the same shop days, both ends included.
import { addDaysToKey, isDateKey } from "@/lib/format";

export const REPORT_RANGES = ["today", "7d", "30d", "month", "custom"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];
export type ReportPreset = Exclude<ReportRange, "custom">;

/** Shop days `YYYY-MM-DD`, both ends included. */
export type ReportDays = { readonly from: string; readonly to: string };

export type ReportPeriod = ReportDays & { readonly range: ReportRange };

export type ReportPeriodError =
  "from_invalid" | "to_invalid" | "future" | "from_after_to" | "too_long";

/** A custom range's first failure and the field it shows under. */
export type ReportDaysProblem = {
  readonly field: "from" | "to";
  readonly code: ReportPeriodError;
};

/** At most one error, under its field (AC-3). */
export type ReportPeriodErrors = Partial<Record<"from" | "to", ReportPeriodError>>;

const NO_ERRORS: ReportPeriodErrors = {};

/** The longest custom range, from and to included. */
export const MAX_REPORT_DAYS = 366;

/** Above this many days the chart shows months instead of days (AC-6). */
export const MONTH_BUCKETS_AFTER = 62;

type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

const first = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === "string" ? value : value?.[0];

/** A preset as shop days against `today`. */
export function resolvePeriod(range: ReportPreset, today: string): ReportDays {
  switch (range) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDaysToKey(today, -6), to: today };
    case "30d":
      return { from: addDaysToKey(today, -29), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

/** A custom range's checks in the AC-3 order; the page and the export share them. */
export function checkReportDays(
  from: string | undefined,
  to: string | undefined,
  today: string,
): { readonly ok: true; readonly days: ReportDays } | ({ readonly ok: false } & ReportDaysProblem) {
  if (from === undefined || !isDateKey(from))
    return { ok: false, field: "from", code: "from_invalid" };
  if (to === undefined || !isDateKey(to)) return { ok: false, field: "to", code: "to_invalid" };
  // Keys compare as strings in calendar order.
  if (to > today) return { ok: false, field: "to", code: "future" };
  if (from > to) return { ok: false, field: "from", code: "from_after_to" };
  if (to > addDaysToKey(from, MAX_REPORT_DAYS - 1))
    return { ok: false, field: "from", code: "too_long" };
  return { ok: true, days: { from, to } };
}

/**
 * Reads the page's search params. `period` drives every number (this month whenever there is an
 * error); `typed` is what the custom form echoes back, unparsed, so the owner can fix it.
 */
export function parseReportPeriod(params: SearchParams, today: string) {
  const month = resolvePeriod("month", today);
  const range = REPORT_RANGES.find((option) => option === first(params.range)) ?? "month";
  if (range !== "custom") {
    return {
      period: { range, ...resolvePeriod(range, today) } as ReportPeriod,
      typed: null,
      errors: NO_ERRORS,
    };
  }
  // An empty field from the form counts as missing.
  const from = first(params.from) || undefined;
  const to = first(params.to) || undefined;
  // The chip itself opens on this month's days, with no error.
  if (from === undefined && to === undefined) {
    return { period: { range, ...month } as ReportPeriod, typed: month, errors: NO_ERRORS };
  }
  const typed: ReportDays = { from: from ?? "", to: to ?? "" };
  const checked = checkReportDays(from, to, today);
  return checked.ok
    ? { period: { range, ...checked.days } as ReportPeriod, typed, errors: NO_ERRORS }
    : {
        period: { range, ...month } as ReportPeriod,
        typed,
        errors: { [checked.field]: checked.code } as ReportPeriodErrors,
      };
}
