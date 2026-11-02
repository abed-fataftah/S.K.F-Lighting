import "server-only";
import { desc, eq, getTableName, sql } from "drizzle-orm";
import { orderLines, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { myOrdersLimit } from "../my-orders";
import type { OrderStatus } from "../status";

// The My Orders read (spec 0018 AC-2 to AC-5). One query: the account's orders newest first, each
// with its line count, and the account's order count from a window that runs before the limit, so
// it survives on every page. No personal column (name, phone, address, notes) is selected.

export type MyOrderRow = {
  /** Place in the sorted list, from 1: the card's `o-<position>` anchor. */
  readonly position: number;
  readonly number: string;
  readonly status: OrderStatus;
  readonly placedAt: Date;
  readonly total: number;
  readonly amountPaid: number;
  readonly lineCount: number;
};

// Always table qualified: a select over one table renders its columns bare, and a bare `id` inside
// the line count would name the subquery's own `order_lines.id`.
const orderId = sql`${sql.identifier(getTableName(orders))}.${sql.identifier(orders.id.name)}`;

export async function readMyOrders(
  db: Database | Transaction,
  userId: string,
  page: number,
): Promise<{ readonly rows: readonly MyOrderRow[]; readonly total: number }> {
  const rows = await db
    .select({
      number: orders.orderNumber,
      status: orders.status,
      placedAt: orders.placedAt,
      total: orders.total,
      amountPaid: orders.amountPaid,
      lineCount: sql<number>`(select count(*) from ${orderLines} l where l.order_id = ${orderId})::int`,
      count: sql<number>`(count(*) over ())::int`,
    })
    .from(orders)
    .where(eq(orders.placedByUserId, userId))
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber))
    .limit(myOrdersLimit(page));

  return {
    rows: rows.map((row, index) => ({
      position: index + 1,
      number: row.number,
      status: row.status,
      placedAt: row.placedAt,
      total: row.total,
      amountPaid: row.amountPaid,
      lineCount: row.lineCount,
    })),
    total: rows[0]?.count ?? 0,
  };
}
