import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { orderPaymentBadge } from "@/features/payments/ledger";
import type { OrderPaymentFilter } from "../admin-filters";
import type { OrderStatus } from "../status";

/** The `AdminOrders` label of each payment state, for the badge and the الدفع filter. */
export const PAYMENT_KEYS = {
  none: "paymentNone",
  partial: "paymentPartial",
  paid: "paymentPaid",
  refund_due: "paymentRefundDue",
} as const satisfies Readonly<Record<OrderPaymentFilter, string>>;

/** The orders list's الدفع cell (spec 0023 AC-11); empty on a cancelled order with nothing paid. */
export function PaymentBadge({
  status,
  amountPaid,
  total,
}: {
  readonly status: OrderStatus;
  readonly amountPaid: number;
  readonly total: number;
}) {
  const t = useTranslations("AdminOrders");
  const badge = orderPaymentBadge(status, amountPaid, total);
  if (!badge) return null;
  return (
    <Badge variant={badge.variant} data-state={badge.state} data-testid="order-payment-badge">
      {t(PAYMENT_KEYS[badge.state])}
    </Badge>
  );
}
