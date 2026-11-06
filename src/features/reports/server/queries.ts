import "server-only";
import { and, asc, eq, gte, lt, ne, sql, type AnyColumn } from "drizzle-orm";
import { addDaysToKey, SHOP_TIME_ZONE, shopDayStart } from "@/lib/format";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { orderLines, orders, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { OrderStatus } from "@/features/orders/status";
import type { ReportDays, ReportPeriod } from "../period";
import type { SalesBucket } from "../series";

// The sales report's reads (spec 0024 AC-4, AC-10). The counting rule lives here and only here:
// an order is in the period by the shop day it was placed, and counted unless it is cancelled.
// The dashboard home's month card (feature 35) calls `salesSummaryInDb` too, so they agree.

type Db = Database | Transaction;

/** Placed on a shop day from `from` to `to`, both included (Asia/Hebron, summer time too). */
const inPeriod = (days: ReportDays) =>
  and(
    gte(orders.placedAt, shopDayStart(days.from)),
    lt(orders.placedAt, shopDayStart(addDaysToKey(days.to, 1))),
  );

/** Every status from `new` to `delivered` counts; a cancelled order adds nothing. */
const counted = ne(orders.status, "cancelled");

/** The one condition the summary, the series, and the top products share. */
export const countedInPeriod = (days: ReportDays) => and(inPeriod(days), counted);

// `sum` and `count(*)` come back from the driver as strings; bigint keeps the sum exact.
const sumWhereCounted = (column: AnyColumn) =>
  sql`coalesce(sum(${column}) filter (where ${counted}), 0)::bigint`.mapWith(Number);

export type SalesSummary = {
  /** Counted orders. */
  readonly orders: number;
  /** Their current totals, delivery included, in agorot. */
  readonly sales: number;
  readonly deliveryFees: number;
  /** Their `amount_paid`, reversals already in it. */
  readonly collected: number;
  /** Orders in the period that are cancelled. */
  readonly cancelled: number;
};

export async function salesSummaryInDb(db: Db, days: ReportDays): Promise<SalesSummary> {
  const [row] = await db
    .select({
      orders: sql`count(*) filter (where ${counted})`.mapWith(Number),
      sales: sumWhereCounted(orders.total),
      deliveryFees: sumWhereCounted(orders.deliveryFee),
      collected: sumWhereCounted(orders.amountPaid),
      cancelled: sql`count(*) filter (where not (${counted}))`.mapWith(Number),
    })
    .from(orders)
    .where(inPeriod(days));
  return row;
}

/** Sales of counted orders per shop day `YYYY-MM-DD`, days with orders only, in order. */
export async function salesSeriesInDb(db: Db, days: ReportDays): Promise<SalesBucket[]> {
  // The zone is a bound parameter, so the grouping is by ordinal: the same value bound twice
  // would be two parameters, not one expression, to Postgres.
  return db
    .select({
      key: sql<string>`((${orders.placedAt} at time zone ${SHOP_TIME_ZONE})::date)::text`,
      sales: sql`sum(${orders.total})::bigint`.mapWith(Number),
    })
    .from(orders)
    .where(countedInPeriod(days))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
}

export type TopProduct = {
  readonly productId: string;
  /** The product's current name and code, also when renamed or archived since. */
  readonly name: string;
  readonly code: string;
  readonly quantity: number;
  /** Summed `line_total`: before order discounts and delivery. */
  readonly sales: number;
};

export const TOP_PRODUCTS_LIMIT = 10;

/** Counted order lines grouped by product (every size and colour together), the top 10 (AC-7). */
export async function topProductsInDb(db: Db, days: ReportDays): Promise<TopProduct[]> {
  const quantity = sql`sum(${orderLines.quantity})::bigint`;
  const sales = sql`sum(${orderLines.lineTotal})::bigint`;
  return db
    .select({
      productId: orderLines.productId,
      name: products.name,
      code: products.code,
      quantity: quantity.mapWith(Number),
      sales: sales.mapWith(Number),
    })
    .from(orderLines)
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .innerJoin(products, eq(products.id, orderLines.productId))
    .where(countedInPeriod(days))
    .groupBy(orderLines.productId, products.name, products.code)
    .orderBy(
      sql`${quantity} desc`,
      sql`${sales} desc`,
      asc(products.name),
      asc(orderLines.productId),
    )
    .limit(TOP_PRODUCTS_LIMIT);
}

export type ExportOrder = {
  readonly orderNumber: string;
  readonly placedAt: Date;
  readonly status: OrderStatus;
  readonly placedByRole: "customer" | "electrician" | "admin" | null;
  readonly customerName: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly deliveryFee: number;
  readonly total: number;
  readonly amountPaid: number;
};

/** Every order in the period, cancelled included, oldest first (AC-9). No phone or address. */
export async function exportOrdersInDb(db: Db, days: ReportDays): Promise<ExportOrder[]> {
  return db
    .select({
      orderNumber: orders.orderNumber,
      placedAt: orders.placedAt,
      status: orders.status,
      placedByRole: orders.placedByRole,
      customerName: orders.customerName,
      fulfilment: orders.fulfilment,
      subtotal: orders.subtotal,
      discountTotal: orders.discountTotal,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      amountPaid: orders.amountPaid,
    })
    .from(orders)
    .where(inPeriod(days))
    .orderBy(asc(orders.placedAt), asc(orders.orderNumber));
}

/** The report page's reads, behind the admin check (AC-1). */
export async function readSalesReport(period: ReportPeriod) {
  await requireAdminPage(routes.admin.reportsFor(period));
  const db = await getDb();
  const [summary, series, topProducts] = await Promise.all([
    salesSummaryInDb(db, period),
    salesSeriesInDb(db, period),
    topProductsInDb(db, period),
  ]);
  return { summary, series, topProducts };
}
