import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { fail, ok, type Result } from "@/lib/result";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { categories, products } from "@/server/db/schema";
import { serverEnv, type CloudflareAnalyticsEnv } from "@/server/env";
import { reportError } from "@/server/monitoring/report";
import { listedProduct, parentCategory } from "@/features/catalog/server/storefront-sql";
import type { ReportDays } from "@/features/reports/period";
import type { StatsPeriod } from "../period";
import { statsRequest, type StatsSection } from "../query";
import {
  parseStatsResponse,
  summarizeVisits,
  topProducts,
  topSources,
  viewsBySlug,
  type ListedProduct,
  type SourceCount,
  type StatsRow,
  type TopProduct,
  type VisitsSummary,
} from "../shape";

// The stats page's reads (spec 0027 AC-1 to AC-7, API surface). The admin check comes before any
// call leaves. Each section is its own call, all three started at once, and each ends as a
// `Result`, so one slow or failed section never holds up or breaks the others.

/** A section that takes longer shows its message (AC-7). */
export const STATS_TIMEOUT_MS = 5000;

export type StatsError = "timeout" | "network" | `http_${number}` | "graphql" | "db";

export type SectionResult<T> = Result<T, StatsError>;

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** One section's rows from the GraphQL API. Never throws. */
export async function fetchStatsRows(
  section: StatsSection,
  cf: CloudflareAnalyticsEnv,
  days: ReportDays,
  fetcher: Fetcher = fetch,
  timeoutMs: number = STATS_TIMEOUT_MS,
): Promise<SectionResult<readonly StatsRow[]>> {
  try {
    const response = await fetcher(cf.graphqlUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${cf.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(statsRequest(section, cf, days)),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return fail(`http_${response.status}`);
    const rows = parseStatsResponse(await response.json());
    return rows === null ? fail("graphql") : ok(rows);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return fail("timeout");
    // A body that is not JSON is a bad answer, not a network failure.
    if (error instanceof SyntaxError) return fail("graphql");
    return fail("network");
  }
}

async function reported<T>(
  section: StatsSection,
  read: () => Promise<SectionResult<T>>,
): Promise<SectionResult<T>> {
  const result = await read();
  if (!result.ok) {
    await reportError("stats_read_failed", result.error, { section, status: result.error });
  }
  return result;
}

async function readListed(slugs: readonly string[]): Promise<readonly ListedProduct[]> {
  if (slugs.length === 0) return [];
  const db = await getDb();
  return db
    .select({ id: products.id, slug: products.slug, name: products.name })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(listedProduct, inArray(products.slug, [...slugs])));
}

export type StatsSections = {
  readonly visits: Promise<SectionResult<VisitsSummary>>;
  readonly products: Promise<SectionResult<readonly TopProduct[]>>;
  readonly sources: Promise<SectionResult<readonly SourceCount[]>>;
};

/**
 * The three sections, already started, or null when Web Analytics is not set up (the page shows
 * one notice and reports nothing). Admin only: anyone else is sent away before a call leaves.
 */
export async function readStats(period: StatsPeriod): Promise<StatsSections | null> {
  await requireAdminPage(routes.admin.stats(period.preset));
  const { cf } = serverEnv();
  if (!cf) return null;
  const siteHost = new URL(parsePublicEnv().siteUrl).host;

  const visits = reported("visits", async () => {
    const rows = await fetchStatsRows("visits", cf, period);
    return rows.ok ? ok(summarizeVisits(rows.data, period)) : rows;
  });
  const productsRead = reported("products", async () => {
    const rows = await fetchStatsRows("products", cf, period);
    if (!rows.ok) return rows;
    const views = viewsBySlug(rows.data);
    try {
      return ok(topProducts(views, await readListed([...views.keys()])));
    } catch {
      return fail("db");
    }
  });
  const sources = reported("sources", async () => {
    const rows = await fetchStatsRows("sources", cf, period);
    return rows.ok ? ok(topSources(rows.data, siteHost)) : rows;
  });
  return { visits, products: productsRead, sources };
}
