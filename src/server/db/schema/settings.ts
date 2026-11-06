import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, smallint, text } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./columns";

// The migration inserts the two launch zones; the owner edits, adds (up to 10), and pauses them from
// `/admin/settings` (spec 0025). A zone is never deleted: orders keep its name and fee.
export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: id(),
    name: text("name").notNull().unique(),
    // The word Home shows before the fee ("الضفة ₪20"); checkout keeps the full `name` (spec 0011 AC-14).
    shortName: text("short_name").notNull(),
    fee: integer("fee").notNull(),
    sort: integer("sort").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    check("delivery_zones_fee_check", sql`${t.fee} >= 0`),
    // Whole shekels from ₪0 to ₪500 (spec 0025 AC-5).
    check(
      "delivery_zones_fee_range_check",
      sql`${t.fee} between 0 and 50000 and ${t.fee} % 100 = 0`,
    ),
  ],
).enableRLS();

// Exactly one row, inserted by the migration.
export const shopSettings = pgTable(
  "shop_settings",
  {
    id: smallint("id").primaryKey().default(1),
    shopName: text("shop_name").notNull(),
    // Digits with the country code; null falls back to NEXT_PUBLIC_WHATSAPP_NUMBER (spec 0025 AC-4).
    whatsappNumber: text("whatsapp_number"),
    contactPhone: text("contact_phone"),
    email: text("email"),
    address: text("address"),
    // Bumped once by every homepage write, under its row lock; a write sent with an older value is
    // `stale` (spec 0011 AC-9). The settings writes (spec 0025) leave it alone.
    homeVersion: integer("home_version").notNull().default(0),
    ...timestamps(),
  },
  (t) => [check("shop_settings_single_row_check", sql`${t.id} = 1`)],
).enableRLS();

// No `updated_at`: `allocateOrderNumber` bumps `last_value` in an upsert, one row per year.
export const orderNumberCounters = pgTable("order_number_counters", {
  year: smallint("year").primaryKey(),
  lastValue: integer("last_value").notNull().default(0),
  createdAt: createdAt(),
}).enableRLS();
