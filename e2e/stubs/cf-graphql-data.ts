// The rows the Web Analytics stub answers with (spec 0027, build task 8), shared with the e2e test so
// both sides agree on the numbers. A window of one day (`today`) is the failure case: the sources
// call fails and the products call is slower than the page waits. Longer windows answer happily.
import { buildProductSlug } from "../../src/features/catalog/slug";

export const STUB_PORT = 8790;
export const STUB_URL = `http://127.0.0.1:${STUB_PORT}/graphql`;
export const STUB_TOKEN = "e2e-token";
/** The values the Worker needs to read the stub instead of Cloudflare. */
export const STUB_ENV = {
  CF_ACCOUNT_ID: "e2e-account",
  CF_WEB_ANALYTICS_SITE_TAG: "e2e-site",
  CF_ANALYTICS_API_TOKEN: STUB_TOKEN,
  CF_GRAPHQL_URL: STUB_URL,
} as const;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type StubRow = {
  readonly count: number;
  readonly sum: { readonly visits: number };
  readonly dimensions: Readonly<Record<string, string>>;
};

/** Days in the window (each shop day is 24 hours, except across a summer time change). */
export const windowDays = (geq: string, lt: string) =>
  Math.round((Date.parse(lt) - Date.parse(geq)) / DAY);

/** Day `i` has `i + 1` page views and one visit, at 10:00 into the day; day 2 has none. */
export const ZERO_DAY = 2;

export function visitRows(geq: string, lt: string): readonly StubRow[] {
  return Array.from({ length: windowDays(geq, lt) }, (_, i) => i)
    .filter((i) => i !== ZERO_DAY)
    .map((i) => ({
      count: i + 1,
      sum: { visits: 1 },
      dimensions: { datetimeHour: new Date(Date.parse(geq) + i * DAY + 10 * HOUR).toISOString() },
    }));
}

export function expectedVisits(days: number) {
  const shown = Array.from({ length: days }, (_, i) => i).filter((i) => i !== ZERO_DAY);
  return {
    pageViews: shown.reduce((sum, i) => sum + i + 1, 0),
    visits: shown.length,
  };
}

/** Two seed products (scripts/seed-dev.ts), as the product page addresses them. */
export const CHANDELIER = buildProductSlug("ثريا كريستال دائرية", "DEMO-2");
export const TABLE_LAMP = buildProductSlug("أباجورة طاولة حديثة", "DEMO-3");

export const productRows: readonly StubRow[] = [
  // A renamed or deleted product: the most viewed path, dropped because nothing is listed there.
  { count: 20, sum: { visits: 0 }, dimensions: { requestPath: "/p/gone-product-zz-9" } },
  // Not a product page: more than one segment after /p/.
  { count: 30, sum: { visits: 0 }, dimensions: { requestPath: `/p/${CHANDELIER}/extra` } },
  {
    count: 9,
    sum: { visits: 0 },
    dimensions: { requestPath: `/p/${encodeURIComponent(CHANDELIER)}` },
  },
  // The same product twice, encoded with a trailing slash and plain: 5 + 2.
  {
    count: 5,
    sum: { visits: 0 },
    dimensions: { requestPath: `/p/${encodeURIComponent(TABLE_LAMP)}/` },
  },
  { count: 2, sum: { visits: 0 }, dimensions: { requestPath: `/p/${TABLE_LAMP}` } },
];

export const EXPECTED_PRODUCTS = [
  { slug: CHANDELIER, pageViews: 9 },
  { slug: TABLE_LAMP, pageViews: 7 },
] as const;

export const sourceRows: readonly StubRow[] = [
  { count: 6, sum: { visits: 6 }, dimensions: { refererHost: "" } },
  { count: 4, sum: { visits: 4 }, dimensions: { refererHost: "m.facebook.com" } },
  { count: 3, sum: { visits: 3 }, dimensions: { refererHost: "l.facebook.com" } },
  // The shop's own host in e2e counts as direct too.
  { count: 2, sum: { visits: 2 }, dimensions: { refererHost: "localhost" } },
  { count: 1, sum: { visits: 1 }, dimensions: { refererHost: "www.bing.com" } },
];

/** Direct 6 + 2, Facebook 4 + 3, then Bing. */
export const EXPECTED_SOURCES = [
  { name: "مباشر", visits: 8 },
  { name: "فيسبوك", visits: 7 },
  { name: "bing.com", visits: 1 },
] as const;

/** Longer than the page's 5 second limit. */
export const SLOW_MS = 6_500;
