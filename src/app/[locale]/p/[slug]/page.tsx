import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { ButtonLink, Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { AddToCart } from "@/features/cart/components/add-to-cart";
import { getProductBySlug } from "@/features/catalog/server/queries";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/money";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

// Arabic slugs arrive percent encoded (spec 0004, Value sourcing: slug lookup).
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

const loadProduct = cache((slug: string) => getProductBySlug(decodeSlug(slug)));

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  if (!product) return {};
  const t = await getTranslations("PageTitles");
  return { title: t("product", { name: product.name }) };
}

// The product page (spec 0004 AC-3, docs/design/pages/product.md) for a simple product: no
// photos or options yet, so one placeholder image and the one variant the add button sells.
export default async function ProductPage({ params }: PageProps<"/[locale]/p/[slug]">) {
  const product = await loadProduct((await params).slug);
  if (!product) notFound();

  const t = await getTranslations("Catalog");
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  const link = `${siteUrl}${routes.product(product.slug)}`;
  const inStock = product.variant !== null;
  const options = [product.variant?.sizeLabel, product.variant?.colourName].filter(Boolean);
  const whatsappText = inStock
    ? t("whatsappProduct", {
        name: product.name,
        code: product.code,
        options: options.length ? ` ${options.join(" ")}` : "",
        link,
      })
    : t("whatsappAvailability", { name: product.name, code: product.code, link });

  return (
    <div className="flex flex-col gap-4 px-(--page-pad) pt-2 pb-8">
      <Breadcrumb aria-label={t("breadcrumb")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={routes.home} />}>{t("home")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {/* Category pages arrive with feature 9; until then the category is plain text. */}
          <BreadcrumbItem>{product.categoryName}</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="relative">
        <ImagePlaceholder
          className={cn("h-(--h-gallery) rounded-card", !inStock && "opacity-45")}
        />
        {!inStock ? (
          <span className="absolute start-3 top-3 rounded-chip bg-ink px-2 py-1 type-caption font-extrabold text-white">
            {t("outOfStock")}
          </span>
        ) : null}
      </div>

      <section className="flex flex-col gap-1.5 pt-1">
        <h1 className="type-title-m">{product.name}</h1>
        <p className="flex flex-wrap items-center gap-x-2 type-small text-muted">
          <span>
            {t("codeLabel")} <Ltr>{product.code}</Ltr>
          </span>
          <span className={cn("font-bold", inStock ? "text-whatsapp" : "text-muted")}>
            {inStock ? t("inStock") : t("outOfStock")}
          </span>
        </p>
        {product.price !== null ? (
          <p className="flex items-baseline gap-2">
            <span
              className={cn("type-price", !inStock && "text-muted")}
              data-testid="product-price"
            >
              <Ltr>{formatPrice(product.price)}</Ltr>
            </span>
            {product.variant?.sizeLabel ? (
              <span className="type-small text-muted">
                {t("sizeNote", { size: product.variant.sizeLabel })}
              </span>
            ) : null}
          </p>
        ) : null}
      </section>

      <Card>
        {product.variant ? (
          <AddToCart variantId={product.variant.id} />
        ) : (
          <Button size="lg" disabled>
            {t("outOfStock")}
          </Button>
        )}
        <ButtonLink
          variant="whatsapp"
          size="lg"
          href={whatsappUrl(whatsappNumber, whatsappText)}
          target="_blank"
          rel="noopener"
        >
          <WhatsAppIcon />
          {inStock ? t("orderOnWhatsapp") : t("askAvailability")}
        </ButtonLink>
      </Card>

      {product.description ? (
        <Card>
          <h2 className="type-lead">{t("description")}</h2>
          <p className="whitespace-pre-line">{product.description}</p>
        </Card>
      ) : null}

      {product.specs.length > 0 ? (
        <Card>
          <h2 className="type-lead">{t("specs")}</h2>
          <dl className="flex flex-col">
            {product.specs.map((spec) => (
              <div
                key={spec.label}
                className="flex justify-between gap-3 border-b border-border py-2 last:border-b-0"
              >
                <dt className="text-muted">{spec.label}</dt>
                <dd className="font-bold">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      <Card className="items-start">
        <h2 className="type-lead">{t("helpTitle")}</h2>
        <p className="text-muted">{t("helpText")}</p>
        <ButtonLink
          variant="whatsapp"
          href={whatsappUrl(whatsappNumber, whatsappText)}
          target="_blank"
          rel="noopener"
        >
          <WhatsAppIcon />
          {t("helpButton")}
        </ButtonLink>
      </Card>
    </div>
  );
}
