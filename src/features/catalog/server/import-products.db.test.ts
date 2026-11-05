import { and, asc, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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
import type { ImportProductInput } from "../import-schemas";
import { mediaKey } from "../media-rules";

vi.mock("server-only", () => ({}));

// Stands in for an editor tab saving the same product between `importProducts` steps 2 and 5.
const race = vi.hoisted(() => ({ times: 0 }));
vi.mock("./save-product", async (importOriginal) => {
  const real = await importOriginal<typeof import("./save-product")>();
  const { products: table } = await import("@/server/db/schema");
  const { eq: same, sql } = await import("drizzle-orm");
  return {
    ...real,
    saveProductInDb: async (...args: Parameters<typeof real.saveProductInDb>) => {
      const [db, data] = args;
      if (race.times > 0 && data.version !== null) {
        race.times -= 1;
        await db
          .update(table)
          .set({ version: sql`${table.version} + 1` })
          .where(same(table.id, data.id));
      }
      return real.saveProductInDb(...args);
    },
  };
});

const { getDirectDb } = await import("@/server/db/direct");
const { importProductInDb } = await import("./import-products");
const { setProductPhotosInDb } = await import("./product-photos");
const { readProductEditor } = await import("./admin-queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

beforeEach(() => {
  race.times = 0;
});

// covers: AC-7, AC-8, AC-9, AC-10, AC-11, AC-13, AC-15 (spec 0007)

type Db = Database | Transaction;

const tag = () => crypto.randomUUID().slice(0, 8).toUpperCase();

const sheet = (fields: Partial<ImportProductInput> & { code: string }): ImportProductInput => ({
  rows: [2],
  specs: [],
  sizes: [],
  colours: [],
  ...fields,
});

async function imported(tx: Db, input: ImportProductInput) {
  const outcome = await importProductInDb(tx, input);
  if (outcome.outcome === "skipped") throw new Error(`skipped: ${outcome.problem}`);
  return outcome;
}

const variantsOf = (tx: Db, productId: string) =>
  tx
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
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
  await tx.insert(orderLines).values({
    orderId: order.id,
    productId: variant.productId,
    variantId: variant.id,
    productName: "ثريا اختبار",
    productCode: "TIM",
    sizeLabel: variant.sizeLabel,
    quantity: 1,
    catalogUnitPrice: variant.price,
    unitPrice: variant.price,
    lineTotal: variant.price,
  });
}

describe.skipIf(!hasLocalDb)("importProductInDb on the local database", () => {
  it("creates a 2 by 2 product and a simple one, hidden, with new categories and a new colour", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const main = `ثريات ${t}`;
      const sub = `كريستال ${t}`;
      const colour = `فضي ${t}`;
      const big = await imported(
        tx,
        sheet({
          code: `TIM-${t}`,
          rows: [2, 3],
          name: "ثريا مستوردة",
          mainCategory: main,
          subCategory: sub,
          sizes: [
            { label: "60 سم", price: "450" },
            { label: "80 سم", price: "650" },
          ],
          colours: ["ذهبي", colour],
          specs: [{ label: "القطر (سم)", value: "60" }],
        }),
      );
      expect(big.outcome).toBe("created");
      const simple = await imported(
        tx,
        sheet({ code: `TIS-${t}`, name: "أباجورة", mainCategory: main, price: "120" }),
      );

      const editor = await readProductEditor(tx, big.id);
      expect(editor).toMatchObject({
        version: 1,
        visible: false,
        available: true,
        specs: [{ label: "القطر (سم)", value: "60" }],
        sizes: [
          { label: "60 سم", price: "450" },
          { label: "80 سم", price: "650" },
        ],
      });
      expect(editor?.colours.map((row) => row.name)).toEqual(["ذهبي", colour]);
      expect(editor?.pairs.every((pair) => pair.available)).toBe(true);

      const [subRow] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, editor!.subCategoryId!));
      const [mainRow] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, editor!.mainCategoryId));
      expect([mainRow.name, subRow.name, subRow.parentId]).toEqual([main, sub, mainRow.id]);
      // The second product found the main the first one made.
      expect((await readProductEditor(tx, simple.id))?.mainCategoryId).toBe(mainRow.id);
      expect(await tx.select().from(colours).where(eq(colours.name, colour))).toHaveLength(1);
    });
  });

  it("updates prices and removes a size: the ordered pair is archived, ids kept, version + 1", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const code = `TIU-${t}`;
      const first = await imported(
        tx,
        sheet({
          code,
          rows: [2, 3],
          name: "ثريا تحديث",
          mainCategory: `فئة ${t}`,
          sizes: [
            { label: "صغير", price: "100" },
            { label: "كبير", price: "150" },
          ],
          colours: ["ذهبي"],
          visible: true,
          specs: [{ label: "القدرة", value: "40 واط" }],
        }),
      );
      const before = await variantsOf(tx, first.id);
      await placeOrderLine(tx, before[0]);

      const second = await imported(
        tx,
        sheet({ code, rows: [7], sizes: [{ label: "كبير", price: "175" }], colours: ["ذهبي"] }),
      );
      expect(second).toEqual({ code, outcome: "updated", id: first.id });

      const after = await variantsOf(tx, first.id);
      const small = after.find((row) => row.id === before[0].id)!;
      const large = after.find((row) => row.id === before[1].id)!;
      expect(small.archivedAt).not.toBeNull();
      expect([large.archivedAt, large.price, large.sizeLabel]).toEqual([null, 17_500, "كبير"]);
      const editor = await readProductEditor(tx, first.id);
      // Empty cells kept the stored values.
      expect(editor).toMatchObject({ version: 2, name: "ثريا تحديث", visible: true });
      expect(editor?.specs).toEqual([{ label: "القدرة", value: "40 واط" }]);
    });
  });

  it("puts a sub given alone under the product's stored main", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const code = `TIC-${t}`;
      const made = await imported(
        tx,
        sheet({ code, name: "ثريا", mainCategory: `رئيسي ${t}`, price: "5" }),
      );
      const mainId = (await readProductEditor(tx, made.id))!.mainCategoryId;
      await imported(tx, sheet({ code, subCategory: `فرعي ${t}`, price: "5" }));
      const editor = await readProductEditor(tx, made.id);
      expect(editor?.mainCategoryId).toBe(mainId);
      const [sub] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, editor!.subCategoryId!));
      expect(sub.name).toBe(`فرعي ${t}`);
    });
  });

  it("runs the same product twice to the same rows", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const input = sheet({
        code: `TIR-${t}`,
        rows: [2, 3],
        name: "ثريا",
        mainCategory: `فئة ${t}`,
        sizes: [
          { label: "1", price: "10" },
          { label: "2", price: "20" },
        ],
        colours: ["ذهبي"],
      });
      const made = await imported(tx, input);
      const before = await variantsOf(tx, made.id);
      expect((await imported(tx, input)).outcome).toBe("updated");
      const after = await variantsOf(tx, made.id);
      expect(after.map((row) => [row.id, row.price, row.archivedAt])).toEqual(
        before.map((row) => [row.id, row.price, null]),
      );
      expect((await readProductEditor(tx, made.id))?.version).toBe(2);
    });
  });

  it("never touches an archived product", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const code = `TIA-${t}`;
      const made = await imported(
        tx,
        sheet({ code, name: "ثريا", mainCategory: `فئة ${t}`, price: "5" }),
      );
      await tx.update(products).set({ status: "archived" }).where(eq(products.id, made.id));
      expect(await importProductInDb(tx, sheet({ code, price: "9" }))).toEqual({
        code,
        outcome: "skipped",
        problem: "archived",
      });
      const [variant] = await variantsOf(tx, made.id);
      expect(variant.price).toBe(500);
    });
  });

  it("refuses what the page should have caught, writing nothing", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const code = `TIX-${t}`;
      expect(
        await importProductInDb(tx, sheet({ code, name: "ثريا", mainCategory: "فئة", price: "0" })),
      ).toEqual({
        code,
        outcome: "skipped",
        problem: "price_invalid",
      });
      expect(await importProductInDb(tx, sheet({ code, price: "5" }))).toMatchObject({
        problem: "name_missing",
      });
      expect(await importProductInDb(tx, sheet({ code, name: "ثريا", price: "5" }))).toMatchObject({
        problem: "category_missing",
      });
      expect(await tx.select().from(products).where(eq(products.code, code))).toEqual([]);
    });
  });

  it("reads the product again once when the editor saved it first, then gives up", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const code = `TIS-${t}`;
      await imported(tx, sheet({ code, name: "ثريا", mainCategory: `فئة ${t}`, price: "5" }));

      race.times = 1;
      expect((await importProductInDb(tx, sheet({ code, price: "6" }))).outcome).toBe("updated");

      race.times = 2;
      expect(await importProductInDb(tx, sheet({ code, price: "7" }))).toEqual({
        code,
        outcome: "skipped",
        problem: "changed_during_import",
      });
    });
  });
});

