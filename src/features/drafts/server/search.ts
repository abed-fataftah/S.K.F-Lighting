import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Account } from "@/features/accounts/server/profile";
import { isSellable } from "@/features/catalog/sellable";
import { readSearchRequest, type SearchTerms } from "@/features/catalog/search-text";
import { firstProductImageKey } from "@/features/catalog/server/product-image-sql";
import { listJoins, listOrder, listWhere } from "@/features/catalog/server/list-query";
import { parentCategory } from "@/features/catalog/server/storefront-sql";
import { withTimeLimit } from "@/server/db/time-limit";
import { categories, colours, products, productVariants } from "@/server/db/schema";
import type { Database } from "@/server/db/types";
import { canUseDrafts } from "../access";
import type { DraftProduct } from "../draft-view";

// `GET /api/quick-order/products?q=` (spec 0020 AC-7): the product search of spec 0010 (listed
// products, every word in `search_text`, the code tier, in stock first, newest), 8 at most, each
// with its live options. Electricians only; logs never hold the query.

export const QUICK_SEARCH_LIMIT = 8;
export const QUICK_SEARCH_OPTIONS = 40;
export const QUICK_SEARCH_TIMEOUT_MS = 3000;

export type QuickOrderProduct = DraftProduct & { readonly exactOptionId: string | null };

type Terms = Pick<SearchTerms, "words" | "folded" | "code">;

export async function searchQuickOrderProducts(
  db: Database,
  terms: Terms,
): Promise<readonly QuickOrderProduct[]> {
  const scope = { kind: "search" as const, ...terms };
  const found = await db
    .select({
      id: products.id,
      name: products.name,
      code: products.code,
      isAvailable: products.isAvailable,
      imageKey: firstProductImageKey(products.id),
    })
    .from(products)
    .innerJoin(categories, listJoins.category)
    .leftJoin(parentCategory, listJoins.parent)
    .where(listWhere(scope))
    .orderBy(...listOrder(scope))
    .limit(QUICK_SEARCH_LIMIT);
  if (found.length === 0) return [];

  const options = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      code: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      colourName: colours.name,
      price: productVariants.price,
      isAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .leftJoin(colours, eq(colours.id, productVariants.colourId))
    .where(
      and(
        inArray(
          productVariants.productId,
          found.map((product) => product.id),
        ),
        isNull(productVariants.archivedAt),
      ),
    )
    .orderBy(asc(productVariants.sort), asc(productVariants.id));

  return found.map((product) => {
    // Listed means active in a shown category, so only availability is left to check.
    const rule = {
      status: "active" as const,
      isAvailable: product.isAvailable,
      categoryShown: true,
    };
    const own = options
      .filter((option) => option.productId === product.id)
      .slice(0, QUICK_SEARCH_OPTIONS)
      .map((option) => ({
        id: option.id,
        code: option.code,
        sizeLabel: option.sizeLabel,
        colourName: option.colourName,
        price: option.price,
        sellable: isSellable(rule, option),
        archived: false,
      }));
    return {
      id: product.id,
      name: product.name,
      code: product.code,
      imageKey: product.imageKey,
      sellable: own.some((option) => option.sellable),
      options: own,
      // A code that names one option picks it too; it wins over an equal product code.
      exactOptionId: own.find((option) => option.code === terms.code)?.id ?? null,
    };
  });
}

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export type SearchDeps = {
  readonly account: () => Promise<Account | null>;
  readonly search: (terms: Terms) => Promise<readonly QuickOrderProduct[]>;
};

export async function handleQuickOrderSearch(request: Request, deps: SearchDeps) {
  const account = await deps.account();
  if (!account) return json(401, { error: "signed_out" });
  if (!canUseDrafts(account.profile)) return json(403, { error: "forbidden" });

  const parsed = readSearchRequest(new URL(request.url).searchParams.getAll("q"));
  if (parsed.kind !== "search") return json(200, { products: [] });

  const result = await withTimeLimit(() => deps.search(parsed), QUICK_SEARCH_TIMEOUT_MS);
  if (!result.ok) {
    const error =
      result.error === "failed" && result.cause instanceof Error ? result.cause.name : result.error;
    console.error(JSON.stringify({ event: "quick_order_search_failed", error }));
    return json(503, { error: "unavailable" });
  }
  return json(200, { products: result.data });
}
