import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { listedProduct, parentCategory } from "@/features/catalog/server/storefront-sql";
import { banners, categories, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { BannerTarget } from "../home-rules";

// Banners with the rows their link points at (spec 0011 AC-10), for Home and the editor. A product
// target joins its category as `categories` and its parent as `parentCategory`, so `listed` is the
// storefront's own rule; a category target joins as `link_category` and `link_parent`.

type Db = Database | Transaction;

const linkCategory = alias(categories, "link_category");
const linkParent = alias(categories, "link_parent");

export type BannerRow = {
  readonly id: string;
  readonly imageKey: string;
  readonly alt: string;
  readonly isActive: boolean;
  readonly target: BannerTarget | null;
};

/** Banners in `sort, id` order, each with its target; `onlyActive` and `limit` for Home. */
export async function readBannerRows(
  db: Db,
  options: { readonly onlyActive?: boolean; readonly limit?: number; readonly id?: string } = {},
): Promise<readonly BannerRow[]> {
  const where = options.id
    ? eq(banners.id, options.id)
    : options.onlyActive
      ? eq(banners.isActive, true)
      : undefined;
  const query = db
    .select({
      id: banners.id,
      imageKey: banners.imageKey,
      alt: banners.alt,
      isActive: banners.isActive,
      productId: products.id,
      productSlug: products.slug,
      productName: products.name,
      productListed: sql<boolean>`coalesce(${listedProduct}, false)`.mapWith(Boolean),
      categoryId: linkCategory.id,
      categorySlug: linkCategory.slug,
      categoryName: linkCategory.name,
      categoryVisible: linkCategory.isVisible,
      parentSlug: linkParent.slug,
      parentName: linkParent.name,
      parentVisible: linkParent.isVisible,
    })
    .from(banners)
    .leftJoin(products, eq(products.id, banners.linkProductId))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .leftJoin(linkCategory, eq(linkCategory.id, banners.linkCategoryId))
    .leftJoin(linkParent, eq(linkParent.id, linkCategory.parentId))
    .where(where)
    .orderBy(asc(banners.sort), asc(banners.id));
  const rows = await (options.limit === undefined ? query : query.limit(options.limit));

  return rows.map((row) => ({
    id: row.id,
    imageKey: row.imageKey,
    alt: row.alt,
    isActive: row.isActive,
    target:
      row.productId !== null && row.productSlug !== null && row.productName !== null
        ? {
            kind: "product",
            id: row.productId,
            slug: row.productSlug,
            name: row.productName,
            listed: row.productListed,
          }
        : row.categoryId !== null && row.categorySlug !== null && row.categoryName !== null
          ? {
              kind: "category",
              id: row.categoryId,
              slug: row.categorySlug,
              name: row.categoryName,
              isVisible: row.categoryVisible ?? false,
              parent:
                row.parentSlug !== null && row.parentName !== null
                  ? {
                      slug: row.parentSlug,
                      name: row.parentName,
                      isVisible: row.parentVisible ?? false,
                    }
                  : null,
            }
          : null,
  }));
}
