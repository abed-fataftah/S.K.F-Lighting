import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { categories, products } from "./catalog";
import { createdAt, id, timestamps } from "./columns";

// The homepage the owner runs from `/admin/homepage` (spec 0011). At most 10 banners and 5 active,
// and at most 8 featured products: the actions check the caps under the `home_version` row lock.
// Migration 0007 also lets the `media_sweep` login read `image_key` (policy `banners_media_sweep_read`).

// One 16:9 picture with its words drawn in; `alt` is what screen readers read. A link points at a
// category or a product, never both; deleting the target clears it.
export const banners = pgTable(
  "banners",
  {
    id: id(),
    // `banners/<uuid>.<webp|jpg>` in the `product-media` bucket, chosen by the server.
    imageKey: text("image_key").notNull(),
    alt: text("alt").notNull(),
    linkCategoryId: uuid("link_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    linkProductId: uuid("link_product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    sort: integer("sort").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("banners_link_category_id_idx").on(t.linkCategoryId),
    index("banners_link_product_id_idx").on(t.linkProductId),
    check(
      "banners_one_link_check",
      sql`num_nonnulls(${t.linkCategoryId}, ${t.linkProductId}) <= 1`,
    ),
  ],
).enableRLS();

// The owner's picks in Home order; Home shows only the listed ones (spec 0011 AC-5).
export const featuredProducts = pgTable("featured_products", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  sort: integer("sort").notNull(),
  createdAt: createdAt(),
}).enableRLS();
