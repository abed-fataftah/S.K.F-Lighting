import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { paymentBadgeVariant, paymentState } from "../payment-state";

// The "الدفع" card (spec 0015 AC-11): cash on delivery, and what the owner has recorded so far. A
// cancelled order shows the method alone; refunds belong to the payments and returns features.
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
    </Card>
  );
}
