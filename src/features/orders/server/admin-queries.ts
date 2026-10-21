import "server-only";
import { and, asc, desc, eq, exists, isNull, sql } from "drizzle-orm";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { orderEvents, orderLines, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { pageWindow, splitPage } from "../admin-list";

// The dashboard's order reads (spec 0004 AC-13). Each public query runs `requireAdminPage()` itself,
// so a page that forgets the layout guard still shows nothing to anyone else.

type Db = Database | Transaction;

export type AdminOrderRow = {
  readonly number: string;
  readonly name: string;
  readonly phone: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly total: number;
  readonly placedAt: Date;
  /** Its `created` event has not been seen yet. */
  readonly isNew: boolean;
};

const unseenCreated = (orderId: typeof orders.id) =>
  exists(
    sql`(select 1 from ${orderEvents} where ${and(
      eq(orderEvents.orderId, orderId),
      eq(orderEvents.type, "created"),
      isNull(orderEvents.seenAt),
    )})`,
  );

export async function readAdminOrders(
  db: Db,
  page: number,
): Promise<{ readonly rows: readonly AdminOrderRow[]; readonly hasNext: boolean }> {
  const { limit, offset } = pageWindow(page);
  const rows = await db
    .select({
      number: orders.orderNumber,
      name: orders.customerName,
      phone: orders.customerPhone,
      fulfilment: orders.fulfilment,
      total: orders.total,
      placedAt: orders.placedAt,
      isNew: unseenCreated(orders.id).mapWith(Boolean),
    })
    .from(orders)
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber))
    .limit(limit)
    .offset(offset);
  return splitPage(rows);
}

export async function listAdminOrders(page: number) {
  await requireAdminPage(routes.admin.ordersPage(page));
  return readAdminOrders(await getDb(), page);
}

export type AdminOrder = {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  readonly phone: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly zoneName: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly subtotal: number;
  readonly deliveryFee: number;
  readonly total: number;
  readonly placedAt: Date;
  /** True when this open was the first: the order was still flagged new. */
  readonly wasNew: boolean;
  readonly lines: readonly {
    readonly name: string;
    readonly code: string;
    readonly sizeLabel: string | null;
    readonly colourName: string | null;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly lineTotal: number;
  }[];
};

export async function readAdminOrder(db: Db, orderNumber: string): Promise<AdminOrder | null> {
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.orderNumber,
      name: orders.customerName,
      phone: orders.customerPhone,
      fulfilment: orders.fulfilment,
      zoneName: orders.deliveryZoneName,
      city: orders.city,
      address: orders.address,
      notes: orders.notes,
      subtotal: orders.subtotal,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      placedAt: orders.placedAt,
      wasNew: unseenCreated(orders.id).mapWith(Boolean),
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;

  const lines = await db
    .select({
      name: orderLines.productName,
      code: orderLines.productCode,
      sizeLabel: orderLines.sizeLabel,
      colourName: orderLines.colourName,
      quantity: orderLines.quantity,
      unitPrice: orderLines.unitPrice,
      lineTotal: orderLines.lineTotal,
    })
    .from(orderLines)
    .where(eq(orderLines.orderId, order.id))
    .orderBy(asc(orderLines.sort));
  return { ...order, lines };
}

/** Opening an order clears its "جديد" flag: every unseen event on it is marked seen now. */
export async function markOrderSeen(db: Db, orderId: string) {
  await db
    .update(orderEvents)
    .set({ seenAt: sql`now()` })
    .where(and(eq(orderEvents.orderId, orderId), isNull(orderEvents.seenAt)));
}

/** The order behind `/admin/orders/[number]`, then marked seen; null for the not found page. */
export async function getAdminOrder(orderNumber: string): Promise<AdminOrder | null> {
  await requireAdminPage(routes.admin.order(orderNumber));
  const db = await getDb();
  const order = await readAdminOrder(db, orderNumber);
  if (order) await markOrderSeen(db, order.id);
  return order;
}
