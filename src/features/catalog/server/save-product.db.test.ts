import { and, asc, eq, isNull } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  categories,
  colours,
  orderLines,
  orders,
  productMedia,
  products,
  productVariants,
} from "@/server/db/schema";
import { hasLocalDb, withRollback } from "@/server/db/testing";
import type { Database, Transaction } from "@/server/db/types";
import { mediaKey } from "../media-rules";
import { productEditorSchema, type ProductEditorInput } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { saveProductInDb } = await import("./save-product");
const { deleteProductInDb, restoreProductInDb } = await import("./product-lifecycle");
const { readAdminProducts, readProductEditor } = await import("./admin-queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// covers: AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-10, AC-11, AC-12, AC-13, AC-18 (spec 0006)

type Db = Database | Transaction;

const input = (fields: Partial<ProductEditorInput>) =>
  productEditorSchema.parse({
    id: crypto.randomUUID(),
    version: null,
    name: "ثريا اختبار",
    code: `TSP-${crypto.randomUUID().slice(0, 8)}`,
    newCategoryName: "فئة اختبار الحفظ",
    specs: [],
    visible: true,
    available: true,
    price: "125.50",
    sizes: [],
    colours: [],
    pairs: [],
    media: [],
    ...fields,
  });

const grid = (sizeCount: number, colourCount: number, off: readonly string[] = []) =>
  Array.from({ length: sizeCount || 1 }, (_, s) =>
    Array.from({ length: colourCount || 1 }, (_, c) => ({
      size: sizeCount ? s : null,
      colour: colourCount ? c : null,
      available: !off.includes(`${s}:${c}`),
    })),
  ).flat();

async function saved(tx: Db, data: ReturnType<typeof input>) {
  const outcome = await saveProductInDb(tx, data);
  if (outcome.kind !== "saved") throw new Error(`not saved: ${outcome.kind}`);
  return outcome;
}

const liveVariants = (tx: Db, productId: string) =>
  tx
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), isNull(productVariants.archivedAt)))
    .orderBy(asc(productVariants.sizeSort), asc(productVariants.sort));

async function placeOrderLine(tx: Db, variant: typeof productVariants.$inferSelect) {
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber: `T-${crypto.randomUUID().slice(0, 12)}`,
      customerName: "زبون اختبار",
      customerPhone: "0599123456",
      customerPhoneE164: "+970599123456",
      fulfilment: "pickup",
      subtotal: variant.price,
      total: variant.price,
    })
    .returning();
  const [line] = await tx
    .insert(orderLines)
    .values({
      orderId: order.id,
      productId: variant.productId,
      variantId: variant.id,
      productName: "ثريا اختبار",
      productCode: "TSP",
      sizeLabel: variant.sizeLabel,
      quantity: 1,
      catalogUnitPrice: variant.price,
      unitPrice: variant.price,
      lineTotal: variant.price,
    })
    .returning();
  return { order, line };
}

