import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariants, products } from "./catalog";
import { createdAt, id, timestamps } from "./columns";
import { fulfilmentMethod } from "./enums";
import { profiles } from "./profiles";
import { deliveryZones } from "./settings";

// An electrician's named order in progress (spec 0020). The customer fields are the end customer,
// stored as typed while drafting and checked only on send. The id becomes the order's
// `idempotency_key`, and sending deletes the draft in the same transaction. Drafts hold personal
// data: they go with the profile on removal and never reach a log.
export const drafts = pgTable(
  "drafts",
  {
    id: id(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    customerName: text("customer_name"),
    customerPhone: text("customer_phone"),
    customerPhoneE164: text("customer_phone_e164"),
    fulfilment: fulfilmentMethod("fulfilment"),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id, {
      onDelete: "set null",
    }),
    city: text("city"),
    address: text("address"),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    // The name is unique per owner, Latin letters compared case insensitively (AC-4).
    uniqueIndex("drafts_owner_name_unique").on(t.ownerUserId, sql`lower(${t.name})`),
    index("drafts_owner_updated_idx").on(t.ownerUserId, t.updatedAt.desc(), t.id.desc()),
    index("drafts_delivery_zone_id_idx").on(t.deliveryZoneId),
    check("drafts_name_check", sql`char_length(${t.name}) between 2 and 40`),
  ],
).enableRLS();

// A line is empty, product only, or complete (option and quantity). No price is stored: every
// read takes the live `product_variants.price`.
export const draftLines = pgTable(
  "draft_lines",
  {
    id: id(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id"),
    quantity: integer("quantity"),
    sort: integer("sort").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("draft_lines_draft_id_idx").on(t.draftId),
    index("draft_lines_product_id_idx").on(t.productId),
    index("draft_lines_variant_id_idx").on(t.variantId),
    // A line's option always belongs to the line's product.
    foreignKey({
      name: "draft_lines_variant_product_fk",
      columns: [t.variantId, t.productId],
      foreignColumns: [productVariants.id, productVariants.productId],
    }).onDelete("restrict"),
    // The composite key is not checked when one part is null, so an option needs its product.
    check(
      "draft_lines_variant_needs_product_check",
      sql`${t.variantId} is null or ${t.productId} is not null`,
    ),
    check("draft_lines_quantity_check", sql`${t.quantity} between 1 and 999`),
    // One line per option; nulls are distinct, so empty and product only lines may repeat.
    unique("draft_lines_draft_variant_unique").on(t.draftId, t.variantId),
  ],
).enableRLS();
