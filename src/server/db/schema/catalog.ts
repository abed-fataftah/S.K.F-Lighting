import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { id, timestamps } from "./columns";
import { mediaKind, productStatus } from "./enums";

export type ProductSpec = { readonly label: string; readonly value: string };

// Two levels at most; the category action (feature 9) rejects a grandchild.
export const categories = pgTable(
  "categories",
  {
    id: id(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    sort: integer("sort").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("categories_parent_id_idx").on(t.parentId),
    check("categories_parent_not_self_check", sql`${t.parentId} <> ${t.id}`),
  ],
).enableRLS();

export const colours = pgTable(
  "colours",
  {
    id: id(),
    name: text("name").notNull().unique(),
    hex: text("hex"),
    sort: integer("sort").notNull().default(0),
    ...timestamps(),
  },
  (t) => [check("colours_hex_check", sql`${t.hex} ~ '^#[0-9A-Fa-f]{6}$'`)],
).enableRLS();

// `code` never changes after create (import upserts and photos match by it);
// `slug` is set once from `buildProductSlug(name, code)` and never regenerated.
export const products = pgTable(
  "products",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    specs: jsonb("specs").$type<readonly ProductSpec[]>().notNull().default([]),
    status: productStatus("status").notNull().default("active"),
    isAvailable: boolean("is_available").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
    check("products_code_check", sql`${t.code} = upper(btrim(${t.code}))`),
    check("products_specs_check", sql`jsonb_typeof(${t.specs}) = 'array'`),
  ],
).enableRLS();

// One row per size and colour combination. A product with no options has exactly one
// variant (no size, no colour, `is_default`); the product actions (feature 7) keep that true.
export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sizeLabel: text("size_label"),
    sizeSort: integer("size_sort").notNull().default(0),
    colourId: uuid("colour_id").references(() => colours.id, { onDelete: "restrict" }),
    code: text("code").unique(),
    price: integer("price").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index("product_variants_product_id_idx").on(t.productId),
    index("product_variants_colour_id_idx").on(t.colourId),
    unique("product_variants_options_unique")
      .on(t.productId, t.sizeLabel, t.colourId)
      .nullsNotDistinct(),
    // Target of the composite foreign keys that keep a line's (or photo's) variant on its product.
    unique("product_variants_id_product_unique").on(t.id, t.productId),
    uniqueIndex("product_variants_one_default_idx")
      .on(t.productId)
      .where(sql`${t.isDefault}`),
    check("product_variants_code_check", sql`${t.code} = upper(btrim(${t.code}))`),
    check("product_variants_price_check", sql`${t.price} > 0`),
  ],
).enableRLS();

// The composite FK `(variant_id, product_id)` with `on delete set null (variant_id)` lives in the
// custom migration: Drizzle cannot express a column list on `set null`.
export const productMedia = pgTable(
  "product_media",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id"),
    kind: mediaKind("kind").notNull(),
    // `products/{productId}/{uuid}.{ext}` in the `product-media` bucket (spec 0001).
    storageKey: text("storage_key").notNull().unique(),
    alt: text("alt"),
    width: integer("width"),
    height: integer("height"),
    sort: integer("sort").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index("product_media_product_id_idx").on(t.productId),
    index("product_media_variant_id_idx").on(t.variantId),
  ],
).enableRLS();
