import { useTranslations } from "next-intl";
import { FilterChipLink } from "@/features/catalog/components/filter-chip-link";
import { formatDayKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import { STATS_PRESETS, type StatsPeriod } from "../period";

// The period choice (spec 0027 AC-1): three chip links, so the period lives in the address, then
// the resolved shop days every number on the page uses. The Reports chips, with fewer presets.
export function StatsPeriodChips({ period }: { readonly period: StatsPeriod }) {
  const t = useTranslations("Stats");

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t("periodLabel")} className="flex flex-wrap gap-2">
        {STATS_PRESETS.map((preset) => (
          <FilterChipLink
            key={preset}
            href={routes.admin.stats(preset)}
            current={period.preset === preset}
          >
            {t(`period.${preset}`)}
          </FilterChipLink>
        ))}
      </nav>
      <p className="type-small text-muted" data-testid="stats-range-line">
        {period.from === period.to
          ? formatDayKey(period.from)
          : t("periodRange", { from: formatDayKey(period.from), to: formatDayKey(period.to) })}
      </p>
    </div>
  );
}
