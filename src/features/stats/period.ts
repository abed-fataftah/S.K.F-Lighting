// The stats page's period (spec 0027 AC-1). Pure: `?period=` is read here against the shop's today,
// and resolved to shop days with the Reports rule, so `7d` means the same days on both pages.
import { addDaysToKey } from "@/lib/format";
import { resolvePeriod, type ReportDays, type ReportPreset } from "@/features/reports/period";

export const STATS_PRESETS = ["today", "7d", "30d"] as const;
export type StatsPreset = Extract<ReportPreset, (typeof STATS_PRESETS)[number]>;

/** The page opens on the last 7 shop days. */
export const DEFAULT_STATS_PERIOD: StatsPreset = "7d";

export type StatsPeriod = ReportDays & { readonly preset: StatsPreset };

type ParamValue = string | readonly string[] | undefined;

/** `?period=` as a preset; missing or unknown is `7d`. */
export function parseStatsPeriod(value: ParamValue): StatsPreset {
  const raw = typeof value === "string" ? value : value?.[0];
  return STATS_PRESETS.find((preset) => preset === raw) ?? DEFAULT_STATS_PERIOD;
}

export function resolveStatsPeriod(preset: StatsPreset, today: string): StatsPeriod {
  return { preset, ...resolvePeriod(preset, today) };
}

/** Every shop day from `from` to `to`, both included, oldest first. */
export function daysOf(days: ReportDays): readonly string[] {
  const list: string[] = [];
  for (let day = days.from; day <= days.to; day = addDaysToKey(day, 1)) list.push(day);
  return list;
}
