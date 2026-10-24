import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { ProductAddToCart, ProductOptions } from "@/features/catalog/components/product-options";
import { ProductPrice } from "@/features/catalog/components/product-price";
import { ProductSelectionProvider } from "@/features/catalog/components/product-selection";
import { ProductWhatsApp } from "@/features/catalog/components/product-whatsapp";
import { applyRequestedVariant, parseRequestedVariant } from "@/features/catalog/product-view";
import { getProductPage } from "@/features/catalog/server/queries";
import { Link } from "@/i18n/navigation";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

// Arabic slugs arrive percent encoded (spec 0004, Value sourcing: slug lookup).
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// The page and its metadata share one read per request, keyed on the decoded slug (AC-16).
const loadProduct = (slug: string) => getProductPage(decodeSlug(slug));

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[slug]">): Promise<Metadata> {
  const product = await loadProduct((await params).slug);
  if (!product) return {};
  const t = await getTranslations("PageTitles");
  return { title: t("product", { name: product.name }) };
}

// The product page (spec 0009, docs/design/pages/product.md). It renders per request and awaits
// the read before anything streams, so an unlisted product gets a real 404 (no loading.tsx,
// AC-16). The server picks the first selection (honouring `?v`, AC-4); the choosing parts share
// one client selection island.
export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/[locale]/p/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const product = await loadProduct(slug);
  if (!product) notFound();
  const data = applyRequestedVariant(product, parseRequestedVariant(query.v));

  const t = await getTranslations("Catalog");
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  const { main, sub } = data.breadcrumb;

  return (
    <ProductSelectionProvider data={data}>
      <div className="flex flex-col px-(--page-pad) pt-2 pb-8">
        <Breadcrumb aria-label={t("breadcrumb")}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={routes.home} />}>{t("home")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={routes.category(main.slug)} />}>
                {main.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {sub ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href={routes.subcategory(main.slug, sub.slug)} />}>
                    {sub.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : null}
            <BreadcrumbItem>
              <BreadcrumbPage>{data.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="relative mt-2">
          <ImagePlaceholder
            className={cn("h-(--h-gallery) rounded-card", !data.inStock && "opacity-45")}
          />
          {!data.inStock ? (
            <span className="absolute start-3 top-3 rounded-chip bg-ink px-2 py-1 type-caption font-extrabold text-white">
              {t("outOfStock")}
            </span>
          ) : null}
        </div>

        <section className="flex flex-col gap-1.5 pt-5">
          <h1 className="type-title-m">{data.name}</h1>
          <p className="flex flex-wrap items-center gap-x-2 type-small text-muted">
            <span>
              {t("codeLabel")} <Ltr>{data.code}</Ltr>
            </span>
            <span
              className={cn("font-bold", data.inStock ? "text-whatsapp" : "text-muted")}
              data-testid="product-stock"
            >
              {data.inStock ? t("inStock") : t("outOfStock")}
            </span>
          </p>
          <ProductPrice />
        </section>

        <div className="mt-4 flex flex-col gap-4">
          <ProductOptions />
          <div className="flex flex-col gap-2.5">
            <ProductAddToCart />
            <ProductWhatsApp place="buy" whatsappNumber={whatsappNumber} siteUrl={siteUrl} />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {data.description ? (
            <Card>
              <h2 className="type-lead">{t("description")}</h2>
              <p className="whitespace-pre-line">{data.description}</p>
            </Card>
          ) : null}

          {data.specs.length > 0 ? (
            <Card>
              <h2 className="type-lead">{t("specs")}</h2>
              <dl className="flex flex-col">
                {data.specs.map((spec) => (
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
            <ProductWhatsApp place="help" whatsappNumber={whatsappNumber} siteUrl={siteUrl} />
          </Card>
        </div>
      </div>
    </ProductSelectionProvider>
  );
}
