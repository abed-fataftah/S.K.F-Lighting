import "server-only";
import { getTableName, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { productMedia } from "@/server/db/schema";

/**
 * The product's first photo, the same one its card shows (photos are per product, spec 0009), for
 * the product id in `productId`. Shared by the cart and the order summary (spec 0013).
 */
export function firstProductImageKey(productId: AnyPgColumn): SQL<string | null> {
  // Always table qualified: a select over one table renders its columns bare, and a bare
  // `product_id` here would name the subquery's own `m.product_id`.
  const outer = sql`${sql.identifier(getTableName(productId.table))}.${sql.identifier(productId.name)}`;
  return sql<
    string | null
  >`(select m.storage_key from ${productMedia} m where m.product_id = ${outer} and m.kind = 'image' order by m.sort, m.id limit 1)`;
}
