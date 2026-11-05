import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { categories, products, productVariants } from "@/server/db/schema";

// The storefront rules as SQL (spec 0008 AC-7), shared by every public read and the cart. Each
// query that uses them joins the product's category as `categories` and left joins its parent as
// `parentCategory`:
//   .innerJoin(categories, eq(categories.id, products.categoryId))
//   .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
// `isSellable` and `isCategoryShown` are the same rules in code; the parity test runs both.

export const parentCategory = alias(categories, "parent_category");

/** The product's category is shown: it is visible, and so is its main when it is a sub (AC-6). */
export const categoryShown = and(
  eq(categories.isVisible, true),
  or(isNull(categories.parentId), eq(parentCategory.isVisible, true)),
)!;

/** A listed product (AC-10): `active`, any availability, in a shown category. */
export const listedProduct = and(eq(products.status, "active"), categoryShown)!;

/** The one sellable rule over a joined product, category, parent, and variant row. */
export const sellableVariant = and(
  listedProduct,
  eq(products.isAvailable, true),
  eq(productVariants.isAvailable, true),
  isNull(productVariants.archivedAt),
)!;

/** Over a listed product row: it has at least one sellable variant (its stock word). */
export const listedInStock = sql<boolean>`(${products.isAvailable} and exists (select 1 from ${productVariants} v where v.product_id = ${products.id} and v.is_available and v.archived_at is null))`;
