import "server-only";
import { reportError } from "@/server/monitoring/report";
import { failureOf } from "@/server/monitoring/throttle";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";
import type { CardProduct } from "@/features/catalog/card-view";
import {
  cardColumns,
  loadCatalogTree,
  readCards,
  readHomeProducts,
} from "@/features/catalog/server/queries";
import { listedProduct, parentCategory } from "@/features/catalog/server/storefront-sql";
import { getDb } from "@/server/db";
import { categories, deliveryZones, featuredProducts, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { withTimeLimit, type TimeLimitError } from "@/server/db/time-limit";
import type { ZoneFee } from "../fees";
import {
  bannerHref,
  buildHomeCategories,
  firstCategory,
  HOME_LIMITS,
  type HomeCategory,
} from "../home-rules";
import { readBannerRows } from "./banner-rows";
import { homeCategoryIds, readHomeCategoryProducts } from "./category-products";

// Home's reads (spec 0011 AC-7). Each part is read on its own under its own time limit, so a
// failed or slow read hides only its own part. Public shop data only; hidden categories and
// products never reach a response. The `read…` functions take a client for the database tests.

type Db = Database | Transaction;

export const HOME_PART_TIMEOUT_MS = 3000;
export const FEES_TIMEOUT_MS = 1500;

export type HomeBanner = {
  readonly id: string;
  readonly imageKey: string;
  readonly alt: string;
  /** Null for no link, or a target that is not live now: the banner is a plain picture. */
  readonly href: string | null;
};

export type HomeSections = {
  readonly banners: readonly HomeBanner[] | null;
  /** The category cards (spec 0031 AC-2); the part keeps its spec 0011 name. */
  readonly circles: readonly HomeCategory[] | null;
  /** The first card's eight products (spec 0031 AC-6); null when its read failed or no card. */
  readonly categoryProducts: readonly CardProduct[] | null;
  readonly featured: readonly CardProduct[] | null;
};

type Part = "banners" | "circles" | "categoryProducts" | "featured" | "fees";

/** Logs name the part and the error kind, never values (AC-7). */
function logReadFailed(
  part: Part,
  result: { readonly error: TimeLimitError; readonly cause?: unknown },
) {
  return reportError("home_read_failed", failureOf(result), { part });
}

async function timed<T>(part: Part, read: () => Promise<T>, ms: number): Promise<T | null> {
  const result = await withTimeLimit(read, ms);
  if (result.ok) return result.data;
  await logReadFailed(part, result);
  return null;
}

/** The active banners in `sort, id` order, at most five (AC-2). */
export async function readHomeBanners(db: Db): Promise<readonly HomeBanner[]> {
  const rows = await readBannerRows(db, {
    onlyActive: true,
    limit: HOME_LIMITS.maxActiveBanners,
  });
  return rows.map((row) => ({
    id: row.id,
    imageKey: row.imageKey,
    alt: row.alt,
    href: bannerHref(row.target),
  }));
}

/** The owner's picks that are listed now, in `sort` order, in or out of stock (AC-5). */
export async function readFeaturedCards(db: Db): Promise<readonly CardProduct[]> {
  const rows = await db
    .select(cardColumns)
    .from(featuredProducts)
    .innerJoin(products, eq(products.id, featuredProducts.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(listedProduct)
    .orderBy(asc(featuredProducts.sort), asc(products.id));
  return readCards(db, rows);
}

/** The picks, else the eight newest sellable products, so Home always offers a product (AC-5). */
export async function readHomeFeatured(db: Db): Promise<readonly CardProduct[]> {
  const picks = await readFeaturedCards(db);
  return picks.length ? picks : readHomeProducts(db);
}

/** The first card's eight (spec 0031 AC-6), read after the cards since it needs the tree. */
async function readFirstCategoryProducts(
  circles: readonly HomeCategory[] | null,
): Promise<readonly CardProduct[] | null> {
  const first = circles && firstCategory(circles);
  if (!first) return null;
  return timed(
    "categoryProducts",
    async () => {
      const ids = homeCategoryIds(await loadCatalogTree(), first.slug);
      return ids ? readHomeCategoryProducts(await getDb(), ids) : [];
    },
    HOME_PART_TIMEOUT_MS,
  );
}

/**
 * Banners, the category cards and the first card's products, and featured products, read
 * together; a part that fails is null.
 */
export async function getHomeSections(): Promise<HomeSections> {
  const circlesPart = timed(
    "circles",
    async () => {
      const tree = await loadCatalogTree();
      return buildHomeCategories(tree.categories, tree.listed);
    },
    HOME_PART_TIMEOUT_MS,
  );
  const [banners, circles, categoryProducts, featured] = await Promise.all([
    timed("banners", async () => readHomeBanners(await getDb()), HOME_PART_TIMEOUT_MS),
    circlesPart,
    circlesPart.then(readFirstCategoryProducts),
    timed("featured", async () => readHomeFeatured(await getDb()), HOME_PART_TIMEOUT_MS),
  ]);
  return { banners, circles, categoryProducts, featured };
}

/** Active zones in `sort, name` order, the same rows and order as checkout (AC-6). */
export async function readDeliveryFees(db: Db): Promise<readonly ZoneFee[]> {
  return db
    .select({ shortName: deliveryZones.shortName, fee: deliveryZones.fee })
    .from(deliveryZones)
    .where(eq(deliveryZones.isActive, true))
    .orderBy(asc(deliveryZones.sort), asc(deliveryZones.name));
}

/**
 * The fees for the info strip and the delivery card: one small cached read per storefront page,
 * like the footer's contact. A failed or slow read gives null, which hides both.
 */
export const getDeliveryFees = cache(async (): Promise<readonly ZoneFee[] | null> =>
  timed("fees", async () => readDeliveryFees(await getDb()), FEES_TIMEOUT_MS),
);
