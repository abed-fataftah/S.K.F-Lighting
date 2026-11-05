import "server-only";
import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { isFiltered, NO_FILTERS, type ResolvedFilters } from "../list-filters";
import { likePattern, type SearchTerms } from "../search-text";
import { categories, products } from "@/server/db/schema";
import { listedInStock, listedProduct, parentCategory } from "./storefront-sql";

// The one place a product list's scope and filters become SQL (spec 0010 AC-3, AC-4, AC-9). The
// category page, the search page, and the count route all build their where and order here, so
// the count on the filters button always equals M on the page. Every list read joins the
// product's category and its parent (`listJoins`), so `listedProduct` holds for search too.

export type ListScope =
  | { readonly kind: "category"; readonly categoryIds: readonly string[] }
  | ({ readonly kind: "search" } & Pick<SearchTerms, "words" | "folded" | "code">);

/** The joins every list read makes, so `listedProduct` and `categoryShown` can be checked. */
export const listJoins = {
  category: eq(categories.id, products.categoryId),
  parent: eq(parentCategory.id, categories.parentId),
} as const;

const AGOROT_PER_SHEKEL = 100;

/**
 * One single option of the product meets every active filter together (AC-9): its size key, its
 * colour, its price between the bounds (inclusive, in agorot), and live, or sellable with
 * `available` (the product's own availability is checked outside, on the product row).
 */
function optionMatch(filters: ResolvedFilters): SQL {
  const parts: SQL[] = [sql`v.product_id = ${products.id}`, sql`v.archived_at is null`];
  if (filters.sizes.length) {
    parts.push(
      sql`v.size_key in (${sql.join(
        filters.sizes.map((size) => sql`${size.key}`),
        sql`, `,
      )})`,
    );
  }
  if (filters.colours.length) {
    parts.push(
      sql`v.colour_id in (${sql.join(
        filters.colours.map((colour) => sql`${colour.id}::uuid`),
        sql`, `,
      )})`,
    );
  }
  if (filters.min !== null) parts.push(sql`v.price >= ${filters.min * AGOROT_PER_SHEKEL}`);
  if (filters.max !== null) parts.push(sql`v.price <= ${filters.max * AGOROT_PER_SHEKEL}`);
  if (filters.available) parts.push(sql`v.is_available`);
  return sql`exists (select 1 from product_variants v where ${sql.join(parts, sql` and `)})`;
}

/** Every word is a substring of `search_text`, each passed as an escaped `like` pattern (AC-3). */
function matchesEveryWord(words: readonly string[]): SQL {
  return and(
    ...words.map((word) => sql`${products.searchText} like ${likePattern(word)} escape '\\'`),
  )!;
}

/** The listed products of the scope that meet the filters (AC-3, AC-9; spec 0008 AC-10). */
export function listWhere(scope: ListScope, filters: ResolvedFilters = NO_FILTERS): SQL {
  const inScope =
    scope.kind === "category"
      ? inArray(products.categoryId, [...scope.categoryIds])
      : matchesEveryWord(scope.words);
  if (!isFiltered(filters)) return and(listedProduct, inScope)!;
  return and(
    listedProduct,
    inScope,
    filters.available ? eq(products.isAvailable, true) : undefined,
    optionMatch(filters),
  )!;
}

/**
 * The relevance tier (AC-4), the twin of `searchTier` in code: 0 for an exact product or live
 * option code, 1 for a code that starts with the query, 2 for text that starts with it, else 3.
 */
export function searchTierSql(scope: Pick<SearchTerms, "folded" | "code">): SQL<number> {
  const optionCode = (test: SQL) =>
    sql`exists (select 1 from product_variants o where o.product_id = ${products.id} and o.archived_at is null and ${test})`;
  return sql<number>`case
    when ${products.code} = ${scope.code} or ${optionCode(sql`o.code = ${scope.code}`)} then 0
    when starts_with(${products.code}, ${scope.code}) or ${optionCode(sql`starts_with(o.code, ${scope.code})`)} then 1
    when starts_with(${products.searchText}, ${scope.folded}) then 2
    else 3 end`;
}

/** Category: in stock first, then newest. Search: the tier first, then the same (AC-4). */
export function listOrder(scope: ListScope): SQL[] {
  const rest = [desc(sql`${listedInStock}`), desc(products.createdAt), desc(products.id)];
  return scope.kind === "search" ? [asc(searchTierSql(scope)), ...rest] : rest;
}
