import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { firstProductImageKey } from "@/features/catalog/server/product-image-sql";
import { readPickupAddress } from "@/features/checkout/server/checkout-options";
import { readPlacedIds } from "@/features/checkout/server/placed";
import { getClaims } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { orderLines, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { OrderSummaryLine } from "../order-summary-view";
import type { ActorKind, Fulfilment, OrderStatus } from "../status";
import { readTrackedIds } from "./tracked";

// The customer's order page reads (spec 0015 AC-5, AC-7, AC-13). The page select never names the
// customer's name, phone, city, area, address, or notes, so none of them can reach the HTML, nor
// the cancel reason (spec 0016 AC-10).

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
  /** Set exactly when the order is cancelled (spec 0016 AC-7). */
  readonly cancelledAt: Date | null;
  readonly cancelledBy: ActorKind | null;
  /** The shop's current address for a pickup order, `null` for delivery or when blank. */
  readonly pickupAddress: string | null;
  readonly lines: readonly OrderSummaryLine[];
};

/** The id of the order with this number placed by `userId` (spec 0017 AC-14), or null. */
export async function readOwnedOrderId(
  db: Database | Transaction,
  orderNumber: string,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.placedByUserId, userId)))
    .limit(1);
  return row?.id ?? null;
}

/** True when `userId` placed the order with this id (spec 0017 AC-15). */
export async function isOwnedOrder(
  db: Database | Transaction,
  orderId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.placedByUserId, userId)))
    .limit(1);
  return row !== undefined;
}

/**
 * The order behind `/orders/<number>` (AC-7): for the signed in account that placed it (spec 0017
 * AC-14, checked first), else only when this browser's `skf_placed` or `skf_tracked` cookie holds
 * its id. A guest with neither cookie gets null without a query.
 */
export async function getCustomerOrder(orderNumber: string): Promise<CustomerOrder | null> {
  const userId = (await getClaims())?.sub;
  if (userId) {
    const db = await getDb();
    const ownedId = await readOwnedOrderId(db, orderNumber, userId);
    if (ownedId) return readCustomerOrder(db, orderNumber, [ownedId]);
  }
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
      cancelledAt: orders.cancelledAt,
      cancelledBy: orders.cancelledBy,
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
