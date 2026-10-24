import { Lamp } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cache, Suspense } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { EmptyState } from "@/components/empty-state";
import { PageErrorState } from "@/components/error-state";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { parsePage } from "@/lib/paging";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { withTimeLimit } from "@/server/db/time-limit";
import {
  CATEGORY_PAGE_SIZE,
  getCategoryHead,
  getCategoryProducts,
  type CategoryHead,
} from "../server/queries";
import { breadcrumbJsonLd, serializeJsonLd } from "../seo";
import { FilterChipLink } from "./filter-chip-link";
import { FocusNewCard } from "./focus-new-card";
import { HelpCard } from "./help-card";
import { ProductCard } from "./product-card";

// The category page (spec 0008 AC-8 to AC-13, AC-16; docs/design/pages/category.md without the
// filter parts) for `/c/<main>` and `/c/<main>/<sub>`. Both routes render this one server view.
// The quick head read (category, chips, M) runs before anything streams, so an unknown or hidden
// category gets a real 404. The products then load under this page's own Suspense boundary with
// six skeleton cards; a route `loading.tsx` would start the stream first and fix the status at 200.

const CATEGORY_READ_TIMEOUT_MS = 3000;

// Arabic slugs arrive percent encoded; they match exactly after decoding (AC-8).
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

type Address = {
  readonly main: string;
  readonly sub: string | null;
  readonly page: string | string[] | undefined;
};

// Shared by the metadata and the page in one request.
const loadCategoryHead = cache((main: string, sub: string | null, page: number) =>
  withTimeLimit(
    () => getCategoryHead(decodeSlug(main), sub === null ? null : decodeSlug(sub), page),
    CATEGORY_READ_TIMEOUT_MS,
  ),
);

export async function categoryMetadata(address: Address): Promise<Metadata> {
  const page = parsePage(address.page);
  const result = await loadCategoryHead(address.main, address.sub, page);
  if (!result.ok || !result.data) return {};
  const data = result.data;
  const current = data.sub ?? data.main;
  const [t, meta] = await Promise.all([getTranslations("Categories"), getTranslations("Metadata")]);
  const { siteUrl } = parsePublicEnv();
  return {
    title: t("pageTitle", { name: current.name }),
    description: current.description ?? meta("description"),
    // Pages 2 and up repeat page 1 with more cards: kept out of the index, links still followed.
    ...(page > 1
      ? { robots: { index: false, follow: true } }
      : {
          alternates: {
            canonical: `${siteUrl}${routes.categoryPage(data.main.slug, data.sub?.slug ?? null)}`,
          },
        }),
  };
}

function breadcrumbItems(data: CategoryHead, homeName: string, siteUrl: string) {
  return [
    { name: homeName, url: `${siteUrl}${routes.home}` },
    { name: data.main.name, url: `${siteUrl}${routes.category(data.main.slug)}` },
    ...(data.sub
      ? [
          {
            name: data.sub.name,
            url: `${siteUrl}${routes.subcategory(data.main.slug, data.sub.slug)}`,
          },
        ]
      : []),
  ];
}

