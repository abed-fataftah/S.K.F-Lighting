import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { EmptyState } from "@/components/empty-state";
import { PageErrorState } from "@/components/error-state";
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
  isFiltered,
  parseListFilters,
  toListFilters,
  type ListFilters,
} from "../list-filters";
import { readSearchRequest, type SearchTerms } from "../search-text";
import { CATEGORY_PAGE_SIZE, getSearchList } from "../server/queries";
import { AppliedChips } from "./applied-chips";
import { FiltersScreen } from "./filters-screen";
import { HelpCard } from "./help-card";
import { ListMore, ProductGrid } from "./list-results";
import { RemoveChipLink } from "./remove-chip-link";

// The search page (spec 0010 AC-1 to AC-6, AC-14; docs/design/pages/search.md) for `/search`.
// Without a searchable `q` it is the prompt and reads nothing. Otherwise the list view inside a 3
// second limit gives the filter choices, the resolved filters, M, the clamped page, and the
// cards. `loading.tsx` shows while it runs.

const SEARCH_READ_TIMEOUT_MS = 3000;

type Params = Readonly<Record<string, string | string[] | undefined>>;

export async function searchMetadata(): Promise<Metadata> {
  const t = await getTranslations("Search");
  // Every form of `/search` stays out of the index, its links still followed (AC-14).
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

const query = (chunks: ReactNode) => <bdi>{chunks}</bdi>;

export async function SearchPage({ params }: { readonly params: Params }) {
  const request = readSearchRequest(params.q);
  const { whatsappNumber } = parsePublicEnv();
  const shell = await getTranslations("Shell");
  const help = whatsappUrl(whatsappNumber, shell("whatsappMessages.help"));

  if (request.kind !== "search") {
    return <SearchPrompt short={request.kind === "short"} help={help} />;
  }
  return (
    <SearchResults
      terms={request}
      parsed={parseListFilters(params)}
      page={parsePage(params.page)}
      help={help}
    />
  );
}

async function SearchPrompt({ short, help }: { readonly short: boolean; readonly help: string }) {
  const t = await getTranslations("Search");
  return (
    <div className="flex flex-col gap-2 px-(--page-pad) pt-5 pb-8">
      <h1 className="type-title-l">{t("promptTitle")}</h1>
      <p className="type-body text-muted">{t("promptHint")}</p>
      {short ? (
        <p className="type-small font-bold text-ink" data-testid="search-too-short">
          {t("tooShort")}
        </p>
      ) : null}
      <HelpCard href={help} />
    </div>
  );
}

async function SearchResults({
  terms,
  parsed,
  page,
  help,
}: {
  readonly terms: SearchTerms;
  readonly parsed: ListFilters;
  readonly page: number;
  readonly help: string;
}) {
  const [t, result] = await Promise.all([
    getTranslations("Search"),
    withTimeLimit(() => getSearchList(terms, parsed, page), SEARCH_READ_TIMEOUT_MS),
  ]);
  const { whatsappNumber, siteUrl } = parsePublicEnv();

  if (!result.ok) {
    // Never the query: a shopper might type a phone number into search.
    console.error(JSON.stringify({ event: "search_read_failed", error: result.error }));
    return (
      <div className="flex flex-col gap-4 px-(--page-pad) pt-5 pb-8">
        <h1 className="type-title-l">{t("title")}</h1>
        <PageErrorState title={t("errorTitle")} whatsappNumber={whatsappNumber} />
      </div>
    );
  }

  const data = result.data;
  const filters = toListFilters(data.filters);
  const hrefFor = (next: ListFilters) => routes.searchPage(terms.text, next);
  const shown = Math.min(data.page * CATEGORY_PAGE_SIZE, data.total);
  const hasMore = shown < data.total;

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-5 pb-8">
      <header className="flex flex-col gap-1">
        <h1 className="type-title-l">{t("title")}</h1>
        <p role="status" className="type-small text-muted" data-testid="search-count">
          {t.rich("resultsLine", {
            total: formatNumber(data.total),
            query: () => query(terms.text),
          })}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {/* A list with no products offers no filters (AC-10). */}
        {data.choices.price ? (
          <FiltersScreen
            scope={{ kind: "search", q: terms.text }}
            choices={data.choices}
            applied={filters}
            badge={appliedChips(data.filters).length}
            total={data.total}
          />
        ) : null}
        <RemoveChipLink
          href={routes.search()}
          label={terms.text}
          removeLabel={t("removeQuery", { query: terms.text })}
        />
      </div>
      <AppliedChips filters={data.filters} hrefFor={hrefFor} />

      {data.total > 0 ? (
        <>
          <ProductGrid
            products={data.products}
            page={data.page}
            whatsappNumber={whatsappNumber}
            siteUrl={siteUrl}
            testId="search-products"
          />
          <ListMore
            shownText={t("shownOf", {
              shown: formatNumber(shown),
              total: formatNumber(data.total),
            })}
            moreText={t("loadMore")}
            moreHref={
              hasMore ? routes.searchMore(terms.text, filters, data.page + 1, shown + 1) : null
            }
            testId="search"
          />
        </>
      ) : (
        <EmptyState
          icon={SearchX}
          title={t.rich("noResultsTitle", { query: () => query(terms.text) })}
          text={t("emptyText")}
          actions={
            <>
              {isFiltered(filters) ? (
                <ClearFiltersLink href={`${routes.searchPage(terms.text)}#filters`} />
              ) : null}
              <ButtonLink variant="whatsapp" size="lg" href={help} target="_blank" rel="noopener">
                <WhatsAppIcon />
                {t("emptyAsk")}
              </ButtonLink>
            </>
          }
        />
      )}
      <HelpCard href={help} />
    </div>
  );
}

async function ClearFiltersLink({ href }: { readonly href: string }) {
  const t = await getTranslations("Filters");
  return (
    <ButtonLink size="lg" render={<Link href={href} />}>
      {t("clearFilters")}
    </ButtonLink>
  );
}
