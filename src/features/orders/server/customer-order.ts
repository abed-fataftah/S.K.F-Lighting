import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { firstProductImageKey } from "@/features/catalog/server/product-image-sql";
import { readPickupAddress } from "@/features/checkout/server/checkout-options";
import { readPlacedIds } from "@/features/checkout/server/placed";
import { getDb } from "@/server/db";
import { orderLines, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { OrderSummaryLine } from "../order-summary-view";
import type { Fulfilment, OrderStatus } from "../status";
import { readTrackedIds } from "./tracked";

// The customer's order page reads (spec 0015 AC-5, AC-7, AC-13). The page select never names the
// customer's name, phone, city, area, address, or notes, so none of them can reach the HTML.

/** The order whose number and E.164 phone both match, or null: one query, one bit (AC-5). */
export async function findLookupOrderId(
  db: Database | Transaction,
  orderNumber: string,
  phoneE164: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.customerPhoneE164, phoneE164)))
    .limit(1);
  return row?.id ?? null;
}

export type CustomerOrder = {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly fulfilment: Fulfilment;
  readonly deliveryZoneName: string | null;
  readonly placedAt: Date;
  readonly subtotal: number;
  readonly deliveryFee: number;
  readonly total: number;
  readonly amountPaid: number;
  /** The shop's current address for a pickup order, `null` for delivery or when blank. */
  readonly pickupAddress: string | null;
  readonly lines: readonly OrderSummaryLine[];
};

/**
 * The order behind `/orders/<number>` (AC-7), only when this browser's `skf_placed` or
 * `skf_tracked` cookie holds its id. With neither cookie it returns null without a query.
 */
export async function getCustomerOrder(orderNumber: string): Promise<CustomerOrder | null> {
  const [placed, tracked] = await Promise.all([readPlacedIds(), readTrackedIds()]);
  const ids = [...new Set([...placed, ...tracked])];
  if (ids.length === 0) return null;
  return readCustomerOrder(await getDb(), orderNumber, ids);
}

/** The saved order with this number among `allowedIds`, with what its page shows. */
export async function readCustomerOrder(
  db: Database | Transaction,
  orderNumber: string,
  allowedIds: readonly string[],
): Promise<CustomerOrder | null> {
  if (allowedIds.length === 0) return null;
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      fulfilment: orders.fulfilment,
      deliveryZoneName: orders.deliveryZoneName,
      placedAt: orders.placedAt,
      subtotal: orders.subtotal,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      amountPaid: orders.amountPaid,
    })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), inArray(orders.id, [...allowedIds])))
    .limit(1);
  if (!order) return null;

  const [lines, pickupAddress] = await Promise.all([
    db
      .select({
        productName: orderLines.productName,
        sizeLabel: orderLines.sizeLabel,
        colourName: orderLines.colourName,
        quantity: orderLines.quantity,
        lineTotal: orderLines.lineTotal,
        imageKey: firstProductImageKey(orderLines.productId),
      })
      .from(orderLines)
      .where(eq(orderLines.orderId, order.id))
      .orderBy(asc(orderLines.sort)),
    order.fulfilment === "pickup" ? readPickupAddress(db) : null,
  ]);
  return { ...order, pickupAddress, lines };
}
