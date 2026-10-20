import "server-only";
import { eq, inArray } from "drizzle-orm";
import { colours, products, productVariants } from "@/server/db/schema";
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
      variantCode: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      colourName: colours.name,
      price: productVariants.price,
      variantAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(colours, eq(colours.id, productVariants.colourId))
    .where(inArray(productVariants.id, [...variantIds]));
}
