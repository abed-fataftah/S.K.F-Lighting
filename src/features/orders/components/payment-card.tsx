import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/lib/money";
import { customerPaymentRows, paymentBadgeVariant, paymentState } from "../payment-state";

// The "الدفع" card (spec 0015 AC-11): cash on delivery, and what the owner has recorded so far, as
// amounts too (spec 0023 AC-12). A cancelled order has no badge, only the money owed back if any.
// Amounts only: no payment list, cheque detail, or note ever reaches the storefront.
export function PaymentCard({
  amountPaid,
  total,
  cancelled,
}: {
  readonly amountPaid: number;
  readonly total: number;
  readonly cancelled: boolean;
}) {
  const t = useTranslations("OrderPage");
  const state = paymentState(amountPaid, total);
  const rows = customerPaymentRows(cancelled, amountPaid, total);

  return (
    <Card data-testid="order-payment">
      <h2 className="type-lead">{t("paymentTitle")}</h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{t("paymentMethod")}</p>
        {cancelled ? null : (
          <Badge variant={paymentBadgeVariant(state)} data-state={state}>
            {t(`payment.${state}`)}
          </Badge>
        )}
      </div>
      {rows.length > 0 ? (
        <dl className="flex flex-col gap-1" data-testid="order-payment-amounts">
          {rows.map((row) => (
            <div key={row.key} className="flex justify-between gap-3">
              <dt>{t(row.key)}</dt>
              <dd data-testid={`order-payment-${row.key}`}>
                <Ltr>{formatPrice(row.amount)}</Ltr>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Card>
  );
}
