import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { historyEntries, type HistoryEvent } from "../admin-history";

// "سجل الطلب" (spec 0014 AC-6): what happened to the order, oldest first, each with its time on
// the shop's clock. A price save shows its totals and the owner's private note (spec 0022 AC-8).
export function OrderHistory({ events }: { readonly events: readonly HistoryEvent[] }) {
  const t = useTranslations("AdminOrders");
  const entries = historyEntries(events);

  return (
    <Card>
      <h2 className="type-title-s">{t("history")}</h2>
      <ol className="flex flex-col gap-2.5" data-testid="order-history">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col border-s-2 border-ink ps-3">
            <span className="font-bold">
              {entry.kind === "created"
                ? t("eventCreated")
                : entry.kind === "moved"
                  ? t("eventMoved", { actor: t(entry.actor), status: t(`status.${entry.status}`) })
                  : entry.kind === "prices"
                    ? t.rich("eventPrices", {
                        from: formatPrice(entry.from),
                        to: formatPrice(entry.to),
                        count: formatNumber(entry.count),
                        ltr: (chunks) => <Ltr>{chunks}</Ltr>,
                      })
                    : t("eventCancelled", { actor: t(entry.actor) })}
            </span>
            {entry.kind === "prices" && entry.note ? (
              <span className="break-words text-muted" data-testid="order-history-note">
                {entry.note}
              </span>
            ) : null}
            <time dateTime={entry.at.toISOString()} className="type-small text-muted">
              {formatDateTime(entry.at)}
            </time>
          </li>
        ))}
      </ol>
    </Card>
  );
}
