import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CancelBlocked } from "@/features/orders/components/cancel-blocked";
import { CustomerCancel } from "@/features/orders/components/customer-cancel";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { OrderTimeline, stepKey } from "@/features/orders/components/order-timeline";
import { PaymentCard } from "@/features/orders/components/payment-card";
import { RefreshOnRestore } from "@/features/orders/components/refresh-on-restore";
import { cancelledLine, customerCancelState } from "@/features/orders/customer-cancel";
import { currentStep, customerTimeline } from "@/features/orders/customer-timeline";
import { parseOrderNumberInput } from "@/features/orders/order-number";
import { getCustomerOrder } from "@/features/orders/server/customer-order";
import { statusBadgeVariant } from "@/features/orders/status";
import { getWhatsappNumber } from "@/features/shell/server/shop-contact";
import { formatDate } from "@/lib/format";
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

// The customer's order page (spec 0015 AC-7 to AC-13, AC-16; spec 0016 AC-2, AC-5, AC-7, AC-8;
// docs/design/pages/order.md). It
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
  // W7 with the plain order number (AC-12), as the float sends on this path; W6 after the
  // customer's own cancel, and the W6 request on an order they can no longer cancel (spec 0016).
  const whatsappNumber = await getWhatsappNumber();
  const message = (key: "order" | "cancelled" | "cancelRequest") =>
    whatsappUrl(whatsappNumber, shell(`whatsappMessages.${key}`, { number: order.orderNumber }));
  const notifyUrl = message("cancelled");
  const cancelState = customerCancelState(order.status, order.amountPaid);
  const cancelledBy = order.status === "cancelled" ? cancelledLine(order.cancelledBy) : null;
  const byYou = cancelledBy === "byYou";
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
          {/* One element for every status, so focus moved here survives the cancel (spec 0016). */}
          <Badge
            id="order-status"
            tabIndex={-1}
            variant={current === null ? "off" : statusBadgeVariant(current)}
            data-testid="order-status"
          >
            {current === null ? t("cancelled") : t(`steps.${stepKey(current, order.fulfilment)}`)}
          </Badge>
        </div>
        <p className="type-small text-muted" data-testid="order-meta">
          {formatDate(order.placedAt)} · {receive}
        </p>
      </header>

      <OrderTimeline
        timeline={timeline}
        fulfilment={order.fulfilment}
        cancelled={
          cancelledBy && order.cancelledAt ? { line: cancelledBy, at: order.cancelledAt } : null
        }
      />

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
        catalogSubtotal={order.catalogSubtotal}
        priceDiscount={order.priceDiscount}
      />

      <PaymentCard
        amountPaid={order.amountPaid}
        total={order.total}
        cancelled={timeline.kind === "cancelled"}
      />

      <ButtonLink
        variant="whatsapp"
        size="lg"
        href={byYou ? notifyUrl : message("order")}
        target="_blank"
        rel="noopener"
        data-testid="order-contact"
      >
        <WhatsAppIcon />
        {t(byYou ? "tellCancelled" : "contact")}
      </ButtonLink>

      {cancelState === "allowed" ? (
        <CustomerCancel
          orderId={order.id}
          number={order.orderNumber}
          status={order.status}
          notifyUrl={notifyUrl}
        />
      ) : cancelState === "shipped" || cancelState === "paid" ? (
        <CancelBlocked reason={cancelState} requestUrl={message("cancelRequest")} />
      ) : null}
      <RefreshOnRestore />
    </div>
  );
}
