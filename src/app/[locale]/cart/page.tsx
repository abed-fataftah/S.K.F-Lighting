import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { StateCard } from "@/components/state-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CartLineOptions } from "@/features/cart/components/cart-line-details";
import { LineQuantity, RemoveLineButton } from "@/features/cart/components/cart-line-actions";
import { readCart } from "@/features/cart/server/queries";
import { readActiveZones } from "@/features/checkout/server/checkout-options";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";
import { getDb } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("cart"), robots: { index: false } };
}

const NOTICE_ID = "cart-unsellable-notice";

// The cart (spec 0004 AC-4, AC-5; docs/design/pages/cart.md and cart-empty.md): live prices,
// a stepper and remove per line, and checkout blocked while a line cannot be sold.
export default async function CartPage() {
  const [t, catalog, shell, cart] = await Promise.all([
    getTranslations("Cart"),
    getTranslations("Catalog"),
    getTranslations("Shell"),
    readCart(),
  ]);
  const { whatsappNumber } = parsePublicEnv();

  if (cart.lines.length === 0) {
    return (
      <div className="px-(--page-pad) pt-7 pb-8">
        <StateCard
          icon={ShoppingCart}
          heading="h1"
          title={t("emptyTitle")}
          text={t("emptyText")}
          actions={
            <>
              <ButtonLink size="lg" render={<Link href={routes.home} />}>
                {t("browse")}
              </ButtonLink>
              <ButtonLink
                variant="whatsapp"
                size="lg"
                href={whatsappUrl(whatsappNumber, shell("whatsappMessages.help"))}
                target="_blank"
                rel="noopener"
              >
                <WhatsAppIcon />
                {t("ask")}
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  const zones = await readActiveZones(await getDb());
  const count = cart.lines.length;

  return (
    <div className="flex flex-col gap-2.5 px-(--page-pad) pt-3 pb-8">
      <header className="flex items-baseline justify-between gap-3 pb-1">
        <h1 className="type-title-l">{t("title")}</h1>
        <p className="type-small text-muted">{t("count", { count, shown: formatNumber(count) })}</p>
      </header>

      {cart.hasUnsellable ? (
        <Alert id={NOTICE_ID}>
          <AlertDescription>{t("unsellableNotice")}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="flex flex-col gap-2.5" data-testid="cart-lines">
        {cart.lines.map((line, index) => {
          const name = line.productName ?? t("missingName");
          return (
            <li key={line.variantId}>
              <Card className="flex-row gap-3">
                <ImagePlaceholder
                  tone={((index % 4) + 1) as 1 | 2 | 3 | 4}
                  className={cn(
                    "size-18 shrink-0 rounded-tile [&_svg]:size-8",
                    !line.sellable && "opacity-45",
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    {line.slug ? (
                      <Link
                        href={routes.product(line.slug)}
                        className="-mt-2.5 inline-flex min-h-11 items-center rounded-btn font-extrabold"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="font-extrabold">{name}</span>
                    )}
                    <RemoveLineButton variantId={line.variantId} name={name} />
                  </div>
                  <CartLineOptions line={line} />
                  {line.productCode ? (
                    <p className="type-caption text-muted">
                      {catalog("codeLabel")} <Ltr>{line.productCode}</Ltr>
                    </p>
                  ) : null}
                  {line.sellable ? (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <LineQuantity
                        variantId={line.variantId}
                        quantity={line.quantity}
                        name={name}
                      />
                      <span className="type-lead">
                        <Ltr>{formatPrice(line.lineTotal)}</Ltr>
                      </span>
                    </div>
                  ) : (
                    <p className="type-small font-bold text-muted">{t("lineUnavailable")}</p>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="mt-1">
        <dl className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <dt className="font-bold">{t("subtotal")}</dt>
            <dd className="type-lead" data-testid="cart-subtotal">
              <Ltr>{formatPrice(cart.subtotal)}</Ltr>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="font-bold">{t("delivery")}</dt>
            <dd className="flex flex-col items-end text-end type-small text-muted">
              <span>{t("deliveryNext")}</span>
              {zones.length > 0 ? (
                <span>
                  {zones.map((zone, i) => (
                    <span key={zone.id}>
                      {i > 0 ? " · " : null}
                      {zone.name} <Ltr>{formatPrice(zone.fee)}</Ltr>
                    </span>
                  ))}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
          {cart.hasUnsellable ? (
            <Button size="lg" disabled focusableWhenDisabled aria-describedby={NOTICE_ID}>
              {t("checkout")}
            </Button>
          ) : (
            <ButtonLink size="lg" render={<Link href={routes.checkout} />}>
              {t("checkout")}
            </ButtonLink>
          )}
          <ButtonLink variant="outline" size="lg" render={<Link href={routes.home} />}>
            {t("keepShopping")}
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
