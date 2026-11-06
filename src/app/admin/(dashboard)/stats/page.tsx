import { ChartLine } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StateCard } from "@/components/state-card";
import { SourcesSection } from "@/features/stats/components/sources-section";
import { ListSkeleton, VisitsSkeleton } from "@/features/stats/components/stats-skeletons";
import { StatsPeriodChips } from "@/features/stats/components/stats-period-chips";
import { TopProductsSection } from "@/features/stats/components/top-products-section";
import { VisitsSection } from "@/features/stats/components/visits-section";
import { parseStatsPeriod, resolveStatsPeriod } from "@/features/stats/period";
import { readStats } from "@/features/stats/server/queries";
import { shopDateKey } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Stats");
  return { title: t("metaTitle") };
}

// Visits (spec 0027). The period lives in the address. `readStats` checks the admin first, then
// starts the three Web Analytics calls at once; each section streams in, or fails, on its own.
export default async function AdminStatsPage({ searchParams }: PageProps<"/admin/stats">) {
  const preset = parseStatsPeriod((await searchParams).period);
  const period = resolveStatsPeriod(preset, shopDateKey(new Date()));
  const [t, stats] = await Promise.all([getTranslations("Stats"), readStats(period)]);

  return (
    <>
      <h1 className="type-display-s">{t("title")}</h1>
      <StatsPeriodChips period={period} />
      {stats === null ? (
        <StateCard
          icon={ChartLine}
          title={t("notSetUpTitle")}
          text={t("notSetUpText")}
          data-testid="stats-not-set-up"
        />
      ) : (
        <>
          <Suspense fallback={<VisitsSkeleton />}>
            <VisitsSection result={stats.visits} period={period} />
          </Suspense>
          <div className="flex flex-wrap items-start gap-3">
            <Suspense fallback={<ListSkeleton />}>
              <TopProductsSection result={stats.products} period={period} />
            </Suspense>
            <Suspense fallback={<ListSkeleton />}>
              <SourcesSection result={stats.sources} period={period} />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}
