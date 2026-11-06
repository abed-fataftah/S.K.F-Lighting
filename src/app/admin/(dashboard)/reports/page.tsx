import { ChartNoAxesColumn } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/state-card";
import { ButtonLink } from "@/components/ui/button";
import { CustomRangeForm } from "@/features/reports/components/custom-range-form";
import { KpiCards } from "@/features/reports/components/kpi-cards";
import { PeriodChips } from "@/features/reports/components/period-chips";
import { SalesChart } from "@/features/reports/components/sales-chart";
import { TopProductsTable } from "@/features/reports/components/top-products-table";
import { parseReportPeriod } from "@/features/reports/period";
import { bucketsFor, fillDaySeries, rollUpMonths } from "@/features/reports/series";
import { readSalesReport } from "@/features/reports/server/queries";
import { shopDateKey } from "@/lib/format";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminReports");
  return { title: t("metaTitle") };
}

// Sales reports (spec 0024; docs/design/pages/admin-reports.md). The period lives in the address;
// every number is read live by the counting rule in `salesSummaryInDb`, and a bad custom range
// shows its error while the page shows this month.
export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const today = shopDateKey(new Date());
  const { period, typed, errors } = parseReportPeriod(await searchParams, today);
  const [t, { summary, series, topProducts }] = await Promise.all([
    getTranslations("AdminReports"),
    readSalesReport(period),
  ]);
  const kind = bucketsFor(period);
  const days = fillDaySeries(series, period);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-display-s">{t("title")}</h1>
        <ButtonLink
          variant="outline"
          href={routes.admin.reportsExport(period)}
          data-testid="reports-export"
        >
          {t("export")}
        </ButtonLink>
      </div>
      <PeriodChips period={period}>
        {typed ? <CustomRangeForm typed={typed} errors={errors} today={today} /> : null}
      </PeriodChips>
      <KpiCards summary={summary} />
      {summary.orders === 0 ? (
        <StateCard icon={ChartNoAxesColumn} title={t("empty")} data-testid="reports-empty" />
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          <SalesChart
            buckets={kind === "month" ? rollUpMonths(days) : days}
            kind={kind}
            orders={summary.orders}
            sales={summary.sales}
            days={period}
          />
          <TopProductsTable products={topProducts} />
        </div>
      )}
    </>
  );
}
