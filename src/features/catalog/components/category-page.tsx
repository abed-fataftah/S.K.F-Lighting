import { Lamp, SearchX } from "lucide-react";
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
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { parsePage } from "@/lib/paging";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { withTimeLimit } from "@/server/db/time-limit";
import {
  appliedChips,
  EMPTY_FILTERS,
  isFiltered,
  parseListFilters,
  serializeListFilters,
  toListFilters,
  type ListFilters,
} from "../list-filters";
import {
  CATEGORY_PAGE_SIZE,
  getCategoryHead,
  getCategoryList,
  type CategoryHead,
} from "../server/queries";
import { breadcrumbJsonLd, serializeJsonLd } from "../seo";
import { AppliedChips } from "./applied-chips";
import { FilterChipLink } from "./filter-chip-link";
import { FiltersScreen } from "./filters-screen";
import { HelpCard } from "./help-card";
import { GridSkeleton, ListMore, ProductGrid } from "./list-results";

// The category page (spec 0008 AC-8 to AC-13, AC-16; spec 0010 AC-13, AC-14; docs/design/pages/
// category.md) for `/c/<main>` and `/c/<main>/<sub>`. Both routes render this one server view.
// The quick head read (category, chips, unfiltered M) runs before anything streams, so an unknown
// or hidden category gets a real 404. The list (filter choices, resolved filters, filtered M, the
// cards) then loads under this page's own Suspense boundary with six skeleton cards; a route
// `loading.tsx` would start the stream first and fix the status at 200.

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
  /** Every search param: `page` and the filters (spec 0010 AC-8). */
  readonly params: Readonly<Record<string, string | string[] | undefined>>;
};

// Shared by the metadata and the page in one request.
const loadCategoryHead = cache((main: string, sub: string | null, page: number) =>
  withTimeLimit(
    () => getCategoryHead(decodeSlug(main), sub === null ? null : decodeSlug(sub), page),
    CATEGORY_READ_TIMEOUT_MS,
  ),
);

// The list under the head, shared by the metadata and the page in one request. Keyed on the
// serialized filters, which parse back to the same filters.
const loadCategoryList = cache(
  async (main: string, sub: string | null, page: number, filterQuery: string) => {
    const head = await loadCategoryHead(main, sub, page);
    if (!head.ok || !head.data) return null;
    const pageHead = head.data;
    return withTimeLimit(
      () => getCategoryList(pageHead, parseListFilters(new URLSearchParams(filterQuery))),
      CATEGORY_READ_TIMEOUT_MS,
    );
  },
);

const addressOf = (address: Address) => {
  const parsed = parseListFilters(address.params);
  return { page: parsePage(address.params.page), parsed, query: serializeListFilters(parsed) };
};

export async function categoryMetadata(address: Address): Promise<Metadata> {
  const { page, parsed, query } = addressOf(address);
  const result = await loadCategoryHead(address.main, address.sub, page);
  if (!result.ok || !result.data) return {};
  const data = result.data;
  const current = data.sub ?? data.main;
  const [t, meta] = await Promise.all([getTranslations("Categories"), getTranslations("Metadata")]);
  const { siteUrl } = parsePublicEnv();
  const unfiltered = `${siteUrl}${routes.categoryPage(data.main.slug, data.sub?.slug ?? null)}`;
  // A filter counts once resolved (spec 0010 AC-8); when the list read fails, the address decides.
  const list = isFiltered(parsed)
    ? await loadCategoryList(address.main, address.sub, page, query)
    : null;
  const filtered = list?.ok ? isFiltered(list.data.filters) : isFiltered(parsed);
  return {
    title: t("pageTitle", { name: current.name }),
    description: current.description ?? meta("description"),
    // A filtered list points at the unfiltered page 1 (spec 0010 AC-14). Pages 2 and up repeat
    // page 1 with more cards. Both stay out of the index, their links still followed.
    ...(filtered
      ? { robots: { index: false, follow: true }, alternates: { canonical: unfiltered } }
      : page > 1
        ? { robots: { index: false, follow: true } }
        : { alternates: { canonical: unfiltered } }),
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
  const { page, query, parsed } = addressOf(address);
  const result = await loadCategoryHead(address.main, address.sub, page);
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
              <FilterChipLink
                href={routes.categoryPage(mainSlug, null, 1, parsed)}
                current={!data.sub}
                check={false}
              >
                {t("all")}
              </FilterChipLink>
            </li>
            {data.chipSubs.map((sub) => (
              <li key={sub.slug}>
                <FilterChipLink
                  href={routes.categoryPage(mainSlug, sub.slug, 1, parsed)}
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
            <CategoryList address={address} pageHead={data} page={page} query={query} help={help} />
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

/**
 * The toolbar, the applied chips, the grid, and "load more" (spec 0008 AC-9 to AC-12, spec 0010
 * AC-13), or the filtered empty state, or the error card (toolbar and chips hidden) on a failure.
 */
async function CategoryList({
  address,
  pageHead,
  page,
  query,
  help,
}: {
  readonly address: Address;
  readonly pageHead: CategoryHead;
  readonly page: number;
  readonly query: string;
  readonly help: string;
}) {
  const [t, filtersText, result] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Filters"),
    loadCategoryList(address.main, address.sub, page, query),
  ]);
  const { whatsappNumber, siteUrl } = parsePublicEnv();
  if (!result?.ok) {
    console.error("getCategoryList: read failed", { error: result?.error ?? "failed" });
    return <PageErrorState title={t("errorTitle")} whatsappNumber={whatsappNumber} />;
  }
  const list = result.data;
  const mainSlug = pageHead.main.slug;
  const subSlug = pageHead.sub?.slug ?? null;
  const applied = toListFilters(list.filters);
  const hrefFor = (filters: ListFilters) => routes.categoryPage(mainSlug, subSlug, 1, filters);
  const shown = Math.min(list.page * CATEGORY_PAGE_SIZE, list.total);
  const hasMore = shown < list.total;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <FiltersScreen
          scope={{ kind: "category", main: mainSlug, sub: subSlug }}
          choices={list.choices}
          applied={applied}
          badge={appliedChips(list.filters).length}
          total={list.total}
        />
        <p role="status" className="type-small text-muted" data-testid="category-count">
          {t("count", { shown: formatNumber(list.total) })}
        </p>
      </div>
      <AppliedChips filters={list.filters} hrefFor={hrefFor} />

      {list.total > 0 ? (
        <>
          <ProductGrid
            products={list.products}
            page={list.page}
            whatsappNumber={whatsappNumber}
            siteUrl={siteUrl}
            testId="category-products"
          />
          <ListMore
            shownText={t("shownOf", {
              shown: formatNumber(shown),
              total: formatNumber(list.total),
            })}
            moreText={t("loadMore")}
            moreHref={
              hasMore
                ? routes.categoryMore(mainSlug, subSlug, list.page + 1, shown + 1, applied)
                : null
            }
            testId="category"
          />
        </>
      ) : (
        <EmptyState
          icon={SearchX}
          title={filtersText("emptyTitle")}
          text={filtersText("emptyText")}
          actions={
            <>
              <ButtonLink size="lg" render={<Link href={`${hrefFor(EMPTY_FILTERS)}#filters`} />}>
                {filtersText("clearFilters")}
              </ButtonLink>
              <ButtonLink variant="whatsapp" size="lg" href={help} target="_blank" rel="noopener">
                <WhatsAppIcon />
                {t("emptyAsk")}
              </ButtonLink>
            </>
          }
        />
      )}
    </>
  );
}
