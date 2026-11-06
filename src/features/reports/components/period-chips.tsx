import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FilterChipLink } from "@/features/catalog/components/filter-chip-link";
import { formatDayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { REPORT_RANGES, type ReportPeriod } from "../period";

// The period choice (spec 0024 AC-2): five chip links, so the period lives in the address and works
// without script, then the custom form when it is chosen (`children`), then a line stating the
// resolved shop days every number on the page uses.
export function PeriodChips({
  period,
  children,
}: {
  readonly period: ReportPeriod;
  readonly children?: ReactNode;
}) {
  const t = useTranslations("AdminReports");

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t("periodLabel")} className="flex flex-wrap gap-2">
        {REPORT_RANGES.map((range) => (
          // The custom chip opens on this month's days, without typed ones.
          <FilterChipLink
            key={range}
            href={routes.admin.reportsFor({ range })}
            current={period.range === range}
          >
            {t(`range.${range}`)}
          </FilterChipLink>
        ))}
      </nav>
      {children}
      <p className="type-small text-muted" data-testid="reports-range-line">
        {period.from === period.to
          ? formatDayKey(period.from)
          : t("periodRange", { from: formatDayKey(period.from), to: formatDayKey(period.to) })}
      </p>
    </div>
  );
}
