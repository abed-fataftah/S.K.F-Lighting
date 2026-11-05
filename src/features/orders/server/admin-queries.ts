import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { addDaysToKey, shopDayStart } from "@/lib/format";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { orderEvents, orderLines, orders, profiles, type OrderEventData } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { pageWindow, splitPage } from "@/lib/paging";
import type { PaymentRow } from "@/features/payments/ledger";
import { readOrderPayments } from "@/features/payments/server/queries";
import type { OrderDays, OrderFilters, OrderPaymentFilter } from "../admin-filters";
import { FLAGGING_EVENTS } from "../admin-history";
import type { ActorKind, OrderStatus } from "../status";

// The dashboard's order reads (spec 0004 AC-13, spec 0014). Each public query runs
// `requireAdminPage()` itself, so a page that forgets the layout guard still shows nothing to
// anyone else.

type Db = Database | Transaction;

export const ADMIN_ORDERS_PAGE_SIZE = 50;

export type { ActorKind } from "../status";

export type AdminOrderRow = {
  readonly number: string;
  readonly name: string;
  /** Stored E.164, shown through `formatPhone` (spec 0005 AC-8). */
  readonly phoneE164: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly total: number;
  /** Shown as the الدفع badge (spec 0023 AC-11). */
  readonly amountPaid: number;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  /** `electrician` shows كهربائي; anything else, guests included, عميل (spec 0014 AC-11). */
  readonly placedByRole: "customer" | "electrician" | "admin" | null;
  /** It has a `created` or `cancelled` event not seen yet (spec 0014 AC-14). */
  readonly isUnseen: boolean;
  /** Cancelled by anyone but the shop (spec 0014 AC-8). */
  readonly cancelledByCustomer: boolean;
};

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
  amountPaid: orders.amountPaid,
  placedAt: orders.placedAt,
  status: orders.status,
  placedByRole: orders.placedByRole,
  isUnseen: isUnseen(orders.id).mapWith(Boolean),
  cancelledByCustomer: sql<boolean>`(${and(
    eq(orders.status, "cancelled"),
    ne(orders.cancelledBy, "admin"),
  )}) is true`.mapWith(Boolean),
};

/** The الدفع filter (spec 0023 AC-11): the same split as `orderPaymentBadge`. */
function paymentCondition(payment: OrderPaymentFilter): SQL | undefined {
  const live = ne(orders.status, "cancelled");
  switch (payment) {
    case "none":
      return and(live, eq(orders.amountPaid, 0));
    case "partial":
      return and(live, gt(orders.amountPaid, 0), lt(orders.amountPaid, orders.total));
    case "paid":
      return and(live, gt(orders.amountPaid, 0), gte(orders.amountPaid, orders.total));
    case "refund_due":
      return and(eq(orders.status, "cancelled"), gt(orders.amountPaid, 0));
  }
}

/** The filters as SQL, combined with AND (spec 0014 AC-9 to AC-12). */
function filterConditions(filters: OrderFilters, days: OrderDays): SQL[] {
  const conditions: (SQL | undefined)[] = [
    // The جديد chip also holds a `confirmed` row, read like `new` everywhere (AC-1).
    filters.status === "new"
      ? inArray(orders.status, ["new", "confirmed"])
      : filters.status
        ? eq(orders.status, filters.status)
        : undefined,
    filters.unseen ? isUnseen(orders.id) : undefined,
    days.from ? gte(orders.placedAt, shopDayStart(days.from)) : undefined,
    days.to ? lt(orders.placedAt, shopDayStart(addDaysToKey(days.to, 1))) : undefined,
    // كهربائي is an electrician's order; عميل is every other one, guests included (AC-11).
    filters.type === "electrician"
      ? eq(orders.placedByRole, "electrician")
      : filters.type === "customer"
        ? or(isNull(orders.placedByRole), ne(orders.placedByRole, "electrician"))
        : undefined,
    filters.method ? eq(orders.fulfilment, filters.method) : undefined,
    filters.payment ? paymentCondition(filters.payment) : undefined,
  ];
  return conditions.filter((condition) => condition !== undefined);
}

export async function readAdminOrders(
  db: Db,
  filters: OrderFilters,
  days: OrderDays,
): Promise<{ readonly rows: readonly AdminOrderRow[]; readonly hasNext: boolean }> {
  const { limit, offset } = pageWindow(filters.page, ADMIN_ORDERS_PAGE_SIZE);
  const rows = await db
    .select(rowColumns)
    .from(orders)
    .where(and(...filterConditions(filters, days)))
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber))
    .limit(limit)
    .offset(offset);
  return splitPage(rows, ADMIN_ORDERS_PAGE_SIZE);
}

export async function listAdminOrders(filters: OrderFilters, days: OrderDays) {
  await requireAdminPage(routes.admin.ordersWith(filters, filters.page));
  return readAdminOrders(await getDb(), filters, days);
}

