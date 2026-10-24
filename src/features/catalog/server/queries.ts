import "server-only";
import { and, asc, count, desc, eq, exists, inArray, isNull, sql } from "drizzle-orm";
import { cache } from "react";
import { clampPage } from "@/lib/paging";
import { getDb } from "@/server/db";
import { categories, colours, productMedia, products, productVariants } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { withTimeLimit } from "@/server/db/time-limit";
import { buildCardProduct, type CardProduct } from "../card-view";
import {
  buildNavigation,
  resolveCategoryPage,
  type NavMain,
  type NavSub,
  type PageCategory,
} from "../category-rules";
import { buildProductPage, type ProductPageData } from "../product-view";
import { listedInStock, listedProduct, parentCategory, sellableVariant } from "./storefront-sql";

// The storefront's catalog reads (spec 0004 AC-3, spec 0008). Every one applies the shown and
// sellable rules from `storefront-sql.ts`, so a hidden category and its products never reach a
// public response. The `read…` functions take a client for the database tests.

type Db = Database | Transaction;

export const HOME_GRID_SIZE = 24;
export const CATEGORY_PAGE_SIZE = 24;

type CardRow = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  readonly specs: readonly { readonly label: string; readonly value: string }[];
  readonly status: "active" | "hidden" | "archived";
  readonly isAvailable: boolean;
};

const cardColumns = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  code: products.code,
  specs: products.specs,
  status: products.status,
  isAvailable: products.isAvailable,
};

/**
 * Cards for product rows already in order, all in shown categories: one read of their live
 * variants and one of their first photos, then the pure card builder (spec 0008, API surface).
 */
async function readCards(db: Db, rows: readonly CardRow[]): Promise<readonly CardProduct[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [variants, images] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        price: productVariants.price,
        isAvailable: productVariants.isAvailable,
        archivedAt: productVariants.archivedAt,
        isDefault: productVariants.isDefault,
        sort: productVariants.sort,
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, ids)),
    db
      .selectDistinctOn([productMedia.productId], {
        productId: productMedia.productId,
        storageKey: productMedia.storageKey,
      })
      .from(productMedia)
      .where(and(inArray(productMedia.productId, ids), eq(productMedia.kind, "image")))
      .orderBy(productMedia.productId, asc(productMedia.sort), asc(productMedia.id)),
  ]);
  const imageOf = new Map(images.map((image) => [image.productId, image.storageKey]));
  return rows.map((row) =>
    buildCardProduct({
      slug: row.slug,
      name: row.name,
      code: row.code,
      specs: row.specs,
      product: { status: row.status, isAvailable: row.isAvailable, categoryShown: true },
      variants: variants.filter((variant) => variant.productId === row.id),
      imageKey: imageOf.get(row.id) ?? null,
    }),
  );
}

const hasSellableVariant = exists(
  sql`(select 1 from ${productVariants} where ${and(
    eq(productVariants.productId, products.id),
    sellableVariant,
  )})`,
);

export async function readHomeProducts(db: Db): Promise<readonly CardProduct[]> {
  const rows = await db
    .select(cardColumns)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(hasSellableVariant)
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(HOME_GRID_SIZE);
  return readCards(db, rows);
}

/** The temporary home grid (spec 0004 AC-3): newest sellable products first, until feature 25. */
export async function listHomeProducts(): Promise<readonly CardProduct[]> {
  return readHomeProducts(await getDb());
}

type CatalogTree = {
  readonly categories: readonly PageCategory[];
  /** Listed (`active`) products placed directly on each category; shown is decided in code. */
  readonly listed: ReadonlyMap<string, number>;
};

export async function readCatalogTree(db: Db): Promise<CatalogTree> {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        sort: categories.sort,
        isVisible: categories.isVisible,
      })
      .from(categories),
    db
      .select({ categoryId: products.categoryId, listed: count() })
      .from(products)
      .where(eq(products.status, "active"))
      .groupBy(products.categoryId),
  ]);
  return {
    categories: rows,
    listed: new Map(counts.map((row) => [row.categoryId, row.listed])),
  };
}

// One read per request, shared by the menu, `/c`, and a category page.
const loadCatalogTree = cache(async () => readCatalogTree(await getDb()));

export const NAVIGATION_TIMEOUT_MS = 1500;

/**
 * The menu sheet's categories (AC-14). It runs on every storefront page, so a failed or slow read
 * gives null and the sheet shows without them. Logs say what failed, never values.
 */
export const listNavigation = cache(async (): Promise<readonly NavMain[] | null> => {
  const result = await withTimeLimit(loadCatalogTree, NAVIGATION_TIMEOUT_MS);
  if (result.ok) return buildNavigation(result.data.categories, result.data.listed);
  console.error("listNavigation: read failed", {
    error: result.error === "timeout" ? "timeout" : errorName(result),
  });
  return null;
});

const errorName = (result: { readonly cause?: unknown }) =>
  result.cause instanceof Error ? result.cause.name : "unknown";

/** `/c` (AC-15): navigation with no time limit of its own; the page sets one. */
export async function getNavigation(): Promise<readonly NavMain[]> {
  const tree = await loadCatalogTree();
  return buildNavigation(tree.categories, tree.listed);
}

