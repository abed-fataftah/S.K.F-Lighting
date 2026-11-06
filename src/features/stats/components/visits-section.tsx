import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { StatsPeriod } from "../period";
import type { SectionResult } from "../server/queries";
import type { VisitsSummary } from "../shape";
import { SectionError } from "./section-error";
import { VisitsChart } from "./visits-chart";

function Total({
  label,
  value,
  testId,
}: {
  readonly label: string;
  readonly value: number;
  readonly testId: string;
}) {
  return (
    <div className="flex min-w-0 flex-[1_1_10rem] flex-col gap-1 rounded-card border border-border p-4">
      <p className="type-small text-muted">{label}</p>
      <p className="type-kpi" data-testid={testId}>
        {formatNumber(value)}
      </p>
    </div>
  );
}

// The visits section (spec 0027 AC-2): two totals, the estimate hint, and for 7 or 30 days one bar
// per shop day. No "unique visitors": a cookieless counter cannot tell people apart.
export async function VisitsSection({
  result,
  period,
}: {
  readonly result: Promise<SectionResult<VisitsSummary>>;
  readonly period: StatsPeriod;
}) {
  const [t, visits] = await Promise.all([getTranslations("Stats"), result]);
  if (!visits.ok) {
    return (
      <SectionError
        title={t("visitsTitle")}
        retryHref={routes.admin.stats(period.preset)}
        testId="stats-visits-error"
      />
    );
  }

  return (
    <Card className="flex flex-col gap-4" data-testid="stats-visits">
      <h2 className="type-lead">{t("visitsTitle")}</h2>
      <div className="flex flex-wrap gap-3">
        <Total label={t("pageViews")} value={visits.data.pageViews} testId="stats-page-views" />
        <Total label={t("visits")} value={visits.data.visits} testId="stats-visit-count" />
      </div>
      <p className="type-small text-muted">{t("estimateHint")}</p>
      {period.preset === "today" ? null : (
        <VisitsChart
          days={visits.data.days}
          pageViews={visits.data.pageViews}
          visits={visits.data.visits}
          period={period}
        />
      )}
    </Card>
  );
}
