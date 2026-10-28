import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { historyEntries, type HistoryEvent } from "../admin-history";

// "سجل الطلب" (spec 0014 AC-6): what happened to the order, oldest first, each with its time on
// the shop's clock.
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
                  : t("eventCancelled", { actor: t(entry.actor) })}
            </span>
            <time dateTime={entry.at.toISOString()} className="type-small text-muted">
              {formatDateTime(entry.at)}
            </time>
          </li>
        ))}
      </ol>
    </Card>
  );
}
