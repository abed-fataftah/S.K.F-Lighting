import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { formatDayKey, formatDayShort, formatMonthKey, formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import type { ReportDays } from "../period";
import { axisLabelIndexes, barHeights, type SalesBucket } from "../series";

// Sales by day or month (spec 0024 AC-6), drawn on the server with plain elements: no chart
// library and no script. Bars grow from the block end and run from the inline start, so in right
// to left the first day is on the right. The bar area is at least 0.5rem a day (3rem a month, so
// every "11/2026" label fits under its bar), and its own box scrolls sideways when the card is
// narrower, so a bar never gets thinner than 6px. The picture is
// one `role="img"` with the totals; a visually hidden table holds every bar.
export function SalesChart({
  buckets,
  kind,
  orders,
  sales,
  days,
}: {
  readonly buckets: readonly SalesBucket[];
  readonly kind: "day" | "month";
  readonly orders: number;
  readonly sales: number;
  readonly days: ReportDays;
}) {
  const t = useTranslations("AdminReports");
  const title = kind === "month" ? t("byMonth") : t("byDay");
  const labelOf = kind === "month" ? formatMonthKey : formatDayShort;
  const heights = barHeights(buckets.map((bucket) => bucket.sales));
  const labelled = new Set(axisLabelIndexes(buckets.length));
  const summary = t("chartLabel", {
    count: orders,
    shown: formatNumber(orders),
    sales: formatPrice(sales),
    from: formatDayKey(days.from),
    to: formatDayKey(days.to),
  });

  return (
    // `relative` keeps the visually hidden table inside the card in right to left.
    <Card className="relative min-w-0 flex-[1_1_22rem]" data-testid="reports-chart">
      <h2 className="type-lead">{title}</h2>
      <div className="overflow-x-auto" role="region" aria-label={title} tabIndex={0}>
        <div
          role="img"
          aria-label={summary}
          className="flex flex-col gap-1.5"
          style={{ minInlineSize: `${buckets.length * (kind === "month" ? 3 : 0.5)}rem` }}
        >
          <div className="flex h-47.5 items-end gap-0.5 border-b border-control-border">
            {buckets.map((bucket, i) => (
              <div
                key={bucket.key}
                className="flex-1 bg-ink"
                data-testid="reports-bar"
                // Above 0, a bar keeps 2px so it never vanishes next to a large one.
                style={{ blockSize: bucket.sales > 0 ? `max(2px, ${heights[i] * 100}%)` : 0 }}
              />
            ))}
          </div>
          <div className="flex gap-0.5" aria-hidden>
            {buckets.map((bucket, i) => (
              <span
                key={bucket.key}
                className="flex flex-1 justify-center type-caption whitespace-nowrap text-muted"
              >
                {labelled.has(i) ? labelOf(bucket.key) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only" aria-label={title}>
        <thead>
          <tr>
            <th scope="col">{kind === "month" ? t("chartMonth") : t("chartDay")}</th>
            <th scope="col">{t("chartSales")}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.key}>
              <td>{labelOf(bucket.key)}</td>
              <td>{formatPrice(bucket.sales)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
