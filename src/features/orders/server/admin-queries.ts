import "server-only";
import { and, asc, desc, eq, exists, inArray, isNull, ne, sql } from "drizzle-orm";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { orderEvents, orderLines, orders } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { pageWindow, splitPage } from "@/lib/paging";
import type { OrderStatus } from "../status";

// The dashboard's order reads (spec 0004 AC-13, spec 0014). Each public query runs
// `requireAdminPage()` itself, so a page that forgets the layout guard still shows nothing to
// anyone else.

type Db = Database | Transaction;

export const ADMIN_ORDERS_PAGE_SIZE = 50;

export type ActorKind = "guest" | "customer" | "electrician" | "admin" | "system";

export type AdminOrderRow = {
  readonly number: string;
  readonly name: string;
  /** Stored E.164, shown through `formatPhone` (spec 0005 AC-8). */
  readonly phoneE164: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly total: number;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  /** `electrician` shows كهربائي; anything else, guests included, عميل (spec 0014 AC-11). */
  readonly placedByRole: "customer" | "electrician" | "admin" | null;
  /** It has a `created` or `cancelled` event not seen yet (spec 0014 AC-14). */
  readonly isUnseen: boolean;
  /** Cancelled by anyone but the shop (spec 0014 AC-8). */
  readonly cancelledByCustomer: boolean;
};

/** Events that flag an order until it is opened: a new order, and a cancel by someone else. */
const FLAGGING_EVENTS = ["created", "cancelled"] as const;

const unseenFlag = and(inArray(orderEvents.type, FLAGGING_EVENTS), isNull(orderEvents.seenAt));

const isUnseen = (orderId: typeof orders.id) =>
  exists(
    sql`(select 1 from ${orderEvents} where ${and(eq(orderEvents.orderId, orderId), unseenFlag)})`,
  );

const rowColumns = {
  number: orders.orderNumber,
  name: orders.customerName,
  phoneE164: orders.customerPhoneE164,
  fulfilment: orders.fulfilment,
  total: orders.total,
  placedAt: orders.placedAt,
  status: orders.status,
  placedByRole: orders.placedByRole,
  isUnseen: isUnseen(orders.id).mapWith(Boolean),
  cancelledByCustomer: sql<boolean>`(${and(
    eq(orders.status, "cancelled"),
    ne(orders.cancelledBy, "admin"),
  )}) is true`.mapWith(Boolean),
};

export async function readAdminOrders(
  db: Db,
  page: number,
): Promise<{ readonly rows: readonly AdminOrderRow[]; readonly hasNext: boolean }> {
  const { limit, offset } = pageWindow(page, ADMIN_ORDERS_PAGE_SIZE);
  const rows = await db
    .select(rowColumns)
    .from(orders)
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber))
    .limit(limit)
    .offset(offset);
  return splitPage(rows, ADMIN_ORDERS_PAGE_SIZE);
}

export async function listAdminOrders(page: number) {
  await requireAdminPage(routes.admin.ordersPage(page));
  return readAdminOrders(await getDb(), page);
}

export type AdminOrderEvent = {
  readonly id: string;
  readonly type: "created" | "status_changed" | "cancelled";
  readonly actorKind: ActorKind;
  readonly toStatus: OrderStatus | null;
  readonly at: Date;
};

/** The event types the history shows (spec 0014 AC-6); later features add their own. */
const HISTORY_EVENTS = ["created", "status_changed", "cancelled"] as const;

export type AdminOrder = {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  /** Stored E.164, shown through `formatPhone` (spec 0005 AC-8). */
  readonly phoneE164: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly zoneName: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly subtotal: number;
  readonly deliveryFee: number;
  readonly total: number;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  readonly deliveredAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly cancelledBy: ActorKind | null;
  readonly cancelReason: string | null;
  readonly lines: readonly {
    readonly name: string;
    readonly code: string;
    readonly sizeLabel: string | null;
    readonly colourName: string | null;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly lineTotal: number;
  }[];
  /** Oldest first, by `created_at, id`. */
  readonly events: readonly AdminOrderEvent[];
};

export async function readAdminOrder(db: Db, orderNumber: string): Promise<AdminOrder | null> {
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.orderNumber,
      name: orders.customerName,
      phoneE164: orders.customerPhoneE164,
      fulfilment: orders.fulfilment,
      zoneName: orders.deliveryZoneName,
      city: orders.city,
      address: orders.address,
      notes: orders.notes,
      subtotal: orders.subtotal,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      placedAt: orders.placedAt,
      status: orders.status,
      deliveredAt: orders.deliveredAt,
      cancelledAt: orders.cancelledAt,
      cancelledBy: orders.cancelledBy,
      cancelReason: orders.cancelReason,
    })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;

  const [lines, events] = await Promise.all([readLines(db, order.id), readEvents(db, order.id)]);
  return { ...order, lines, events };
}

function readLines(db: Db, orderId: string) {
  return db
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
    .where(eq(orderLines.orderId, orderId))
    .orderBy(asc(orderLines.sort));
}

function readEvents(db: Db, orderId: string): Promise<AdminOrderEvent[]> {
  return db
    .select({
      id: orderEvents.id,
      type: sql<AdminOrderEvent["type"]>`${orderEvents.type}`,
      actorKind: orderEvents.actorKind,
      toStatus: orderEvents.toStatus,
      at: orderEvents.createdAt,
    })
    .from(orderEvents)
    .where(and(eq(orderEvents.orderId, orderId), inArray(orderEvents.type, HISTORY_EVENTS)))
    .orderBy(asc(orderEvents.createdAt), asc(orderEvents.id));
}

/** Opening an order clears its flag (spec 0014 AC-14): every unseen event on it is marked seen. */
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
