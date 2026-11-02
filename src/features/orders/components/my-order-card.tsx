import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import { orderMoneyLine } from "../my-orders";
import type { MyOrderRow } from "../server/my-orders";
import { OrderStatusBadge } from "./status-badge";

// One order on My Orders (spec 0018 AC-3, AC-4; docs/design/pages/my-orders.md layout item 2): the
// number and status, the date and line count, the total with what is still owed, and the link.
export function MyOrderCard({ order }: { readonly order: MyOrderRow }) {
  const t = useTranslations("MyOrders");
  const money = orderMoneyLine(order.status, order.amountPaid, order.total);

  return (
    <Card id={`o-${order.position}`} className="scroll-mt-4" data-testid="my-order">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-lead" data-testid="my-order-number">
          <Ltr>{order.number}</Ltr>
        </h2>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="type-small text-muted" data-testid="my-order-meta">
          <time dateTime={order.placedAt.toISOString()}>{formatDate(order.placedAt)}</time> ·{" "}
          {t("count", { count: order.lineCount, shown: formatNumber(order.lineCount) })}
        </p>
        <div className="flex flex-col items-end gap-1">
          <p className="font-extrabold" data-testid="my-order-total">
            <Ltr>{formatPrice(order.total)}</Ltr>
          </p>
          {money.kind === "remaining" ? (
            <p className="type-small text-muted" data-testid="my-order-money">
              {t.rich("remaining", {
                price: formatPrice(money.amount),
                ltr: (chunks) => <Ltr>{chunks}</Ltr>,
              })}
            </p>
          ) : money.kind === "paid" ? (
            <p className="type-small text-muted" data-testid="my-order-money">
              {t("paid")}
            </p>
          ) : null}
        </div>
      </div>
      <ButtonLink
        variant="outline"
        className="w-full"
        render={<Link href={routes.order(order.number)} />}
        aria-label={t("viewLabel", { number: order.number })}
      >
        {t("view")}
      </ButtonLink>
    </Card>
  );
}
