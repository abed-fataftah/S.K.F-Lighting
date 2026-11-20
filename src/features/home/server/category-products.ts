import "server-only";
import { reportError } from "@/server/monitoring/report";
import { failureOf } from "@/server/monitoring/throttle";
import type { CardProduct } from "@/features/catalog/card-view";
import { checkOrderRate, rateKey, type OrderLimiter } from "@/features/checkout/rate-limit";
import {
  cardColumns,
  loadCatalogTree,
  readCards,
  readCategoryHead,
  type CatalogTree,
} from "@/features/catalog/server/queries";
import { listJoins, listOrder, listWhere } from "@/features/catalog/server/list-query";
import { parentCategory } from "@/features/catalog/server/storefront-sql";
import { getDb } from "@/server/db";
import { categories, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { withTimeLimit } from "@/server/db/time-limit";
import { readCategoryProductsRequest } from "../category-products-request";
import { buildHomeCategories, HOME_LIMITS } from "../home-rules";

// The eight products under Home's category cards (spec 0031 AC-6, AC-7): the first eight of the
// category page's own unfiltered list for a main shown on Home. The page reads the first card's
// eight itself; the others come from `GET /api/catalog/home-products`, rate limited per IP with
// the catalog count's budget (failing open), time boxed, and cacheable by the browser only on a
// 200. Logs name the event and what failed, never the category.

type Db = Database | Transaction;

export const CATEGORY_PRODUCTS_TIMEOUT_MS = 1500;

/** The first eight listed products of the category scope, in the category page's order (AC-6). */
export async function readHomeCategoryProducts(
  db: Db,
  categoryIds: readonly string[],
): Promise<readonly CardProduct[]> {
  if (!categoryIds.length) return [];
  const scope = { kind: "category", categoryIds } as const;
  const rows = await db
    .select(cardColumns)
    .from(products)
    .innerJoin(categories, listJoins.category)
    .leftJoin(parentCategory, listJoins.parent)
    .where(listWhere(scope))
    .orderBy(...listOrder(scope))
    .limit(HOME_LIMITS.categoryProducts);
  return readCards(db, rows);
}

/**
 * The main and its subs' ids for a slug shown on Home now, else null: the cards and the route
 * share one rule, so the route never answers for a main that has no card (AC-7).
 */
export function homeCategoryIds(tree: CatalogTree, slug: string): readonly string[] | null {
  const onHome = buildHomeCategories(tree.categories, tree.listed).some(
    (category) => category.slug === slug,
  );
  if (!onHome) return null;
  return readCategoryHead(tree, slug, null, 1)?.categoryIds ?? null;
}

/** A card's eight products, or null for a main unknown or not shown on Home. */
export async function categoryProductsFor(slug: string): Promise<readonly CardProduct[] | null> {
  const ids = homeCategoryIds(await loadCatalogTree(), slug);
  return ids ? readHomeCategoryProducts(await getDb(), ids) : null;
}

export type CategoryProductsDeps = {
  readonly limiter: OrderLimiter | undefined;
  readonly products: typeof categoryProductsFor;
  readonly production: boolean;
};

const NO_STORE = "no-store";
const BROWSER_MINUTE = "private, max-age=60";

const json = (status: number, body: Record<string, unknown>, cache = NO_STORE) =>
  Response.json(body, { status, headers: { "Cache-Control": cache } });

let warnedUnchecked = false;

export async function handleCategoryProducts(
  request: Request,
  deps: CategoryProductsDeps,
): Promise<Response> {
  const check = await checkOrderRate(
    deps.limiter,
    rateKey(request.headers.get("cf-connecting-ip")),
  );
  if (check === "limited") return json(429, { error: "too_many" });
  if (check === "unchecked" && !deps.production && !warnedUnchecked) {
    // Once per process, so `next dev` says why the limit is not applied.
    warnedUnchecked = true;
    console.warn(JSON.stringify({ event: "home_category_products_rate_unchecked" }));
  }

  const parsed = readCategoryProductsRequest(new URL(request.url).searchParams);
  if (parsed.kind === "bad_request") return json(400, { error: "bad_request" });

  const result = await withTimeLimit(
    () => deps.products(parsed.slug),
    CATEGORY_PRODUCTS_TIMEOUT_MS,
  );
  if (!result.ok) {
    await reportError("home_category_products_failed", failureOf(result));
    return json(503, { error: "unavailable" });
  }
  if (result.data === null) return json(404, { error: "not_found" });
  return json(200, { products: result.data }, BROWSER_MINUTE);
}