describe.skipIf(!hasLocalDb)("saveProductInDb on the local database", () => {
  it("creates a simple product: active, version 1, one default plain variant", async () => {
    await withRollback(db, async (tx) => {
      const data = input({ code: " tsp-simple " });
      const outcome = await saved(tx, data);
      expect(outcome).toMatchObject({ id: data.id, version: 1, status: "active" });
      expect(outcome.slug).toBe("ثريا-اختبار-TSP-SIMPLE");

      const [product] = await tx.select().from(products).where(eq(products.id, data.id));
      expect(product).toMatchObject({ code: "TSP-SIMPLE", version: 1, isAvailable: true });
      expect(outcome.category).toEqual({ mainId: product.categoryId, subId: null });
      expect(await liveVariants(tx, data.id)).toMatchObject([
        { sizeLabel: null, colourId: null, price: 12_550, isDefault: true, isAvailable: true },
      ]);
    });
  });

  it("creates sizes by colours with per size prices, a new colour, ticks, specs, and the default", async () => {
    await withRollback(db, async (tx) => {
      const [listed] = await tx.insert(colours).values({ name: "لون مدرج للاختبار" }).returning();
      const data = input({
        sizes: [
          { label: "صغير", price: "100" },
          { label: "كبير", price: "150" },
        ],
        colours: [{ colourId: listed.id }, { newName: "لون جديد للاختبار" }],
        pairs: grid(2, 2, ["0:0"]),
        specs: [
          { label: "القدرة", value: "60W" },
          { label: "القطر (سم)", value: "" },
        ],
      });
      await saved(tx, data);

      const rows = await liveVariants(tx, data.id);
      const [created] = await tx
        .select()
        .from(colours)
        .where(eq(colours.name, "لون جديد للاختبار"));
      expect(created).toMatchObject({ hex: null, sort: 0 });
      expect(
        rows.map((v) => [v.sizeLabel, v.colourId, v.price, v.isAvailable, v.isDefault]),
      ).toEqual([
        ["صغير", listed.id, 10_000, false, false],
        ["صغير", created.id, 10_000, true, true],
        ["كبير", listed.id, 15_000, true, false],
        ["كبير", created.id, 15_000, true, false],
      ]);
      const [product] = await tx.select().from(products).where(eq(products.id, data.id));
      expect(product.specs).toEqual([{ label: "القدرة", value: "60W" }]);
    });
  });

  it("reuses a listed colour typed under a new name, in any case", async () => {
    await withRollback(db, async (tx) => {
      const [listed] = await tx.insert(colours).values({ name: "Gold اختبار" }).returning();
      const data = input({
        colours: [{ newName: " gold اختبار " }],
        pairs: grid(0, 1),
        price: "10",
      });
      await saved(tx, data);
      expect((await liveVariants(tx, data.id))[0].colourId).toBe(listed.id);
    });
  });

  it("refuses a repeated create as stale and a taken code, writing nothing", async () => {
    await withRollback(db, async (tx) => {
      const data = input({});
      await saved(tx, data);
      expect(await saveProductInDb(tx, data)).toEqual({ kind: "stale" });

      const before = await tx.select().from(categories);
      const taken = input({ code: data.code, newCategoryName: "فئة لن تحفظ" });
      expect(await saveProductInDb(tx, taken)).toEqual({ kind: "code_taken" });
      expect(await tx.select().from(categories)).toHaveLength(before.length);
    });
  });

  it("checks the version: a stale save writes nothing and a good one bumps it by 1", async () => {
    await withRollback(db, async (tx) => {
      const data = input({});
      await saved(tx, data);

      const second = await saved(tx, { ...data, version: 1, name: "ثريا معدلة" });
      expect(second.version).toBe(2);
      expect(await saveProductInDb(tx, { ...data, version: 1, name: "ثريا قديمة" })).toEqual({
        kind: "stale",
      });
      const [product] = await tx.select().from(products).where(eq(products.id, data.id));
      expect(product).toMatchObject({ name: "ثريا معدلة", version: 2 });

      expect(await saveProductInDb(tx, { ...data, id: crypto.randomUUID(), version: 1 })).toEqual({
        kind: "not_found",
      });
      expect(await saveProductInDb(tx, { ...data, version: 2, code: "OTHER-CODE" })).toEqual({
        kind: "code_changed",
      });
    });
  });

  it("keeps the slug on rename and hides or marks unavailable from the switches", async () => {
    await withRollback(db, async (tx) => {
      const data = input({});
      const first = await saved(tx, data);
      await saved(tx, { ...data, version: 1, name: "اسم جديد", visible: false, available: false });
      const [product] = await tx.select().from(products).where(eq(products.id, data.id));
      expect(product).toMatchObject({
        slug: first.slug,
        name: "اسم جديد",
        status: "hidden",
        isAvailable: false,
      });
    });
  });

  it("stores the sub category under its main, and refuses one under another main", async () => {
    await withRollback(db, async (tx) => {
      const [main] = await tx
        .insert(categories)
        .values({ name: "رئيسي اختبار", slug: "test-main-save" })
        .returning();
      const [other] = await tx
        .insert(categories)
        .values({ name: "رئيسي آخر", slug: "test-other-save" })
        .returning();
      const [sub] = await tx
        .insert(categories)
        .values({ name: "فرعي اختبار", slug: "test-sub-save", parentId: main.id })
        .returning();

      const data = input({ newCategoryName: "", categoryId: main.id, subCategoryId: sub.id });
      await saved(tx, data);
      const [product] = await tx.select().from(products).where(eq(products.id, data.id));
      expect(product.categoryId).toBe(sub.id);
      expect((await readProductEditor(tx, data.id))?.mainCategoryId).toBe(main.id);

      const wrong = input({ newCategoryName: "", categoryId: other.id, subCategoryId: sub.id });
      expect(await saveProductInDb(tx, wrong)).toEqual({ kind: "category_required" });
      const subAsMain = input({ newCategoryName: "", categoryId: sub.id });
      expect(await saveProductInDb(tx, subAsMain)).toEqual({ kind: "category_required" });
    });
  });

  it("keeps the plain row's id from simple to options and back", async () => {
    await withRollback(db, async (tx) => {
      const data = input({});
      await saved(tx, data);
      const [plain] = await liveVariants(tx, data.id);

      const sized = {
        ...data,
        version: 1,
        sizes: [
          { originalLabel: null, label: "S", price: 1_000 },
          { originalLabel: null, label: "L", price: 2_000 },
        ],
        pairs: grid(2, 0),
        price: null,
      };
      await saved(tx, sized);
      const rows = await liveVariants(tx, data.id);
      expect(rows.map((v) => [v.id === plain.id, v.sizeLabel])).toEqual([
        [true, "S"],
        [false, "L"],
      ]);

      await saved(tx, { ...data, version: 2, price: 5_000 });
      expect(await liveVariants(tx, data.id)).toMatchObject([
        { id: plain.id, sizeLabel: null, price: 5_000, isDefault: true },
      ]);
    });
  });

  it("keeps every order line the same through rename, price change, removal, restore, and archive", async () => {
    await withRollback(db, async (tx) => {
      const sizes = [
        { label: "S", price: "100" },
        { label: "L", price: "200" },
      ];
      const data = input({ sizes, pairs: grid(2, 0) });
      await saved(tx, data);
      const [small] = await liveVariants(tx, data.id);
      const { line } = await placeOrderLine(tx, small);
      const lineNow = async () =>
        (await tx.select().from(orderLines).where(eq(orderLines.id, line.id)))[0];

      // Rename S and change its price: the same row, the line unchanged.
      await saved(tx, {
        ...data,
        version: 1,
        sizes: [
          { originalLabel: "S", label: "صغير", price: 12_000 },
          { originalLabel: "L", label: "L", price: 20_000 },
        ],
      });
      const [renamed] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, small.id));
      expect(renamed).toMatchObject({ sizeLabel: "صغير", price: 12_000, archivedAt: null });
      expect(await lineNow()).toEqual(line);

      // Remove it: archived, not deleted, and the line still points at it.
      await saved(tx, {
        ...data,
        version: 2,
        sizes: [{ originalLabel: "L", label: "L", price: 20_000 }],
        pairs: grid(1, 0),
      });
      const [archived] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, small.id));
      expect(archived.archivedAt).not.toBeNull();
      expect(archived.isDefault).toBe(false);
      expect(await lineNow()).toEqual(line);

      // Add it back under the same label: the archived row comes back.
      await saved(tx, {
        ...data,
        version: 3,
        sizes: [
          { originalLabel: null, label: "صغير", price: 13_000 },
          { originalLabel: "L", label: "L", price: 20_000 },
        ],
        pairs: grid(2, 0),
      });
      const [restored] = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, small.id));
      expect(restored).toMatchObject({ archivedAt: null, price: 13_000 });

      // Delete the product: ordered, so archived.
      expect(await deleteProductInDb(tx, data.id, 4)).toEqual({ kind: "archived", version: 5 });
      expect(await lineNow()).toEqual(line);
      expect(await saveProductInDb(tx, { ...data, version: 5 })).toEqual({ kind: "archived" });
    });
  });

  it("swaps two size labels and renames into a label an archived row holds", async () => {
    await withRollback(db, async (tx) => {
      const data = input({
        sizes: [
          { label: "A", price: "1" },
          { label: "B", price: "2" },
          { label: "C", price: "3" },
        ],
        pairs: grid(3, 0),
      });
      await saved(tx, data);
      const [, , c] = await liveVariants(tx, data.id);
      await placeOrderLine(tx, c);
      // Remove C (archived, keeps "C"), and swap A and B.
      await saved(tx, {
        ...data,
        version: 1,
        sizes: [
          { originalLabel: "A", label: "B", price: 100 },
          { originalLabel: "B", label: "A", price: 200 },
        ],
        pairs: grid(2, 0),
      });
      // Rename B (now first) into C, which the archived row holds.
      await saved(tx, {
        ...data,
        version: 2,
        sizes: [
          { originalLabel: "B", label: "C", price: 100 },
          { originalLabel: "A", label: "A", price: 200 },
        ],
        pairs: grid(2, 0),
      });
      expect((await liveVariants(tx, data.id)).map((v) => [v.sizeLabel, v.price])).toEqual([
        ["C", 100],
        ["A", 200],
      ]);
      const [old] = await tx.select().from(productVariants).where(eq(productVariants.id, c.id));
      expect(old.sizeLabel).toBe(`__archived_${c.id}`);
    });
  });

  it("saves photos in order then the video, and replaces the video without tripping its index", async () => {
    await withRollback(db, async (tx) => {
      const id = crypto.randomUUID();
      const key = (ext: "webp" | "mp4") => mediaKey(id, crypto.randomUUID(), ext);
      const [p1, p2, v1, v2] = [key("webp"), key("webp"), key("mp4"), key("mp4")];
      const photo = (storageKey: string) => ({
        storageKey,
        kind: "image" as const,
        width: 800,
        height: 600,
      });
      const video = (storageKey: string) => ({ storageKey, kind: "video" as const });
      const data = input({ id, media: [video(v1), photo(p1), photo(p2)] });
      await saved(tx, data);
      const rows = async () =>
        (
          await tx
            .select()
            .from(productMedia)
            .where(eq(productMedia.productId, id))
            .orderBy(asc(productMedia.sort))
        ).map((m) => [m.storageKey, m.sort]);
      expect(await rows()).toEqual([
        [p1, 0],
        [p2, 1],
        [v1, 2],
      ]);

      await saved(tx, {
        ...data,
        version: 1,
        media: [photo(p2), video(v2)].map((m) => ({ width: null, height: null, ...m })),
      });
      expect(await rows()).toEqual([
        [p2, 0],
        [v2, 1],
      ]);
    });
  });
});

