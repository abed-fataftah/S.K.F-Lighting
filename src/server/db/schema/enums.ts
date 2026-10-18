import { pgEnum } from "drizzle-orm/pg-core";

// Adding a value later is safe, but `ALTER TYPE ... ADD VALUE` needs its own migration
// before any migration that uses the new value.

export const userRole = pgEnum("user_role", ["customer", "electrician", "admin"]);

export const productStatus = pgEnum("product_status", ["active", "hidden", "archived"]);

export const mediaKind = pgEnum("media_kind", ["image", "video"]);

export const fulfilmentMethod = pgEnum("fulfilment_method", ["pickup", "delivery"]);

export const orderStatus = pgEnum("order_status", [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
]);

export const actorKind = pgEnum("actor_kind", [
  "guest",
  "customer",
  "electrician",
  "admin",
  "system",
]);

// The full list now, so later features need no `ALTER TYPE`.
export const orderEventType = pgEnum("order_event_type", [
  "created",
  "status_changed",
  "cancelled",
  "line_price_changed",
  "payment_recorded",
  "return_requested",
  "return_decided",
  "note",
]);