export async function CategoryPage({ address }: { readonly address: Address }) {
  const result = await loadCategoryHead(address.main, address.sub, parsePage(address.page));
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  const [t, catalog, shell] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Catalog"),
    getTranslations("Shell"),
  ]);
  const help = whatsappUrl(whatsappNumber, shell("whatsappMessages.help"));

  if (!result.ok) {
    console.error("getCategoryHead: read failed", { error: result.error });
    return (
      <div className="flex flex-col gap-4 px-(--page-pad) pt-5 pb-8">
        <PageErrorState heading="h1" title={t("errorTitle")} whatsappNumber={whatsappNumber} />
      </div>
    );
  }
  const data = result.data;
  if (!data) notFound();

  const mainSlug = data.main.slug;
  const subSlug = data.sub?.slug ?? null;
  const jsonLd = serializeJsonLd(breadcrumbJsonLd(breadcrumbItems(data, catalog("home"), siteUrl)));

  return (
    <div className="flex flex-col pb-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <Breadcrumb aria-label={catalog("breadcrumb")} className="px-(--page-pad) pt-2">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={routes.home} />}>{catalog("home")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {data.sub ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={routes.category(mainSlug)} />}>
                  {data.main.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{data.sub.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>{data.main.name}</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col gap-1 px-(--page-pad) pb-3">
        <h1 className="type-title-l">{(data.sub ?? data.main).name}</h1>
        {data.navSubs.length ? (
          <p className="type-small text-muted">{data.navSubs.map((sub) => sub.name).join("، ")}</p>
        ) : null}
      </header>

      {data.chipSubs.length ? (
        <nav aria-label={t("subsLabel")} className="overflow-x-auto px-(--page-pad) pb-1">
          <ul className="flex gap-2">
            <li>
              <FilterChipLink href={routes.category(mainSlug)} current={!data.sub} check={false}>
                {t("all")}
              </FilterChipLink>
            </li>
            {data.chipSubs.map((sub) => (
              <li key={sub.slug}>
                <FilterChipLink
                  href={routes.subcategory(mainSlug, sub.slug)}
                  current={sub.slug === subSlug}
                  check={false}
                >
                  {sub.name}
                </FilterChipLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="flex flex-col gap-3 px-(--page-pad) pt-3">
        {data.total > 0 ? (
          <Suspense fallback={<GridSkeleton />}>
            <CategoryProducts pageHead={data} />
          </Suspense>
        ) : (
          <EmptyState
            icon={Lamp}
            title={t("emptyTitle")}
            text={t("emptyText")}
            actions={
              <ButtonLink variant="whatsapp" size="lg" href={help} target="_blank" rel="noopener">
                <WhatsAppIcon />
                {t("emptyAsk")}
              </ButtonLink>
            }
          />
        )}
        <HelpCard href={help} />
      </div>
    </div>
  );
}

/** Six skeleton cards while the products load (AC-13). */
async function GridSkeleton() {
  const t = await getTranslations("Categories");
  return (
    <LoadingStatus label={t("loading")} className="grid grid-cols-2 gap-2.5">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-card border border-border bg-white"
        >
          <Skeleton className="h-(--h-card-image) rounded-none" />
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full rounded-btn" />
          </div>
        </div>
      ))}
    </LoadingStatus>
  );
}

/** The count, the grid, and "load more" (AC-9 to AC-12), or the error card when the read fails. */
async function CategoryProducts({ pageHead }: { readonly pageHead: CategoryHead }) {
  const [t, result] = await Promise.all([
    getTranslations("Categories"),
    withTimeLimit(() => getCategoryProducts(pageHead), CATEGORY_READ_TIMEOUT_MS),
  ]);
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  if (!result.ok) {
    console.error("getCategoryProducts: read failed", { error: result.error });
    return <PageErrorState title={t("errorTitle")} whatsappNumber={whatsappNumber} />;
  }
  const mainSlug = pageHead.main.slug;
  const subSlug = pageHead.sub?.slug ?? null;
  const shown = Math.min(pageHead.page * CATEGORY_PAGE_SIZE, pageHead.total);
  const hasMore = shown < pageHead.total;

  return (
    <>
      <FocusNewCard page={pageHead.page} />
      <p role="status" className="type-small text-muted" data-testid="category-count">
        {t("count", { shown: formatNumber(pageHead.total) })}
      </p>
      <ul className="grid grid-cols-2 gap-2.5" data-testid="category-products">
        {result.data.map((product, index) => (
          <li key={product.slug} className="flex">
            <ProductCard
              product={product}
              index={index}
              id={`p-${index + 1}`}
              whatsappNumber={whatsappNumber}
              siteUrl={siteUrl}
            />
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-stretch gap-3 pt-5.5">
        <p className="text-center type-small text-muted" data-testid="category-shown">
          {t("shownOf", { shown: formatNumber(shown), total: formatNumber(pageHead.total) })}
        </p>
        {hasMore ? (
          <ButtonLink
            variant="outline"
            size="lg"
            className="h-12"
            render={
              <Link
                href={routes.categoryMore(mainSlug, subSlug, pageHead.page + 1, shown + 1)}
                scroll={false}
              />
            }
            data-testid="category-more"
          >
            {t("loadMore")}
          </ButtonLink>
        ) : null}
      </div>
    </>
  );
}
