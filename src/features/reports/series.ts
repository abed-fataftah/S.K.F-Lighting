// The report's derived numbers (spec 0024 AC-5, AC-6). Pure and in integer agorot: the average
// rounds without floats, and the chart's days and months are filled and rolled up here so the
// database reads only per shop day.
import { addDaysToKey } from "@/lib/format";
import { MONTH_BUCKETS_AFTER, type ReportDays } from "./period";

/** One bar: a day key `YYYY-MM-DD` or a month key `YYYY-MM`, and its sales in agorot. */
export type SalesBucket = { readonly key: string; readonly sales: number };

/** Sales ÷ orders to the nearest agora, half up, in integers only; null with no orders. */
export function averageOrderValue(sales: number, orders: number): number | null {
  if (orders === 0) return null;
  const numerator = 2 * sales + orders;
  const denominator = 2 * orders;
  // numerator minus its remainder is a multiple of the denominator, so this division is exact.
  return (numerator - (numerator % denominator)) / denominator;
}

/** Every shop day from `from` to `to` in order, a day with no row at 0. */
export function fillDaySeries(rows: readonly SalesBucket[], days: ReportDays): SalesBucket[] {
  const byDay = new Map(rows.map((row) => [row.key, row.sales]));
  const series: SalesBucket[] = [];
  for (let key = days.from; key <= days.to; key = addDaysToKey(key, 1)) {
    series.push({ key, sales: byDay.get(key) ?? 0 });
  }
  return series;
}

/** Days summed into months `YYYY-MM`, in order; a partial month holds only its days. */
export function rollUpMonths(series: readonly SalesBucket[]): SalesBucket[] {
  const months: SalesBucket[] = [];
  for (const { key, sales } of series) {
    const month = key.slice(0, 7);
    const last = months.at(-1);
    if (last?.key === month) months[months.length - 1] = { key: month, sales: last.sales + sales };
    else months.push({ key: month, sales });
  }
  return months;
}

/** Days, or months when the period is longer than `MONTH_BUCKETS_AFTER` days. */
export function bucketsFor(days: ReportDays): "day" | "month" {
  return days.to > addDaysToKey(days.from, MONTH_BUCKETS_AFTER - 1) ? "month" : "day";
}

/** Each value as a share (0 to 1) of the highest one; all 0 when every value is 0. */
export function barHeights(values: readonly number[]): number[] {
  const highest = Math.max(0, ...values);
  return values.map((value) => (highest === 0 ? 0 : value / highest));
}

/** Which bars carry a label: all up to 14, else every `ceil(n / 7)`th from the first. */
export function axisLabelIndexes(n: number): number[] {
  const step = n > 14 ? Math.ceil(n / 7) : 1;
  return Array.from({ length: Math.ceil(n / step) }, (_, i) => i * step);
}
