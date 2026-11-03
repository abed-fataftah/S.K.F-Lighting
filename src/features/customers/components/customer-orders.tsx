import { useTranslations } from "next-intl";
import Link from "next/link";
import { Ltr } from "@/components/ltr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { orderMoneyLine } from "@/features/orders/my-orders";
import type { MyOrderRow } from "@/features/orders/server/my-orders";
import { formatDate } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";

// "طلبات العميل" rows (spec 0019 AC-6): every status, newest first, each row anchored at
// `o-<position>` so load more lands on the first new one. The money line is My Orders' own.
export function CustomerOrdersTable({ rows }: { readonly rows: readonly MyOrderRow[] }) {
  const t = useTranslations("AdminCustomers");

  return (
    <Table aria-label={t("ordersLabel")} data-testid="customer-orders">
      <TableHeader>
        <TableRow>
          <TableHead>{t("orderNumber")}</TableHead>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead>{t("total")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((order) => {
          const money = orderMoneyLine(order.status, order.amountPaid, order.total);
          return (
            <TableRow
              key={order.number}
              id={`o-${order.position}`}
              className="scroll-mt-4"
              data-testid={`customer-order-${order.number}`}
            >
              <TableCell className="whitespace-nowrap">
                {/* Opening the order marks it seen, so a prefetch must not open it. */}
                <Link
                  href={routes.admin.order(order.number)}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center font-extrabold underline"
                >
                  <Ltr>{order.number}</Ltr>
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <time dateTime={order.placedAt.toISOString()}>{formatDate(order.placedAt)}</time>
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <span className="flex flex-col">
                  <Ltr>{formatPrice(order.total)}</Ltr>
                  {money.kind === "remaining" ? (
                    <span className="type-small text-muted" data-testid="customer-order-money">
                      {t.rich("moneyRemaining", {
                        price: formatPrice(money.amount),
                        ltr: (chunks) => <Ltr>{chunks}</Ltr>,
                      })}
                    </span>
                  ) : money.kind === "paid" ? (
                    <span className="type-small text-muted" data-testid="customer-order-money">
                      {t("moneyPaid")}
                    </span>
                  ) : null}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
