import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { categoryShown, parentCategory } from "@/features/catalog/server/storefront-sql";
import { categories, colours, products, productVariants } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { CartRow } from "../cart-view";

/** Live catalog rows for the cart's variant ids; a missing id simply has no row. */
export async function readCartRows(
  db: Database | Transaction,
  variantIds: readonly string[],
): Promise<readonly CartRow[]> {
  if (variantIds.length === 0) return [];
  return db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productCode: products.code,
      slug: products.slug,
      productStatus: products.status,
      productAvailable: products.isAvailable,
      // The category and its main decide whether the product can be sold (spec 0008 AC-7).
      categoryShown: sql<boolean>`${categoryShown}`.mapWith(Boolean),
      variantCode: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      colourName: colours.name,
      price: productVariants.price,
      variantAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .leftJoin(colours, eq(colours.id, productVariants.colourId))
    .where(inArray(productVariants.id, [...variantIds]));
}