/** Every order placed with this phone, newest first, whatever the filters (spec 0014 AC-13). */
export async function readOrdersByPhone(db: Db, phoneE164: string): Promise<AdminOrderRow[]> {
  return db
    .select(rowColumns)
    .from(orders)
    .where(eq(orders.customerPhoneE164, phoneE164))
    .orderBy(desc(orders.placedAt), desc(orders.orderNumber))
    .limit(ADMIN_ORDERS_PAGE_SIZE);
}

/** True when an order with this number exists. */
export async function orderNumberExists(db: Db, orderNumber: string): Promise<boolean> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  return row !== undefined;
}

export type AdminOrderEvent = {
  readonly id: string;
  readonly type: (typeof HISTORY_EVENTS)[number];
  readonly actorKind: ActorKind;
  readonly toStatus: OrderStatus | null;
  /**
   * A price save's `lineCount`, `fromTotal`, `toTotal`, and `note` (spec 0022 AC-8); a payment's
   * `kind`, `method`, `amount`, `fromPaid`, and `toPaid` (spec 0023 AC-10).
   */
  readonly data: OrderEventData;
  readonly at: Date;
};

/** The event types the history shows (spec 0014 AC-6); later features add their own. */
const HISTORY_EVENTS = [
  "created",
  "status_changed",
  "cancelled",
  "line_price_changed",
  "payment_recorded",
] as const;

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
  readonly discountTotal: number;
  readonly total: number;
  readonly amountPaid: number;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  /** The role saved at placement (spec 0022 AC-1); null for a guest. */
  readonly placedByRole: "customer" | "electrician" | "admin" | null;
  readonly deliveredAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly cancelledBy: ActorKind | null;
  readonly cancelReason: string | null;
  /** The account that placed it; null for a guest, or after the account was removed. */
  readonly placedByUserId: string | null;
  /** That account's role now (spec 0019 AC-14); null when there is no account. */
  readonly placedByAccountRole: "customer" | "electrician" | "admin" | null;
  readonly lines: readonly {
    readonly id: string;
    readonly name: string;
    readonly code: string;
    readonly sizeLabel: string | null;
    readonly colourName: string | null;
    readonly quantity: number;
    readonly catalogUnitPrice: number;
    readonly unitPrice: number;
    readonly lineTotal: number;
  }[];
  /** Oldest first, by `created_at, id`. */
  readonly events: readonly AdminOrderEvent[];
  /** The ledger, oldest first (spec 0023 AC-1); cheque details and notes are owner only. */
  readonly payments: readonly PaymentRow[];
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
      discountTotal: orders.discountTotal,
      total: orders.total,
      amountPaid: orders.amountPaid,
      placedAt: orders.placedAt,
      status: orders.status,
      placedByRole: orders.placedByRole,
      deliveredAt: orders.deliveredAt,
      cancelledAt: orders.cancelledAt,
      cancelledBy: orders.cancelledBy,
      cancelReason: orders.cancelReason,
      placedByUserId: orders.placedByUserId,
      placedByAccountRole: profiles.role,
    })
    .from(orders)
    .leftJoin(profiles, eq(profiles.id, orders.placedByUserId))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;

  const [lines, events, payments] = await Promise.all([
    readLines(db, order.id),
    readEvents(db, order.id),
    readOrderPayments(db, order.id),
  ]);
  return { ...order, lines, events, payments };
}

function readLines(db: Db, orderId: string) {
  return db
    .select({
      id: orderLines.id,
      name: orderLines.productName,
      code: orderLines.productCode,
      sizeLabel: orderLines.sizeLabel,
      colourName: orderLines.colourName,
      quantity: orderLines.quantity,
      catalogUnitPrice: orderLines.catalogUnitPrice,
      unitPrice: orderLines.unitPrice,
      lineTotal: orderLines.lineTotal,
    })
    .from(orderLines)
    .where(eq(orderLines.orderId, orderId))
    .orderBy(asc(orderLines.sort), asc(orderLines.id));
}

function readEvents(db: Db, orderId: string): Promise<AdminOrderEvent[]> {
  return db
    .select({
      id: orderEvents.id,
      type: sql<AdminOrderEvent["type"]>`${orderEvents.type}`,
      actorKind: orderEvents.actorKind,
      toStatus: orderEvents.toStatus,
      data: orderEvents.data,
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

/** How many orders are flagged (spec 0014 AC-15): one per order, however many unseen events. */
export async function readUnseenCount(db: Db): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(distinct ${orderEvents.orderId})`.mapWith(Number) })
    .from(orderEvents)
    .where(unseenFlag);
  return row?.count ?? 0;
}

export async function countUnseenOrders(): Promise<number> {
  await requireAdminPage();
  return readUnseenCount(await getDb());
}

/** The order behind `/admin/orders/[number]`, then marked seen; null for the not found page. */
export async function getAdminOrder(orderNumber: string): Promise<AdminOrder | null> {
  await requireAdminPage(routes.admin.order(orderNumber));
  const db = await getDb();
  const order = await readAdminOrder(db, orderNumber);
  if (order) await markOrderSeen(db, order.id);
  return order;
}