describe.skipIf(!hasLocalDb)("delete, archive, restore on the local database", () => {
  it("deletes a product nothing ordered, with its variants and media, and frees its code", async () => {
    await withRollback(db, async (tx) => {
      const data = input({});
      await saved(tx, data);
      expect(await deleteProductInDb(tx, data.id, 2)).toEqual({ kind: "stale" });
      expect(await deleteProductInDb(tx, data.id, 1)).toEqual({ kind: "deleted" });
      expect(
        await tx.select().from(productVariants).where(eq(productVariants.productId, data.id)),
      ).toEqual([]);
      expect(await deleteProductInDb(tx, data.id, 1)).toEqual({ kind: "not_found" });
      await saved(tx, input({ code: data.code }));
    });
  });

  it("restores an archived product to hidden, once", async () => {
    await withRollback(db, async (tx) => {
      const data = input({});
      await saved(tx, data);
      const [variant] = await liveVariants(tx, data.id);
      await placeOrderLine(tx, variant);
      expect(await deleteProductInDb(tx, data.id, 1)).toEqual({ kind: "archived", version: 2 });
      expect(await deleteProductInDb(tx, data.id, 2)).toEqual({ kind: "already_archived" });
      expect(await restoreProductInDb(tx, data.id, 1)).toEqual({ kind: "stale" });
      expect(await restoreProductInDb(tx, data.id, 2)).toEqual({ kind: "restored", version: 3 });
      const [product] = await tx.select().from(products).where(eq(products.id, data.id));
      expect(product.status).toBe("hidden");
      expect(await restoreProductInDb(tx, data.id, 3)).toEqual({ kind: "not_archived" });
    });
  });
});

