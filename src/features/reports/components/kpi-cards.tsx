import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Ltr } from "@/components/ltr";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import type { SalesSummary } from "../server/queries";
import { averageOrderValue } from "../series";

function Kpi({
  label,
  value,
  note,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly note?: ReactNode;
  readonly testId: string;
}) {
  return (
    <Card className="gap-1" data-testid={testId}>
      <p className="type-small text-muted">{label}</p>
      <p className="type-kpi" data-testid={`${testId}-value`}>
        <Ltr>{value}</Ltr>
      </p>
      {note ? (
        <p className="type-small text-muted" data-testid={`${testId}-note`}>
          {note}
        </p>
      ) : null}
    </Card>
  );
}

// The four numbers (spec 0024 AC-5), in the design's grid: as many 12.5rem columns as fit.
export function KpiCards({ summary }: { readonly summary: SalesSummary }) {
  const t = useTranslations("AdminReports");
  const average = averageOrderValue(summary.sales, summary.orders);
  const outstanding = summary.sales - summary.collected;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-3">
      <Kpi
        testId="kpi-sales"
        label={t("sales")}
        value={formatPrice(summary.sales)}
        note={
          summary.deliveryFees > 0
            ? t("deliveryNote", { amount: formatPrice(summary.deliveryFees) })
            : undefined
        }
      />
      <Kpi
        testId="kpi-orders"
        label={t("orders")}
        value={formatNumber(summary.orders)}
        note={
          summary.cancelled > 0
            ? t("cancelledNote", {
                count: summary.cancelled,
                shown: formatNumber(summary.cancelled),
              })
            : undefined
        }
      />
      <Kpi
        testId="kpi-average"
        label={t("average")}
        value={average === null ? "—" : formatPrice(average)}
      />
      <Kpi
        testId="kpi-collected"
        label={t("collected")}
        value={formatPrice(summary.collected)}
        note={
          outstanding > 0 ? t("outstandingNote", { amount: formatPrice(outstanding) }) : undefined
        }
      />
    </div>
  );
}
