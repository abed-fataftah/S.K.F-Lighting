import { Check } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FocusHeading } from "@/components/focus-heading";
import { Ltr } from "@/components/ltr";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyOrderNumber } from "@/features/checkout/components/copy-order-number";
import { WhatsAppHandoff } from "@/features/checkout/components/whatsapp-handoff";
import { getPlacedOrder } from "@/features/checkout/server/queries";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { buildNewOrderMessage } from "@/features/orders/whatsapp-message";
import { Link } from "@/i18n/navigation";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("confirmation"), robots: { index: false } };
}

// A broken `%` in the segment is a 404, never a server error (spec 0013 AC-2).
function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

// The confirmation (spec 0004 AC-11, AC-12; spec 0013; docs/design/pages/confirmation.md). Opens only in the
// browser whose `skf_placed` cookie holds the order; anyone else gets the not found page.
export default async function ConfirmationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/checkout/done/[number]">) {
  const [{ number }, query] = await Promise.all([params, searchParams]);
  const orderNumber = decodeSegment(number);
  if (orderNumber === null) notFound();
  const order = await getPlacedOrder(orderNumber);
  if (!order) notFound();

  const [t, messageT] = await Promise.all([
    getTranslations("Confirmation"),
    getTranslations("OrderMessage"),
  ]);
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  const text = buildNewOrderMessage(order, {
    siteUrl,
    whatsappNumber,
    t: (key, values) => messageT(key, values),
  });
  const url = whatsappUrl(whatsappNumber, text);

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-5 pb-8">
      <WhatsAppHandoff orderId={order.id} url={url} autoOpen={query.wa === "1"} />

      <Card className="items-center gap-3 px-5 py-7 text-center">
        <span className="flex size-18 items-center justify-center rounded-full border-2 border-ink bg-yellow text-ink">
          <Check aria-hidden className="size-9" strokeWidth={3} />
        </span>
        <FocusHeading className="type-title-l">{t("title")}</FocusHeading>
        <p className="text-muted">{t("numberLabel")}</p>
        <p
          data-testid="order-number"
          className="rounded-tile border border-dashed border-ink px-5 py-2 type-price"
        >
          <Ltr>{order.orderNumber}</Ltr>
        </p>
        <CopyOrderNumber number={order.orderNumber} />
        <p data-testid="order-phone">
          {t.rich("phoneLine", {
            phone: order.customerPhone,
            ltr: (chunks) => <Ltr>{chunks}</Ltr>,
          })}
        </p>
        <p className="type-small text-muted">{t("keep")}</p>
      </Card>

      <Card>
        <h2 className="type-lead">{t("nextTitle")}</h2>
        <ol className="flex list-inside list-decimal flex-col gap-2">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ol>
      </Card>

      <div className="flex flex-col gap-2.5">
        <ButtonLink
          variant="whatsapp"
          size="lg"
          href={url}
          target="_blank"
          rel="noopener"
          data-testid="open-whatsapp"
        >
          <WhatsAppIcon />
          {t("openWhatsapp")}
        </ButtonLink>
        <ButtonLink variant="outline" size="lg" render={<Link href={routes.home} />}>
          {t("back")}
        </ButtonLink>
      </div>

      <OrderSummary
        lines={order.lines}
        fulfilment={order.fulfilment}
        deliveryZoneName={order.deliveryZoneName}
        city={order.city}
        address={order.address}
        pickupAddress={order.pickupAddress}
        notes={order.notes}
        subtotal={order.subtotal}
        deliveryFee={order.deliveryFee}
        total={order.total}
      />
    </div>
  );
}
