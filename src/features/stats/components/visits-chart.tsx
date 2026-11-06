import { useTranslations } from "next-intl";
import { formatDayKey, formatDayShort, formatNumber } from "@/lib/format";
import type { ReportDays } from "@/features/reports/period";
import { axisLabelIndexes, barHeights } from "@/features/reports/series";
import type { VisitsDay } from "../shape";

// Page views by shop day (spec 0027 AC-2), drawn like the Reports sales chart: plain elements, no
// script, bars from the block end, the first day at the inline start (the right in right to
// left). The picture is one `role="img"` with the totals; a visually hidden table holds every day.
export function VisitsChart({
  days,
  pageViews,
  visits,
  period,
}: {
  readonly days: readonly VisitsDay[];
  readonly pageViews: number;
  readonly visits: number;
  readonly period: ReportDays;
}) {
  const t = useTranslations("Stats");
  const heights = barHeights(days.map((day) => day.pageViews));
  const labelled = new Set(axisLabelIndexes(days.length));
  const summary = t("chartLabel", {
    pageViews: formatNumber(pageViews),
    visits: formatNumber(visits),
    from: formatDayKey(period.from),
    to: formatDayKey(period.to),
  });

  return (
    // `relative` keeps the visually hidden table inside the section in right to left.
    <div className="relative flex flex-col gap-2" data-testid="stats-chart">
      <h3 className="type-body font-extrabold">{t("byDay")}</h3>
      <div className="overflow-x-auto" role="region" aria-label={t("byDay")} tabIndex={0}>
        <div
          role="img"
          aria-label={summary}
          className="flex flex-col gap-1.5"
          style={{ minInlineSize: `${days.length * 0.5}rem` }}
        >
          <div className="flex h-40 items-end gap-0.5 border-b border-control-border">
            {days.map((day, i) => (
              <div
                key={day.day}
                className="flex-1 bg-ink"
                data-testid="stats-bar"
                data-value={day.pageViews}
                // Above 0, a bar keeps 2px so it never vanishes next to a large one.
                style={{ blockSize: day.pageViews > 0 ? `max(2px, ${heights[i] * 100}%)` : 0 }}
              />
            ))}
          </div>
          <div className="flex gap-0.5" aria-hidden>
            {days.map((day, i) => (
              <span
                key={day.day}
                className="flex flex-1 justify-center type-caption whitespace-nowrap text-muted"
              >
                {labelled.has(i) ? formatDayShort(day.day) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only" aria-label={t("byDay")}>
        <thead>
          <tr>
            <th scope="col">{t("chartDay")}</th>
            <th scope="col">{t("pageViews")}</th>
            <th scope="col">{t("visits")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.day}>
              <td>{formatDayShort(day.day)}</td>
              <td>{formatNumber(day.pageViews)}</td>
              <td>{formatNumber(day.visits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
