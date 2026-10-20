import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/state-card";
import { ButtonLink } from "@/components/ui/button";
import { readCart } from "@/features/cart/server/queries";
import { CheckoutForm } from "@/features/checkout/components/checkout-form";
import { getCheckoutOptions } from "@/features/checkout/server/queries";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("checkout"), robots: { index: false } };
}

// Checkout (spec 0004 AC-6 to AC-9). The page reads cookies, so it renders on every request and
// each render makes a new idempotency key for this attempt.
export default async function CheckoutPage() {
  const [t, cartT, cart] = await Promise.all([
    getTranslations("Checkout"),
    getTranslations("Cart"),
    readCart(),
  ]);

  if (cart.lines.length === 0) {
    return (
      <div className="px-(--page-pad) pt-7 pb-8">
        <StateCard
          icon={ShoppingCart}
          heading="h1"
          title={cartT("emptyTitle")}
          text={cartT("emptyText")}
          actions={
            <ButtonLink size="lg" render={<Link href={routes.home} />}>
              {cartT("browse")}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const { zones, pickupAddress } = await getCheckoutOptions();

  return (
    <div className="flex flex-col gap-2.5 px-(--page-pad) pt-3 pb-8">
      <h1 className="type-title-l">{t("title")}</h1>
      <CheckoutForm
        cart={cart}
        zones={zones}
        pickupAddress={pickupAddress}
        idempotencyKey={crypto.randomUUID()}
      />
    </div>
  );
}
