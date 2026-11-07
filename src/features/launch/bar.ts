// The launch bar (spec 0028 AC-14): what a page's median Lighthouse run on a simulated phone must
// reach before launch. Scores are Lighthouse's own 0 to 1; times are milliseconds.

export const LAUNCH_BAR = {
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  performance: 0.8,
  accessibility: 0.95,
} as const;

/** One median run. A null is a number Lighthouse could not measure, which never passes. */
export type PageMetrics = {
  readonly lcpMs: number | null;
  readonly cls: number | null;
  readonly tbtMs: number | null;
  readonly performance: number | null;
  readonly accessibility: number | null;
};

export type Measure = keyof PageMetrics;

export type Verdict = { readonly pass: boolean; readonly failures: readonly Measure[] };

const atMost = (value: number | null, limit: number) => value !== null && value <= limit;
const atLeast = (value: number | null, limit: number) => value !== null && value >= limit;

/** Passes only when all five measures meet the bar; exactly at a limit passes. */
export function judgePage(metrics: PageMetrics): Verdict {
  const checks: readonly (readonly [Measure, boolean])[] = [
    ["lcpMs", atMost(metrics.lcpMs, LAUNCH_BAR.lcpMs)],
    ["cls", atMost(metrics.cls, LAUNCH_BAR.cls)],
    ["tbtMs", atMost(metrics.tbtMs, LAUNCH_BAR.tbtMs)],
    ["performance", atLeast(metrics.performance, LAUNCH_BAR.performance)],
    ["accessibility", atLeast(metrics.accessibility, LAUNCH_BAR.accessibility)],
  ];
  const failures = checks.filter(([, ok]) => !ok).map(([measure]) => measure);
  return { pass: failures.length === 0, failures };
}
