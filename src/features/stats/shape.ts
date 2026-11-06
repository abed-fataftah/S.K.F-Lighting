// From Web Analytics rows to what the stats page shows (spec 0027 AC-2 to AC-4). Pure: the
// response check, the hour to shop day buckets, the product path rule, and the source labels.
import { z } from "zod";
import { decodeSlug } from "@/features/catalog/slug";
import type { ReportDays } from "@/features/reports/period";
import { shopDateKey } from "@/lib/format";
import { daysOf } from "./period";

const rowSchema = z.object({
  count: z.number().int().nonnegative(),
  sum: z.object({ visits: z.number().int().nonnegative() }),
  dimensions: z.object({
    datetimeHour: z.string().optional(),
    requestPath: z.string().optional(),
    refererHost: z.string().nullable().optional(),
  }),
});

export type StatsRow = z.infer<typeof rowSchema>;

const responseSchema = z.object({
  data: z
    .object({
      viewer: z.object({
        accounts: z.array(z.object({ rumPageloadEventsAdaptiveGroups: z.array(rowSchema) })),
      }),
    })
    .nullable()
    .optional(),
  errors: z.array(z.unknown()).nullable().optional(),
});

/** The rows of one GraphQL answer, or null when it carries errors or is not the expected shape. */
export function parseStatsResponse(body: unknown): readonly StatsRow[] | null {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return null;
  if (parsed.data.errors && parsed.data.errors.length > 0) return null;
  const accounts = parsed.data.data?.viewer.accounts;
  if (!accounts) return null;
  // No account row means no data yet for this site, which is zero, not a failure.
  return accounts[0]?.rumPageloadEventsAdaptiveGroups ?? [];
}

export type VisitsDay = {
  readonly day: string;
  readonly pageViews: number;
  readonly visits: number;
};

export type VisitsSummary = {
  readonly pageViews: number;
  readonly visits: number;
  /** Every shop day of the period, oldest first, zero when it has no rows. */
  readonly days: readonly VisitsDay[];
};

/** Hour rows into shop days (Cloudflare's own `date` is a UTC day, so it is not used). */
export function summarizeVisits(rows: readonly StatsRow[], period: ReportDays): VisitsSummary {
  const byDay = new Map<string, { pageViews: number; visits: number }>();
  for (const row of rows) {
    const hour = row.dimensions.datetimeHour;
    if (!hour) continue;
    const at = new Date(hour);
    if (Number.isNaN(at.getTime())) continue;
    const day = shopDateKey(at);
    const seen = byDay.get(day) ?? { pageViews: 0, visits: 0 };
    byDay.set(day, { pageViews: seen.pageViews + row.count, visits: seen.visits + row.sum.visits });
  }
  const days = daysOf(period).map((day) => ({
    day,
    pageViews: byDay.get(day)?.pageViews ?? 0,
    visits: byDay.get(day)?.visits ?? 0,
  }));
  return {
    pageViews: days.reduce((sum, day) => sum + day.pageViews, 0),
    visits: days.reduce((sum, day) => sum + day.visits, 0),
    days,
  };
}

/**
 * The product slug a `/p/<slug>` path points at, or null: one trailing `/` is stripped, the slug is
 * decoded like the product page does, then NFC. A path with more segments is not a product page.
 */
export function productSlugFromPath(path: string): string | null {
  if (!path.startsWith("/p/")) return null;
  const rest = path.slice(3).replace(/\/$/, "");
  if (rest === "" || rest.includes("/")) return null;
  return decodeSlug(rest).normalize("NFC");
}

/** Page views per product slug, paths that normalize to the same slug added together. */
export function viewsBySlug(rows: readonly StatsRow[]): ReadonlyMap<string, number> {
  const views = new Map<string, number>();
  for (const row of rows) {
    const slug = productSlugFromPath(row.dimensions.requestPath ?? "");
    if (slug !== null) views.set(slug, (views.get(slug) ?? 0) + row.count);
  }
  return views;
}

export type ListedProduct = { readonly id: string; readonly slug: string; readonly name: string };

export type TopProduct = ListedProduct & { readonly pageViews: number };

export const TOP_LIMIT = 10;

/** Up to 10 listed products by page views, ties by name. A slug with no listed product drops. */
export function topProducts(
  views: ReadonlyMap<string, number>,
  listed: readonly ListedProduct[],
): readonly TopProduct[] {
  return listed
    .flatMap((product) => {
      const pageViews = views.get(product.slug.normalize("NFC"));
      return pageViews === undefined ? [] : [{ ...product, pageViews }];
    })
    .toSorted((a, b) =>
      b.pageViews !== a.pageViews
        ? b.pageViews - a.pageViews
        : a.name < b.name
          ? -1
          : a.name > b.name
            ? 1
            : 0,
    )
    .slice(0, TOP_LIMIT);
}

export const NAMED_SOURCES = ["google", "facebook", "instagram", "whatsapp", "direct"] as const;
export type NamedSource = (typeof NAMED_SOURCES)[number];

/** A named source, or any other host as its bare name. */
export type SourceLabel = NamedSource | { readonly host: string };

const bareHost = (host: string) =>
  host
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");

const isOrUnder = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

// `google.<tld>`, `google.com.<cc>`, `google.co.<cc>`, alone or after a dot (`news.google.com`).
const GOOGLE = /(^|\.)google\.(com?\.[a-z]{2}|[a-z]{2,})$/;

/** Where a visit came from (AC-4): an empty referrer and the shop's own host are direct. */
export function referrerLabel(host: string | null | undefined, siteHost: string): SourceLabel {
  const bare = bareHost(host ?? "");
  if (bare === "" || bare === bareHost(siteHost)) return "direct";
  if (GOOGLE.test(bare)) return "google";
  if (isOrUnder(bare, "facebook.com") || bare === "fb.com" || bare === "fb.me") return "facebook";
  if (isOrUnder(bare, "instagram.com")) return "instagram";
  if (isOrUnder(bare, "whatsapp.com") || bare === "wa.me") return "whatsapp";
  return { host: bare };
}

export type SourceCount = { readonly label: SourceLabel; readonly visits: number };

const labelKey = (label: SourceLabel) => (typeof label === "string" ? label : `host:${label.host}`);

/** Up to 10 sources by visits, rows with the same label added together. */
export function topSources(rows: readonly StatsRow[], siteHost: string): readonly SourceCount[] {
  const byKey = new Map<string, SourceCount>();
  for (const row of rows) {
    const label = referrerLabel(row.dimensions.refererHost, siteHost);
    const key = labelKey(label);
    byKey.set(key, { label, visits: (byKey.get(key)?.visits ?? 0) + row.sum.visits });
  }
  return [...byKey.values()]
    .filter((source) => source.visits > 0)
    .toSorted((a, b) => {
      if (b.visits !== a.visits) return b.visits - a.visits;
      const [ka, kb] = [labelKey(a.label), labelKey(b.label)];
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    })
    .slice(0, TOP_LIMIT);
}
