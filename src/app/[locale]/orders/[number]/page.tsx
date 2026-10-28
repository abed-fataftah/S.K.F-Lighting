import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { OrderTimeline, stepKey } from "@/features/orders/components/order-timeline";
import { PaymentCard } from "@/features/orders/components/payment-card";
import { currentStep, customerTimeline } from "@/features/orders/customer-timeline";
import { parseOrderNumberInput } from "@/features/orders/order-number";
import { getCustomerOrder } from "@/features/orders/server/customer-order";
import { statusBadgeVariant } from "@/features/orders/status";
import { formatDate } from "@/lib/format";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { getAdminAccess } from "@/server/auth/admin";
import { getClaims } from "@/server/auth/session";

// A broken `%` in the segment counts as a number the lookup does not accept (spec 0015 AC-7).
function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/orders/[number]">): Promise<Metadata> {
  const [{ number }, t] = await Promise.all([params, getTranslations("PageTitles")]);
  const parsed = parseOrderNumberInput(decodeSegment(number) ?? "");
  return {
    title: parsed ? t("order", { number: parsed }) : t("orderTrack"),
    robots: { index: false },
  };
}

/**
 * Where a visitor without this order's id goes (AC-7): a signed in owner to the dashboard order
 * (its guards take over), anyone else to the lookup with the number filled when it parses.
 * Guests cost no Auth call: the admin check runs only when the claims hold a `sub`.
 */
async function sendElsewhere(number: string | null): Promise<never> {
  if (number !== null && (await getClaims())?.sub) {
    const access = await getAdminAccess();
    if (access.kind === "admin" || access.kind === "needs_mfa") {
      redirect(routes.admin.order(number));
    }
  }
  const parsed = number === null ? null : parseOrderNumberInput(number);
  redirect(parsed ? routes.orderTrackWith(parsed) : routes.orderTrack);
}

// The customer's order page (spec 0015 AC-7 to AC-13, AC-16; docs/design/pages/order.md). It
// opens only for an order id this browser holds in `skf_placed` or `skf_tracked`; it renders on
// every request, and with no Suspense above it every redirect is a real 307.
export default async function OrderPage({ params }: PageProps<"/[locale]/orders/[number]">) {
  const { number: segment } = await params;
  const number = decodeSegment(segment);
  const order = number === null ? null : await getCustomerOrder(number);
  if (!order) return sendElsewhere(number);

  const [t, shell] = await Promise.all([getTranslations("OrderPage"), getTranslations("Shell")]);
  const timeline = customerTimeline(order.fulfilment, order.status);
  const current = timeline.kind === "path" ? currentStep(timeline.steps) : null;
  // W7 with the plain order number (AC-12), as the float sends on this path.
  const { whatsappNumber } = parsePublicEnv();
  const contactUrl = whatsappUrl(
    whatsappNumber,
    shell("whatsappMessages.order", { number: order.orderNumber }),
  );
  const receive =
    order.fulfilment === "pickup"
      ? t("pickup")
      : t("delivery", { zone: order.deliveryZoneName ?? "" });

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-5 pb-8">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="type-title-l" data-testid="order-heading">
            {t.rich("heading", {
              number: order.orderNumber,
              ltr: (chunks) => <Ltr>{chunks}</Ltr>,
            })}
          </h1>
          {current === null ? (
            <Badge variant="off" data-testid="order-status">
              {t("cancelled")}
            </Badge>
          ) : (
            <Badge variant={statusBadgeVariant(current)} data-testid="order-status">
              {t(`steps.${stepKey(current, order.fulfilment)}`)}
            </Badge>
          )}
        </div>
        <p className="type-small text-muted" data-testid="order-meta">
          {formatDate(order.placedAt)} · {receive}
        </p>
      </header>

      <OrderTimeline timeline={timeline} fulfilment={order.fulfilment} />

      <OrderSummary
        lines={order.lines}
        fulfilment={order.fulfilment}
        deliveryZoneName={order.deliveryZoneName}
        // The address and notes stay off this page (AC-10, AC-13): the zone line alone.
        city={null}
        address={null}
        pickupAddress={order.pickupAddress}
        notes={null}
        subtotal={order.subtotal}
        deliveryFee={order.deliveryFee}
        total={order.total}
      />

      <PaymentCard
        amountPaid={order.amountPaid}
        total={order.total}
        cancelled={timeline.kind === "cancelled"}
      />

      <ButtonLink
        variant="whatsapp"
        size="lg"
        href={contactUrl}
        target="_blank"
        rel="noopener"
        data-testid="order-contact"
      >
        <WhatsAppIcon />
        {t("contact")}
      </ButtonLink>
    </div>
  );
}
