import { readFileSync, readdirSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { expectViolation, hasLocalDb, insertSimpleProduct, withRollback } from "../testing";
import type { Transaction } from "../types";
import {
  colours,
  deliveryZones,
  orderLines,
  orders,
  productMedia,
  productVariants,
  products,
  profiles,
  shopSettings,
} from ".";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("../direct");
const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

const rows = <T>(result: Iterable<T>) => Array.from(result);

async function insertPickupOrder(tx: Transaction, orderNumber: string) {
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber,
      customerName: "زبون اختبار",
      customerPhone: "0599123456",
      customerPhoneE164: "+970599123456",
      city: "رام الله",
      fulfilment: "pickup",
      subtotal: 0,
      total: 0,
    })
    .returning();
  return order;
}

describe.skipIf(!hasLocalDb)("core schema on the local database", () => {
  // covers: AC-1
  describe("migrated shape", () => {
    it("has every core table with RLS enabled", async () => {
      const tables = rows(
        await db.execute<{ relname: string; relrowsecurity: boolean }>(sql`
          select c.relname, c.relrowsecurity from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'`),
      );
      const byName = new Map(tables.map((t) => [t.relname, t.relrowsecurity]));

      for (const name of [
        "profiles",
        "categories",
        "colours",
        "products",
        "product_variants",
        "product_media",
        "delivery_zones",
        "shop_settings",
        "order_number_counters",
        "orders",
        "order_lines",
        "order_events",
      ]) {
        expect(byName.get(name), name).toBe(true);
      }
    });

    it("has every core enum with its full list of values", async () => {
      const enums = rows(
        await db.execute<{ typname: string; labels: string[] }>(sql`
          select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
          from pg_type t join pg_enum e on e.enumtypid = t.oid
          join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' group by t.typname`),
      );
      const byName = Object.fromEntries(enums.map((e) => [e.typname, e.labels]));

      expect(byName).toMatchObject({
        user_role: ["customer", "electrician", "admin"],
        product_status: ["active", "hidden", "archived"],
        media_kind: ["image", "video"],
        fulfilment_method: ["pickup", "delivery"],
        order_status: [
          "new",
          "confirmed",
          "preparing",
          "ready",
          "out_for_delivery",
          "delivered",
          "cancelled",
        ],
        actor_kind: ["guest", "customer", "electrician", "admin", "system"],
        order_event_type: [
          "created",
          "status_changed",
          "cancelled",
          "line_price_changed",
          "payment_recorded",
          "return_requested",
          "return_decided",
          "note",
        ],
      });
    });

    it("has the named key constraints", async () => {
      const names = rows(
        await db.execute<{ conname: string }>(sql`
          select conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
          where n.nspname = 'public'`),
      ).map((r) => r.conname);

      expect(names).toEqual(
        expect.arrayContaining([
          "orders_order_number_unique",
          "orders_total_check",
          "orders_delivery_check",
          "orders_pickup_check",
          "orders_city_check",
          "orders_idempotency_key_unique",
          "orders_cancelled_check",
          "order_lines_line_total_check",
          "order_lines_variant_product_fk",
          "product_variants_options_unique",
          "product_variants_id_product_unique",
          "product_variants_price_check",
          "product_media_variant_product_fk",
          "products_code_unique",
          "products_slug_unique",
          "shop_settings_single_row_check",
          "profiles_id_users_id_fk",
        ]),
      );
    });

    it("has the named indexes, including both partial ones", async () => {
      const indexes = rows(
        await db.execute<{ indexname: string; indexdef: string }>(sql`
          select indexname, indexdef from pg_indexes where schemaname = 'public'`),
      );
      const byName = new Map(indexes.map((i) => [i.indexname, i.indexdef]));

      for (const name of [
        "orders_customer_phone_e164_idx",
        "orders_placed_at_idx",
        "orders_status_idx",
        "order_lines_variant_id_idx",
        "products_category_id_idx",
        "profiles_phone_e164_idx",
      ]) {
        expect(byName.has(name), name).toBe(true);
      }
      expect(byName.get("product_variants_one_default_idx")).toMatch(/UNIQUE.*WHERE is_default/);
      expect(byName.get("order_events_unseen_idx")).toMatch(/WHERE \(seen_at IS NULL\)/);
    });

    it("leaves no newer schema change ungenerated (the journal matches the files)", () => {
      const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
        entries: { tag: string }[];
      };
      const files = readdirSync("drizzle").filter((f) => f.endsWith(".sql"));

      expect(journal.entries.map((e) => `${e.tag}.sql`)).toEqual(files.sort());
    });

    it("holds the production rows: two delivery zones and one settings row", async () => {
      const zones = await db.select().from(deliveryZones);
      const settings = await db.select().from(shopSettings);

      expect(zones.map((z) => [z.name, z.fee])).toEqual(
        expect.arrayContaining([
          ["الضفة الغربية", 2000],
          ["الداخل (مناطق 48)", 7000],
        ]),
      );
      expect(settings).toEqual([expect.objectContaining({ id: 1, shopName: "S.K.F Lighting" })]);
    });
  });

  // covers: AC-3
  describe("profiles from auth users", () => {
    const BACKFILL =
      "insert into public.profiles (id, full_name) select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') from auth.users on conflict (id) do nothing;";

    const insertAuthUser = (tx: Transaction, meta: Record<string, string>) =>
      tx.execute<{ id: string }>(sql`
        insert into auth.users (id, aud, role, email, raw_user_meta_data)
        values (gen_random_uuid(), 'authenticated', 'authenticated',
          ${`test-${crypto.randomUUID()}@example.test`}, ${JSON.stringify(meta)}::jsonb)
        returning id`);

    it("creates a customer profile with the sign up name", async () => {
      await withRollback(db, async (tx) => {
        const [user] = rows(await insertAuthUser(tx, { full_name: "أحمد خليل" }));
        const [profile] = await tx.select().from(profiles).where(eq(profiles.id, user.id));

        expect(profile).toMatchObject({ role: "customer", fullName: "أحمد خليل", phone: null });
      });
    });

    it("falls back to Google's name, and to no name at all", async () => {
      await withRollback(db, async (tx) => {
        const [google] = rows(await insertAuthUser(tx, { name: "Sara Haddad" }));
        const [anonymous] = rows(await insertAuthUser(tx, {}));
        const found = await tx.select().from(profiles);
        const nameOf = (id: string) => found.find((p) => p.id === id)?.fullName;

        expect(nameOf(google.id)).toBe("Sara Haddad");
        expect(nameOf(anonymous.id)).toBeNull();
      });
    });

    it("backfills a user who existed before the migration, with the migration's own statement", async () => {
      const migration = readFileSync("drizzle/0001_lockdown_and_seed.sql", "utf8");
      expect(migration).toContain(BACKFILL);

      await withRollback(db, async (tx) => {
        const [user] = rows(await insertAuthUser(tx, { full_name: "قديم" }));
        await tx.delete(profiles).where(eq(profiles.id, user.id));
        await tx.execute(sql.raw(BACKFILL));
        const [profile] = await tx.select().from(profiles).where(eq(profiles.id, user.id));

        expect(profile).toMatchObject({ role: "customer", fullName: "قديم" });
      });
    });

    // Regression (review 2026-10-18): the 0001 backfill copied blank and padded names as typed.
    it("names backfilled users the way the trigger does, once 0003 has run", async () => {
      const fixForward = readFileSync("drizzle/0003_align_profile_backfill.sql", "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim());

      await withRollback(db, async (tx) => {
        const metas: Record<string, string>[] = [
          { full_name: "  أحمد خليل  " },
          { full_name: "", name: "Sara Haddad" },
          { full_name: "   ", name: "  " },
          { name: " Lina " },
          {},
        ];
        const users = [];
        for (const meta of metas) users.push(rows(await insertAuthUser(tx, meta))[0]);
        const ids = users.map((u) => u.id);
        const nameByTrigger = new Map(
          (await tx.select().from(profiles))
            .filter((p) => ids.includes(p.id))
            .map((p) => [p.id, p.fullName]),
        );

        for (const id of ids) await tx.delete(profiles).where(eq(profiles.id, id));
        await tx.execute(sql.raw(BACKFILL));
        for (const statement of fixForward) await tx.execute(sql.raw(statement));
        const backfilled = (await tx.select().from(profiles)).filter((p) => ids.includes(p.id));

        expect(new Map(backfilled.map((p) => [p.id, p.fullName]))).toEqual(nameByTrigger);
        expect([...nameByTrigger.values()]).toEqual([
          "أحمد خليل",
          "Sara Haddad",
          null,
          "Lina",
          null,
        ]);
      });
    });

    it("leaves a name that differs from the raw sign up value alone", async () => {
      const fixForward = readFileSync("drizzle/0003_align_profile_backfill.sql", "utf8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim());

      await withRollback(db, async (tx) => {
        const [user] = rows(await insertAuthUser(tx, { full_name: "  قديم  " }));
        await tx.update(profiles).set({ fullName: "اسم جديد" }).where(eq(profiles.id, user.id));
        for (const statement of fixForward) await tx.execute(sql.raw(statement));
        const [profile] = await tx.select().from(profiles).where(eq(profiles.id, user.id));

        expect(profile.fullName).toBe("اسم جديد");
      });
    });

    it("leaves no auth user without a profile", async () => {
      const [missing] = rows(
        await db.execute<{ count: number }>(sql`
          select count(*)::int as count from auth.users u
          left join public.profiles p on p.id = u.id where p.id is null`),
      );

      expect(missing.count).toBe(0);
    });
  });

  // covers: AC-4
  describe("variants", () => {
    it("rejects a second variant with no size and no colour on the same product", async () => {
      await withRollback(db, async (tx) => {
        const { product } = await insertSimpleProduct(tx);

        await expectViolation(tx, "product_variants_options_unique", (sp) =>
          sp.insert(productVariants).values({ productId: product.id, price: 100 }),
        );
      });
    });

    it("rejects the same size and colour twice, but allows other combinations", async () => {
      await withRollback(db, async (tx) => {
        const { product, colour } = await insertSimpleProduct(tx);
        const sized = { productId: product.id, price: 100, sizeLabel: "60 سم" };
        await tx.insert(productVariants).values({ ...sized, colourId: colour.id });
        await tx.insert(productVariants).values(sized);

        await expectViolation(tx, "product_variants_options_unique", (sp) =>
          sp.insert(productVariants).values({ ...sized, colourId: colour.id }),
        );
      });
    });

    it("allows only one default variant per product", async () => {
      await withRollback(db, async (tx) => {
        const { product } = await insertSimpleProduct(tx);

        await expectViolation(tx, "product_variants_one_default_idx", (sp) =>
          sp
            .insert(productVariants)
            .values({ productId: product.id, price: 100, sizeLabel: "كبير", isDefault: true }),
        );
      });
    });

    it.each([0, -100])("rejects a price of %i agorot", async (price) => {
      await withRollback(db, async (tx) => {
        const { product } = await insertSimpleProduct(tx);

        await expectViolation(tx, "product_variants_price_check", (sp) =>
          sp.insert(productVariants).values({ productId: product.id, price, sizeLabel: "صغير" }),
        );
      });
    });

    it("rejects a fractional price, since money is integer agorot", async () => {
      await withRollback(db, async (tx) => {
        const { product } = await insertSimpleProduct(tx);
        const error = await tx
          .transaction((sp) =>
            sp
              .insert(productVariants)
              .values({ productId: product.id, price: 10.5, sizeLabel: "x" }),
          )
          .catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(Error);
      });
    });

    it("rejects a product code that is not upper case and trimmed", async () => {
      await withRollback(db, async (tx) => {
        const { category } = await insertSimpleProduct(tx);

        await expectViolation(tx, "products_code_check", (sp) =>
          sp
            .insert(products)
            .values({ categoryId: category.id, code: " ch-1 ", name: "x", slug: "x-ch-1" }),
        );
      });
    });
  });

  // covers: AC-8
  // covers: AC-11, AC-15, AC-16 (spec 0006)
  describe("product management migration", () => {
    it("starts every product at version 1", async () => {
      await withRollback(db, async (tx) => {
        const { product } = await insertSimpleProduct(tx, "TEST-V1");
        expect(product.version).toBe(1);
      });
    });

    it("allows one video per product, and many photos", async () => {
      await withRollback(db, async (tx) => {
        const { product } = await insertSimpleProduct(tx, "TEST-VID");
        const key = (n: number, ext: string) => `products/${product.id}/test-${n}.${ext}`;
        await tx.insert(productMedia).values([
          { productId: product.id, kind: "image", storageKey: key(1, "webp"), sort: 0 },
          { productId: product.id, kind: "image", storageKey: key(2, "webp"), sort: 1 },
          { productId: product.id, kind: "video", storageKey: key(3, "mp4"), sort: 2 },
        ]);
        await expectViolation(tx, "product_media_one_video_idx", (sp) =>
          sp
            .insert(productMedia)
            .values({ productId: product.id, kind: "video", storageKey: key(4, "mp4") }),
        );
      });
    });

    it("lets the media sweep login read product ids and nothing else", async () => {
      const access = rows(
        await db.execute<{ login: boolean; id: boolean; name: boolean; orders: boolean }>(sql`
          select r.rolcanlogin as login,
            has_column_privilege('media_sweep', 'public.products', 'id', 'select') as id,
            has_column_privilege('media_sweep', 'public.products', 'name', 'select') as name,
            has_table_privilege('media_sweep', 'public.orders', 'select') as orders
          from pg_roles r where r.rolname = 'media_sweep'`),
      );
      expect(access).toEqual([{ login: true, id: true, name: false, orders: false }]);
    });
  });

  describe("fulfilment rules on orders", () => {
    const base = {
      customerName: "زبون",
      customerPhone: "0599123456",
      customerPhoneE164: "+970599123456",
      city: "نابلس",
      subtotal: 10_000,
    };

    it("rejects a delivery order without an address", async () => {
      await withRollback(db, async (tx) => {
        const [zone] = await tx.select().from(deliveryZones).limit(1);
        const delivery = {
          ...base,
          fulfilment: "delivery" as const,
          deliveryZoneId: zone.id,
          deliveryZoneName: zone.name,
          deliveryFee: zone.fee,
          total: base.subtotal + zone.fee,
        };

        await expectViolation(tx, "orders_delivery_check", (sp) =>
          sp.insert(orders).values({ ...delivery, orderNumber: "T-1" }),
        );
        await expectViolation(tx, "orders_delivery_check", (sp) =>
          sp.insert(orders).values({ ...delivery, orderNumber: "T-2", address: "   " }),
        );
      });
    });

    it("rejects a delivery order without a zone", async () => {
      await withRollback(db, async (tx) => {
        await expectViolation(tx, "orders_delivery_check", (sp) =>
          sp.insert(orders).values({
            ...base,
            orderNumber: "T-3",
            fulfilment: "delivery",
            address: "شارع الإرسال",
            total: base.subtotal,
          }),
        );
      });
    });

    it("rejects a pickup order with a delivery fee", async () => {
      await withRollback(db, async (tx) => {
        await expectViolation(tx, "orders_pickup_check", (sp) =>
          sp.insert(orders).values({
            ...base,
            orderNumber: "T-4",
            fulfilment: "pickup",
            deliveryFee: 2000,
            total: base.subtotal + 2000,
          }),
        );
      });
    });

    it("accepts a pickup order without an address, and a delivery order with zone and address", async () => {
      await withRollback(db, async (tx) => {
        const [zone] = await tx.select().from(deliveryZones).limit(1);
        await tx
          .insert(orders)
          .values({ ...base, orderNumber: "T-5", fulfilment: "pickup", total: base.subtotal });
        await tx.insert(orders).values({
          ...base,
          orderNumber: "T-6",
          fulfilment: "delivery",
          address: "شارع الإرسال 4",
          deliveryZoneId: zone.id,
          deliveryZoneName: zone.name,
          deliveryFee: zone.fee,
          total: base.subtotal + zone.fee,
        });

        const placed = await tx.select({ n: orders.orderNumber }).from(orders);
        expect(placed.map((o) => o.n)).toEqual(expect.arrayContaining(["T-5", "T-6"]));
      });
    });

    // covers: AC-6, AC-7 (spec 0004)
    it("lets a pickup order have no city, but not a delivery order", async () => {
      await withRollback(db, async (tx) => {
        const [zone] = await tx.select().from(deliveryZones).limit(1);
        const delivery = {
          ...base,
          fulfilment: "delivery" as const,
          address: "شارع الإرسال 4",
          deliveryZoneId: zone.id,
          deliveryZoneName: zone.name,
          deliveryFee: zone.fee,
          total: base.subtotal + zone.fee,
        };

        await tx.insert(orders).values({
          ...base,
          orderNumber: "T-10",
          fulfilment: "pickup",
          city: null,
          total: base.subtotal,
        });
        await expectViolation(tx, "orders_city_check", (sp) =>
          sp.insert(orders).values({ ...delivery, orderNumber: "T-11", city: null }),
        );
        await expectViolation(tx, "orders_city_check", (sp) =>
          sp.insert(orders).values({ ...delivery, orderNumber: "T-12", city: "  " }),
        );
      });
    });

    // covers: AC-9 (spec 0004)
    it("allows one order per idempotency key, and many orders with none", async () => {
      await withRollback(db, async (tx) => {
        const key = "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11";
        const pickup = { ...base, fulfilment: "pickup" as const, total: base.subtotal };
        await tx.insert(orders).values([
          { ...pickup, orderNumber: "T-13", idempotencyKey: key },
          { ...pickup, orderNumber: "T-14" },
          { ...pickup, orderNumber: "T-15" },
        ]);
        await expectViolation(tx, "orders_idempotency_key_unique", (sp) =>
          sp.insert(orders).values({ ...pickup, orderNumber: "T-16", idempotencyKey: key }),
        );
      });
    });

    it("rejects a cancelled status without a cancelled time", async () => {
      await withRollback(db, async (tx) => {
        await expectViolation(tx, "orders_cancelled_check", (sp) =>
          sp.insert(orders).values({
            ...base,
            orderNumber: "T-7",
            fulfilment: "pickup",
            total: base.subtotal,
            status: "cancelled",
          }),
        );
      });
    });
  });

  // covers: AC-9
  describe("references from orders into the catalog", () => {
    async function orderOf(tx: Transaction) {
      const fixture = await insertSimpleProduct(tx);
      await tx
        .update(productVariants)
        .set({ colourId: fixture.colour.id })
        .where(eq(productVariants.id, fixture.variant.id));
      const order = await insertPickupOrder(tx, "T-REF");
      await tx.insert(orderLines).values({
        orderId: order.id,
        productId: fixture.product.id,
        variantId: fixture.variant.id,
        productName: fixture.product.name,
        productCode: fixture.product.code,
        quantity: 1,
        catalogUnitPrice: fixture.variant.price,
        unitPrice: fixture.variant.price,
        lineTotal: fixture.variant.price,
      });
      return { ...fixture, order };
    }

    it("cannot delete an ordered variant, its product, or a colour a variant uses", async () => {
      await withRollback(db, async (tx) => {
        const { product, variant, colour } = await orderOf(tx);

        await expectViolation(tx, "order_lines_variant_product_fk", (sp) =>
          sp.delete(productVariants).where(eq(productVariants.id, variant.id)),
        );
        await expectViolation(tx, "order_lines_product_id_products_id_fk", (sp) =>
          sp.delete(products).where(eq(products.id, product.id)),
        );
        await expectViolation(tx, "product_variants_colour_id_colours_id_fk", (sp) =>
          sp.delete(colours).where(eq(colours.id, colour.id)),
        );
      });
    });

    it("keeps an archived product and variant on the old order", async () => {
      await withRollback(db, async (tx) => {
        const { product, variant, order } = await orderOf(tx);
        await tx.update(products).set({ status: "archived" }).where(eq(products.id, product.id));
        await tx
          .update(productVariants)
          .set({ archivedAt: new Date() })
          .where(eq(productVariants.id, variant.id));

        const [line] = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id));
        expect(line).toMatchObject({ productName: "ثريا اختبار", productCode: "TEST-1" });
      });
    });

    it("rejects a line whose variant belongs to another product", async () => {
      await withRollback(db, async (tx) => {
        const first = await insertSimpleProduct(tx, "TEST-A");
        const second = await insertSimpleProduct(tx, "TEST-B");
        const order = await insertPickupOrder(tx, "T-MIX");

        await expectViolation(tx, "order_lines_variant_product_fk", (sp) =>
          sp.insert(orderLines).values({
            orderId: order.id,
            productId: first.product.id,
            variantId: second.variant.id,
            productName: "x",
            productCode: "TEST-A",
            quantity: 1,
            catalogUnitPrice: 100,
            unitPrice: 100,
            lineTotal: 100,
          }),
        );
      });
    });

    it("keeps a photo on its product when its variant is deleted, and rejects another product's variant", async () => {
      await withRollback(db, async (tx) => {
        const first = await insertSimpleProduct(tx, "TEST-C");
        const second = await insertSimpleProduct(tx, "TEST-D");
        const [extra] = await tx
          .insert(productVariants)
          .values({ productId: first.product.id, price: 100, sizeLabel: "كبير" })
          .returning();
        const [photo] = await tx
          .insert(productMedia)
          .values({
            productId: first.product.id,
            variantId: extra.id,
            kind: "image",
            storageKey: `products/${first.product.id}/a.webp`,
          })
          .returning();

        await expectViolation(tx, "product_media_variant_product_fk", (sp) =>
          sp.insert(productMedia).values({
            productId: first.product.id,
            variantId: second.variant.id,
            kind: "image",
            storageKey: `products/${first.product.id}/b.webp`,
          }),
        );

        await tx.delete(productVariants).where(eq(productVariants.id, extra.id));
        const [kept] = await tx.select().from(productMedia).where(eq(productMedia.id, photo.id));
        expect(kept).toMatchObject({ productId: first.product.id, variantId: null });
      });
    });
  });
});