describe.skipIf(!hasLocalDb)("the products list on the local database", () => {
  it("shows the lowest live price with من, option counts, status, and the filters", async () => {
    await withRollback(db, async (tx) => {
      const code = `TSL-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const data = input({
        code,
        name: "ثريا قائمة 50%_",
        sizes: [
          { label: "S", price: "100" },
          { label: "L", price: "150" },
        ],
        colours: [{ newName: "لون قائمة أول" }, { newName: "لون قائمة ثان" }],
        pairs: grid(2, 2, ["0:0", "0:1", "1:0", "1:1"]),
      });
      await saved(tx, data);
      const filters = { q: code.toLowerCase().slice(0, 6), categoryId: null, page: 1 } as const;

      const { rows } = await readAdminProducts(tx, { ...filters, filter: "all" });
      expect(rows.find((row) => row.id === data.id)).toMatchObject({
        code,
        minPrice: 10_000,
        maxPrice: 15_000,
        sizeCount: 2,
        colourCount: 2,
        status: "unavailable",
        categoryPath: ["فئة اختبار الحفظ"],
      });
      const ids = async (filter: "available" | "unavailable" | "hidden" | "archived") =>
        (await readAdminProducts(tx, { ...filters, filter })).rows.map((row) => row.id);
      expect(await ids("unavailable")).toContain(data.id);
      expect(await ids("available")).not.toContain(data.id);

      // Name search escapes % and _; code search matches the start only.
      const byName = await readAdminProducts(tx, { ...filters, q: "50%_", filter: "all" });
      expect(byName.rows.map((row) => row.id)).toContain(data.id);
      const middle = await readAdminProducts(tx, { ...filters, q: code.slice(2), filter: "all" });
      expect(middle.rows.map((row) => row.id)).not.toContain(data.id);

      // An unknown category id filters nothing.
      const unknown = await readAdminProducts(tx, {
        ...filters,
        categoryId: crypto.randomUUID(),
        filter: "all",
      });
      expect(unknown.rows.map((row) => row.id)).toContain(data.id);
    });
  });
});

// Commits on two connections, so it cleans up after itself.
describe.skipIf(!hasLocalDb)("a delete that loses a race with a new order line", () => {
  it("reruns the save once and archives the pair instead", async () => {
    const other = getDirectDb();
    const data = input({
      sizes: [
        { label: "S", price: "100" },
        { label: "L", price: "200" },
      ],
      pairs: grid(2, 0),
    });
    let orderId: string | null = null;
    try {
      await saved(db, data);
      const [small] = await liveVariants(db, data.id);

      let releaseOrder!: () => void;
      const orderHeld = new Promise<void>((resolve) => (releaseOrder = resolve));
      let orderInserted!: () => void;
      const inserted = new Promise<void>((resolve) => (orderInserted = resolve));

      const order = other.transaction(async (tx) => {
        const { order: placed } = await placeOrderLine(tx, small);
        orderId = placed.id;
        orderInserted();
        await orderHeld;
      });
      await inserted;

      // The save removes S; its delete waits on the order's lock, then fails once it commits.
      const save = saveProductInDb(db, {
        ...data,
        version: 1,
        sizes: [{ originalLabel: "L", label: "L", price: 20_000 }],
        pairs: grid(1, 0),
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      releaseOrder();
      await order;

      expect((await save).kind).toBe("saved");
      const [row] = await db.select().from(productVariants).where(eq(productVariants.id, small.id));
      expect(row.archivedAt).not.toBeNull();
    } finally {
      if (orderId) await db.delete(orders).where(eq(orders.id, orderId));
      await db.delete(products).where(eq(products.id, data.id));
      await db.delete(categories).where(eq(categories.name, "فئة اختبار الحفظ"));
      await other.$client.end();
    }
  });
});
