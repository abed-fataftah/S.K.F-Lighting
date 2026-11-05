import "server-only";
import { sql } from "drizzle-orm";
import { orderNumberCounters } from "@/server/db/schema";
import type { Transaction } from "@/server/db/types";
import { formatOrderNumber, orderYear } from "../order-number";

/**
 * The next order number for the year of `placedAt` (on the shop's clock, `SHOP_TIME_ZONE`), for example `26-00042`.
 * Call inside the transaction that inserts the order, with the same `placedAt` the order stores:
 * the counter row lock queues concurrent orders, and a rolled back order releases its number.
 */
export async function allocateOrderNumber(tx: Transaction, placedAt: Date): Promise<string> {
  const year = orderYear(placedAt);
  const [counter] = await tx
    .insert(orderNumberCounters)
    .values({ year, lastValue: 1 })
    .onConflictDoUpdate({
      target: orderNumberCounters.year,
      set: { lastValue: sql`${orderNumberCounters.lastValue} + 1` },
    })
    .returning({ lastValue: orderNumberCounters.lastValue });
  return formatOrderNumber(year, counter.lastValue);
}
