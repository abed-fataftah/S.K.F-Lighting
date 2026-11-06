// The Web Analytics reads (spec 0027 AC-2 to AC-5, Feature design). Pure: the three GraphQL
// queries and their variables, built from the resolved shop days. The private path exclusions
// live in one list, so the totals, the day bars, and the lists always agree.
import { addDaysToKey, shopDayStart } from "@/lib/format";
import type { ReportDays } from "@/features/reports/period";

/** Paths never counted (AC-5): order pages, the thank you page, accounts, and the dashboard. */
export const STATS_EXCLUDED_PREFIXES = ["/orders", "/checkout/done", "/account", "/admin"] as const;

export type StatsSection = "visits" | "products" | "sources";

/** Room for 30 shop days of hours (at most 744), as the visits query is grouped by hour. */
export const VISITS_LIMIT = 800;
/** More paths than rows shown, so stale slugs can drop and 10 still fill (AC-3). */
export const PRODUCTS_LIMIT = 50;
/** More hosts than labels shown, so grouping still fills 10 (AC-4). */
export const SOURCES_LIMIT = 50;

/** The UTC window of the shop days: from the first day's start to the day after the last. */
export function statsWindow(days: ReportDays): { readonly geq: string; readonly lt: string } {
  return {
    geq: shopDayStart(days.from).toISOString(),
    lt: shopDayStart(addDaysToKey(days.to, 1)).toISOString(),
  };
}

type Filter = Readonly<Record<string, unknown>>;

/** The site, the window, and one `requestPath_notlike` per private prefix, combined with AND. */
export function statsFilter(siteTag: string, days: ReportDays, extra: Filter = {}): Filter {
  const { geq, lt } = statsWindow(days);
  return {
    AND: [
      { siteTag, datetime_geq: geq, datetime_lt: lt, ...extra },
      ...STATS_EXCLUDED_PREFIXES.map((prefix) => ({ requestPath_notlike: `${prefix}%` })),
    ],
  };
}

type Dimension = "datetimeHour" | "requestPath" | "refererHost";

const query = (dimension: Dimension, args: string) => `query Stats(
  $accountTag: string!
  $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!
) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(filter: $filter, ${args}) {
        count
        sum { visits }
        dimensions { ${dimension} }
      }
    }
  }
}`;

export type StatsRequest = {
  readonly query: string;
  readonly variables: { readonly accountTag: string; readonly filter: Filter };
};

/** One request body per section. */
export function statsRequest(
  section: StatsSection,
  ids: { readonly accountId: string; readonly siteTag: string },
  days: ReportDays,
): StatsRequest {
  const variables = (extra?: Filter) => ({
    accountTag: ids.accountId,
    filter: statsFilter(ids.siteTag, days, extra),
  });
  switch (section) {
    case "visits":
      return { query: query("datetimeHour", `limit: ${VISITS_LIMIT}`), variables: variables() };
    case "products":
      return {
        query: query("requestPath", `limit: ${PRODUCTS_LIMIT}, orderBy: [count_DESC]`),
        variables: variables({ requestPath_like: "/p/%" }),
      };
    case "sources":
      return {
        query: query("refererHost", `limit: ${SOURCES_LIMIT}, orderBy: [sum_visits_DESC]`),
        variables: variables(),
      };
  }
}
