import Image from "next/image";
import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { CardAddToCart } from "@/features/cart/components/card-add-to-cart";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";
import type { CardProduct } from "../card-view";

const tones = [1, 2, 3, 4] as const;

// The product card (design.md section 7, spec 0008 AC-12), the same on the home grid and the
// category pages. The name link covers the photo and text; the add and WhatsApp buttons sit below
// it. Out of stock: the photo at 45%, the black label, a disabled button, the price muted, and the
// WhatsApp button asks about availability (W4) instead of the product (W3).
export function ProductCard({
  product,
  index,
  id,
  whatsappNumber,
  siteUrl,
}: {
  readonly product: CardProduct;
  readonly index: number;
  /** `p-<position>` on category pages, so "load more" can jump to the first new card. */
  readonly id?: string;
  readonly whatsappNumber: string;
  readonly siteUrl: string;
}) {
  const t = useTranslations("Catalog");
  const link = `${siteUrl}${routes.product(product.slug)}`;
  const whatsappText = product.inStock
    ? t("whatsappProduct", { name: product.name, code: product.code, options: "", link })
    : t("whatsappAvailability", { name: product.name, code: product.code, link });

  return (
    <article
      id={id}
      data-testid="product-card"
      className="flex w-full scroll-mt-4 flex-col overflow-hidden rounded-card border border-border bg-white"
    >
      <div className="relative flex flex-1 flex-col">
        <div className="relative h-(--h-card-image)">
          {product.imageKey ? (
            <Image
              src={product.imageKey}
              alt={product.name}
              fill
              sizes="(max-width: 480px) 50vw, 240px"
              className={cn("bg-product-1 object-cover", !product.inStock && "opacity-45")}
            />
          ) : (
            <ImagePlaceholder
              tone={tones[index % tones.length]}
              className={cn("h-full", !product.inStock && "opacity-45")}
            />
          )}
          {!product.inStock ? (
            <span className="absolute start-2 top-2 rounded-chip bg-ink px-2 py-1 type-caption font-extrabold text-white">
              {t("outOfStock")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3 pb-0">
          <h2 className="type-body font-extrabold">
            <Link
              href={routes.product(product.slug)}
              className="flex min-h-11 items-center rounded-btn after:absolute after:inset-0"
            >
              {product.name}
            </Link>
          </h2>
          <p className="type-caption text-muted">
            {t("codeLabel")} <Ltr>{product.code}</Ltr>
          </p>
          {product.chips.length ? (
            <ul className="flex flex-wrap gap-1" data-testid="card-chips">
              {product.chips.map((chip, chipIndex) => (
                <li key={chipIndex} className="max-w-full min-w-0">
                  <Badge variant="spec" className="block max-w-full truncate">
                    {chip}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-auto flex items-baseline justify-between gap-2 pt-1">
            {product.listPrice !== null ? (
              <span
                className={cn("type-lead", !product.inStock && "text-muted")}
                data-testid="card-price"
              >
                {product.pricesDiffer ? (
                  t.rich("from", {
                    price: formatPrice(product.listPrice),
                    ltr: (chunks) => <Ltr>{chunks}</Ltr>,
                  })
                ) : (
                  <Ltr>{formatPrice(product.listPrice)}</Ltr>
                )}
              </span>
            ) : (
              <span />
            )}
            <span
              className={cn(
                "type-caption font-bold",
                product.inStock ? "text-whatsapp" : "text-muted",
              )}
            >
              {product.inStock ? t("inStock") : t("outOfStock")}
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-start gap-1.5 p-3">
        {product.addVariantId ? (
          <CardAddToCart variantId={product.addVariantId} name={product.name} />
        ) : (
          <Button disabled className="flex-1">
            {t("outOfStock")}
          </Button>
        )}
        <ButtonLink
          variant="whatsapp"
          size="icon"
          href={whatsappUrl(whatsappNumber, whatsappText)}
          target="_blank"
          rel="noopener"
          aria-label={
            product.inStock
              ? t("askOnWhatsappLabel", { name: product.name })
              : t("askAvailabilityLabel", { name: product.name })
          }
        >
          <WhatsAppIcon />
        </ButtonLink>
      </div>
    </article>
  );
}
