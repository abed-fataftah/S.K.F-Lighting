import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui/button";

// In place of the cancel button once the order is on its way or has a payment (spec 0016 AC-8): a
// note and a request on WhatsApp. Nothing is saved; the owner decides. Server rendered, so it
// works without JavaScript.
export function CancelBlocked({
  reason,
  requestUrl,
}: {
  readonly reason: "shipped" | "paid";
  /** "أريد إلغاء الطلب رقم ..." to the shop's WhatsApp. */
  readonly requestUrl: string;
}) {
  const t = useTranslations("OrderPage");

  return (
    <div className="flex flex-col gap-2" data-testid="cancel-blocked" data-reason={reason}>
      <p className="type-small text-muted">
        {t(reason === "shipped" ? "blockedShipped" : "blockedPaid")}
      </p>
      <ButtonLink
        variant="outline"
        size="lg"
        href={requestUrl}
        target="_blank"
        rel="noopener"
        data-testid="cancel-request"
      >
        {t("requestCancel")}
      </ButtonLink>
    </div>
  );
}
