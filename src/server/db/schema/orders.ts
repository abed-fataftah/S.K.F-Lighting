import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariants, products } from "./catalog";
import { id, timestamps } from "./columns";
import { actorKind, fulfilmentMethod, orderEventType, orderStatus, userRole } from "./enums";
import { profiles } from "./profiles";
import { deliveryZones } from "./settings";

// Every price and customer detail is copied at placement, so later catalog edits never
// change an old order. For a guest or an electrician ordering for someone else, the customer
// fields are the end customer and `placed_by_user_id` is the account that sent it.
export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull().unique(),
    placedByUserId: uuid("placed_by_user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    placedByRole: userRole("placed_by_role"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerPhoneE164: text("customer_phone_e164").notNull(),
    city: text("city").notNull(),
    area: text("area"),
    address: text("address"),
    notes: text("notes"),
    fulfilment: fulfilmentMethod("fulfilment").notNull(),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id, {
      onDelete: "restrict",
    }),
    deliveryZoneName: text("delivery_zone_name"),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    subtotal: integer("subtotal").notNull(),
    discountTotal: integer("discount_total").notNull().default(0),
    total: integer("total").notNull(),
    // Cache of payments (feature 24); changes only with a ledger row.
    amountPaid: integer("amount_paid").notNull().default(0),
    status: orderStatus("status").notNull().default("new"),
    // Always inserted explicitly, with the same Date passed to `allocateOrderNumber`.
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: actorKind("cancelled_by"),
    cancelReason: text("cancel_reason"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("orders_placed_by_user_id_idx").on(t.placedByUserId),
    index("orders_customer_phone_e164_idx").on(t.customerPhoneE164),
    index("orders_delivery_zone_id_idx").on(t.deliveryZoneId),
    index("orders_status_idx").on(t.status),
    index("orders_placed_at_idx").on(t.placedAt),
    check("orders_delivery_fee_check", sql`${t.deliveryFee} >= 0`),
    check("orders_subtotal_check", sql`${t.subtotal} >= 0`),
    check("orders_discount_total_check", sql`${t.discountTotal} >= 0`),
    check(
      "orders_total_check",
      sql`${t.total} = ${t.subtotal} + ${t.deliveryFee} - ${t.discountTotal} and ${t.total} >= 0`,
    ),
    check("orders_amount_paid_check", sql`${t.amountPaid} >= 0`),
    check(
      "orders_delivery_check",
      sql`${t.fulfilment} <> 'delivery' or (${t.deliveryZoneId} is not null and ${t.deliveryZoneName} is not null and ${t.address} is not null and btrim(${t.address}) <> '')`,
    ),
    check(
      "orders_pickup_check",
      sql`${t.fulfilment} <> 'pickup' or (${t.deliveryFee} = 0 and ${t.deliveryZoneId} is null and ${t.deliveryZoneName} is null)`,
    ),
    check(
      "orders_cancelled_check",
      sql`(${t.status} = 'cancelled') = (${t.cancelledAt} is not null)`,
    ),
  ],
).enableRLS();

export const orderLines = pgTable(
  "order_lines",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").notNull(),
    productName: text("product_name").notNull(),
    productCode: text("product_code").notNull(),
    variantCode: text("variant_code"),
    sizeLabel: text("size_label"),
    colourName: text("colour_name"),
    quantity: integer("quantity").notNull(),
    // Copied at placement and never changed; `unit_price` starts equal and may be adjusted (feature 23).
    catalogUnitPrice: integer("catalog_unit_price").notNull(),
    unitPrice: integer("unit_price").notNull(),
    // Always the ordered amount, also after returns.
    lineTotal: integer("line_total").notNull(),
    sort: integer("sort").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("order_lines_order_id_idx").on(t.orderId),
    index("order_lines_product_id_idx").on(t.productId),
    index("order_lines_variant_id_idx").on(t.variantId),
    // A line's variant always belongs to the line's product.
    foreignKey({
      name: "order_lines_variant_product_fk",
      columns: [t.variantId, t.productId],
      foreignColumns: [productVariants.id, productVariants.productId],
    }).onDelete("restrict"),
    check("order_lines_quantity_check", sql`${t.quantity} > 0`),
    check("order_lines_catalog_unit_price_check", sql`${t.catalogUnitPrice} > 0`),
    check("order_lines_unit_price_check", sql`${t.unitPrice} >= 0`),
    check("order_lines_line_total_check", sql`${t.lineTotal} = ${t.unitPrice} * ${t.quantity}`),
  ],
).enableRLS();

export type OrderEventData = Readonly<Record<string, unknown>>;

// `data` never holds a phone or an address.
export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: orderEventType("type").notNull(),
    actorKind: actorKind("actor_kind").notNull(),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status"),
    data: jsonb("data").$type<OrderEventData>().notNull().default({}),
    // Set when the owner opens the order (feature 15); unseen events flag the dashboard.
    seenAt: timestamp("seen_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("order_events_order_id_idx").on(t.orderId),
    index("order_events_actor_user_id_idx").on(t.actorUserId),
    index("order_events_unseen_idx")
      .on(t.createdAt)
      .where(sql`${t.seenAt} is null`),
  ],
).enableRLS();
