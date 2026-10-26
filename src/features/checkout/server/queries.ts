import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { MessageOrder } from "@/features/orders/whatsapp-message";
import { getDb } from "@/server/db";
import { orderLines, orders } from "@/server/db/schema";
import { readActiveZones, readPickupAddress, type DeliveryZoneOption } from "./checkout-options";
import { readPlacedIds } from "./placed";

export type CheckoutOptions = {
  readonly zones: readonly DeliveryZoneOption[];
  readonly pickupAddress: string | null;
};

export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  const db = await getDb();
  const [zones, pickupAddress] = await Promise.all([readActiveZones(db), readPickupAddress(db)]);
  return { zones, pickupAddress };
}

export type PlacedOrder = MessageOrder & { readonly id: string };

/**
 * The order behind a confirmation page (spec 0004 AC-11), only when this browser's `skf_placed`
 * cookie holds its id. A sequential number alone opens nothing.
 */
export async function getPlacedOrder(orderNumber: string): Promise<PlacedOrder | null> {
  const ids = await readPlacedIds();
  if (ids.length === 0) return null;

  const db = await getDb();
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      fulfilment: orders.fulfilment,
      deliveryZoneName: orders.deliveryZoneName,
      city: orders.city,
      address: orders.address,
      deliveryFee: orders.deliveryFee,
      notes: orders.notes,
      total: orders.total,
    })
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), inArray(orders.id, [...ids])))
    .limit(1);
  if (!order) return null;

  const lines = await db
    .select({
      productName: orderLines.productName,
      sizeLabel: orderLines.sizeLabel,
      colourName: orderLines.colourName,
      quantity: orderLines.quantity,
      lineTotal: orderLines.lineTotal,
    })
    .from(orderLines)
    .where(eq(orderLines.orderId, order.id))
    .orderBy(asc(orderLines.sort));
  return { ...order, lines };
}