describe.skipIf(!hasLocalDb)("setProductPhotosInDb on the local database", () => {
  const key = (productId: string, ext: "webp" | "mp4" = "webp") =>
    mediaKey(productId, crypto.randomUUID(), ext);

  it("replaces the photos in order, keeps the video last, and bumps the version", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const made = await imported(
        tx,
        sheet({ code: `TIP-${t}`, name: "ثريا", mainCategory: `فئة ${t}`, price: "5" }),
      );
      const video = key(made.id, "mp4");
      await tx.insert(productMedia).values([
        ...[0, 1, 2].map((sort) => ({
          productId: made.id,
          kind: "image" as const,
          storageKey: key(made.id),
          width: 10,
          height: 10,
          sort,
        })),
        { productId: made.id, kind: "video" as const, storageKey: video, sort: 3 },
      ]);

      const images = [key(made.id), key(made.id)].map((storageKey) => ({
        storageKey,
        width: 800,
        height: 600,
      }));
      const outcome = await setProductPhotosInDb(tx, made.id, images);
      expect(outcome).toEqual({
        kind: "saved",
        version: 2,
        keptKeys: [images[0].storageKey, images[1].storageKey, video],
      });

      const rows = await tx
        .select({ key: productMedia.storageKey, sort: productMedia.sort })
        .from(productMedia)
        .where(eq(productMedia.productId, made.id))
        .orderBy(asc(productMedia.sort));
      expect(rows).toEqual([
        { key: images[0].storageKey, sort: 0 },
        { key: images[1].storageKey, sort: 1 },
        { key: video, sort: 2 },
      ]);
    });
  });

  it("refuses an archived or missing product", async () => {
    await withRollback(db, async (tx) => {
      const t = tag();
      const made = await imported(
        tx,
        sheet({ code: `TIQ-${t}`, name: "ثريا", mainCategory: `فئة ${t}`, price: "5" }),
      );
      await tx.update(products).set({ status: "archived" }).where(eq(products.id, made.id));
      const image = [{ storageKey: key(made.id), width: 1, height: 1 }];
      expect(await setProductPhotosInDb(tx, made.id, image)).toEqual({ kind: "archived" });
      const missing = crypto.randomUUID();
      expect(
        await setProductPhotosInDb(tx, missing, [
          { storageKey: key(missing), width: 1, height: 1 },
        ]),
      ).toEqual({ kind: "not_found" });
      const live = await tx
        .select()
        .from(productMedia)
        .where(and(eq(productMedia.productId, made.id), isNull(productMedia.width)));
      expect(live).toEqual([]);
    });
  });
});
