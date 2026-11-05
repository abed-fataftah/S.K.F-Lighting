import { useTranslations } from "next-intl";
import Link from "next/link";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatPhone } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import type { AdminOrderRow } from "../server/admin-queries";
import { PaymentBadge } from "./payment-badge";
import { OrderStatusBadge } from "./status-badge";

// The orders table (spec 0014 AC-8), shared by the server rendered list and the client phone
// search results, so it holds no server code. An unseen order carries a yellow dot with hidden
// text; a customer's cancellation also shows "ألغاه العميل". الدفع shows where the money stands
// (spec 0023 AC-11).
export function OrdersTable({
  rows,
  label,
  testId = "admin-orders",
}: {
  readonly rows: readonly AdminOrderRow[];
  readonly label: string;
  readonly testId?: string;
}) {
  const t = useTranslations("AdminOrders");

  return (
    <Table aria-label={label} data-testid={testId}>
      <TableHeader>
        <TableRow>
          <TableHead>{t("number")}</TableHead>
          <TableHead>{t("customer")}</TableHead>
          <TableHead>{t("phone")}</TableHead>
          <TableHead>{t("type")}</TableHead>
          <TableHead>{t("method")}</TableHead>
          <TableHead>{t("statusColumn")}</TableHead>
          <TableHead>{t("paymentColumn")}</TableHead>
          <TableHead>{t("total")}</TableHead>
          <TableHead>{t("date")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((order) => (
          <TableRow key={order.number} data-testid={`order-row-${order.number}`}>
            <TableCell className="whitespace-nowrap">
              <span className="flex items-center gap-2">
                {order.isUnseen ? (
                  <span data-testid="order-unseen">
                    <span
                      aria-hidden
                      className="block size-2.5 rounded-full border border-ink bg-yellow"
                    />
                    <span className="sr-only">{t("unseen")}</span>
                  </span>
                ) : null}
                {/* Opening the order marks it seen, so a prefetch must not open it. */}
                <Link
                  href={routes.admin.order(order.number)}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center font-extrabold underline"
                >
                  <Ltr>{order.number}</Ltr>
                </Link>
              </span>
            </TableCell>
            <TableCell>{order.name}</TableCell>
            <TableCell className="whitespace-nowrap">
              <Ltr>{formatPhone(order.phoneE164)}</Ltr>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {order.placedByRole === "electrician" ? t("typeElectrician") : t("typeCustomer")}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {order.fulfilment === "delivery" ? t("delivery") : t("pickup")}
            </TableCell>
            <TableCell>
              <span className="flex flex-wrap items-center gap-1.5">
                <OrderStatusBadge status={order.status} />
                {order.cancelledByCustomer ? (
                  <Badge variant="new">{t("cancelledByCustomer")}</Badge>
                ) : null}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <PaymentBadge
                status={order.status}
                amountPaid={order.amountPaid}
                total={order.total}
              />
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Ltr>{formatPrice(order.total)}</Ltr>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <time dateTime={order.placedAt.toISOString()}>{formatDateTime(order.placedAt)}</time>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
