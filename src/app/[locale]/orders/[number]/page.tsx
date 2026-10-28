import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/ltr";
import { OrderSummary } from "@/features/orders/components/order-summary";
import { parseOrderNumberInput } from "@/features/orders/order-number";
import { getCustomerOrder } from "@/features/orders/server/customer-order";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
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

  const t = await getTranslations("OrderPage");
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
        </div>
        <p className="type-small text-muted" data-testid="order-meta">
          {t("meta", { date: formatDate(order.placedAt), receive })}
        </p>
      </header>

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
    </div>
  );
}