type PageHead = {
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
};

/**
 * What a category page knows before its products load (AC-8, AC-9, AC-11): the category, its
 * chips, M, and the clamped page. Read first, so a not found page still gets a real 404 before the
 * page starts streaming; the products then load under the page's own Suspense boundary.
 */
export type CategoryHead = {
  readonly main: PageHead;
  readonly sub: PageHead | null;
  readonly navSubs: readonly NavSub[];
  readonly chipSubs: readonly NavSub[];
  /** M: every listed product of the page. */
  readonly total: number;
  /** The page after clamping to `1..last`; the first `page × 24` products are shown. */
  readonly page: number;
  readonly categoryIds: readonly string[];
};

export type CategoryPageData = CategoryHead & { readonly products: readonly CardProduct[] };

const head = (category: PageCategory): PageHead => ({
  slug: category.slug,
  name: category.name,
  description: category.description,
});

export function readCategoryHead(
  tree: CatalogTree,
  mainSlug: string,
  subSlug: string | null,
  requestedPage: number,
): CategoryHead | null {
  const scope = resolveCategoryPage(tree.categories, tree.listed, mainSlug, subSlug);
  if (!scope) return null;
  return {
    main: head(scope.main),
    sub: scope.sub ? head(scope.sub) : null,
    navSubs: scope.navSubs,
    chipSubs: scope.chipSubs,
    total: scope.total,
    // Clamp before the limit is built (AC-11): a page beyond the last shows everything.
    page: clampPage(requestedPage, scope.total, CATEGORY_PAGE_SIZE),
    categoryIds: scope.categoryIds,
  };
}

/** The first `page × 24` listed products of the page, in list order (AC-10, AC-11). */
export async function readCategoryProducts(
  db: Db,
  pageHead: CategoryHead,
): Promise<readonly CardProduct[]> {
  if (pageHead.total === 0) return [];
  const rows = await db
    .select(cardColumns)
    .from(products)
    .where(
      and(inArray(products.categoryId, [...pageHead.categoryIds]), eq(products.status, "active")),
    )
    .orderBy(desc(sql`${listedInStock}`), desc(products.createdAt), desc(products.id))
    .limit(pageHead.page * CATEGORY_PAGE_SIZE);
  return readCards(db, rows);
}

export async function readCategoryPage(
  db: Db,
  tree: CatalogTree,
  mainSlug: string,
  subSlug: string | null,
  requestedPage: number,
): Promise<CategoryPageData | null> {
  const pageHead = readCategoryHead(tree, mainSlug, subSlug, requestedPage);
  if (!pageHead) return null;
  return { ...pageHead, products: await readCategoryProducts(db, pageHead) };
}

/** A category page's head (AC-8), or null for the not found page. */
export async function getCategoryHead(
  mainSlug: string,
  subSlug: string | null,
  page: number,
): Promise<CategoryHead | null> {
  return readCategoryHead(await loadCatalogTree(), mainSlug, subSlug, page);
}

export async function getCategoryProducts(pageHead: CategoryHead): Promise<readonly CardProduct[]> {
  return readCategoryProducts(await getDb(), pageHead);
}

/**
 * An `active` product in a shown category by slug with all its live variants and media, or null
 * for the not found page (spec 0009 AC-1, spec 0008 AC-7). `?v` is applied after, in a pure step.
 */
export async function readProductPage(db: Db, slug: string): Promise<ProductPageData | null> {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      code: products.code,
      description: products.description,
      specs: products.specs,
      status: products.status,
      isAvailable: products.isAvailable,
      categoryName: categories.name,
      categorySlug: categories.slug,
      parentName: parentCategory.name,
      parentSlug: parentCategory.slug,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(eq(products.slug, slug), listedProduct))
    .limit(1);
  if (!product) return null;

  const [variants, media] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        sizeLabel: productVariants.sizeLabel,
        sizeSort: productVariants.sizeSort,
        colourId: productVariants.colourId,
        colourName: colours.name,
        colourHex: colours.hex,
        price: productVariants.price,
        isAvailable: productVariants.isAvailable,
        archivedAt: productVariants.archivedAt,
        isDefault: productVariants.isDefault,
        sort: productVariants.sort,
      })
      .from(productVariants)
      .leftJoin(colours, eq(colours.id, productVariants.colourId))
      .where(and(eq(productVariants.productId, product.id), isNull(productVariants.archivedAt))),
    db
      .select({
        kind: productMedia.kind,
        key: productMedia.storageKey,
        alt: productMedia.alt,
        width: productMedia.width,
        height: productMedia.height,
      })
      .from(productMedia)
      .where(eq(productMedia.productId, product.id))
      .orderBy(asc(productMedia.sort), asc(productMedia.id)),
  ]);

  return buildProductPage({
    product,
    category: { name: product.categoryName, slug: product.categorySlug },
    parent:
      product.parentName !== null && product.parentSlug !== null
        ? { name: product.parentName, slug: product.parentSlug }
        : null,
    variants,
    media,
  });
}

/** One read per request, shared by the page and its metadata, keyed on the decoded slug (AC-16). */
export const getProductPage = cache(async (slug: string): Promise<ProductPageData | null> =>
  readProductPage(await getDb(), slug),
);
