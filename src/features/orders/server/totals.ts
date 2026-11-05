import "server-only";
import { eq } from "drizzle-orm";
import { orderLines, orders } from "@/server/db/schema";
import type { Transaction } from "@/server/db/types";
import { computeOrderTotals, type OrderTotals } from "../totals";

/**
 * Writes `subtotal` and `total` from the stored lines and the order's `delivery_fee` and
 * `discount_total`. Callers update `line_total`, the fee, or the discount first, in the same
 * transaction; every money action ends with this so the stored totals never drift.
 */
export async function recomputeOrderTotals(tx: Transaction, orderId: string): Promise<OrderTotals> {
  const [order] = await tx
    .select({ deliveryFee: orders.deliveryFee, discountTotal: orders.discountTotal })
    .from(orders)
    .where(eq(orders.id, orderId))
    .for("update");
  if (!order) throw new Error(`recomputeOrderTotals: order ${orderId} does not exist`);

  const lines = await tx
    .select({ unitPrice: orderLines.unitPrice, quantity: orderLines.quantity })
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId));

  const totals = computeOrderTotals({ lines, ...order });
  await tx.update(orders).set(totals).where(eq(orders.id, orderId));
  return totals;
}
