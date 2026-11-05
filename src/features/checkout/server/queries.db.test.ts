import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  deliveryZones,
  orderLines,
  orders,
  productMedia,
  productVariants,
  shopSettings,
} from "@/server/db/schema";
import type { Transaction } from "@/server/db/types";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";

vi.mock("server-only", () => ({}));
// `queries.ts` also exports the cookie wrapper; this file tests the query underneath it.
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const { getDirectDb } = await import("@/server/db/direct");
const { getPlacedOrder, readPlacedOrder } = await import("./queries");

// covers: AC-2, AC-5, AC-6, AC-8 (spec 0013)

const db = hasLocalDb ? getDirectDb() : (null as never);

async function seedOrders(tx: Transaction) {
  const photo = await insertSimpleProduct(tx, "PLACED-1", 12_500);
  const plain = await insertSimpleProduct(tx, "PLACED-2", 1_990);
  await tx.insert(productMedia).values([
    {
      productId: photo.product.id,
      kind: "image",
      storageKey: "products/placed/second.webp",
      sort: 1,
    },
    {
      productId: photo.product.id,
      kind: "image",
      storageKey: "products/placed/first.webp",
      sort: 0,
    },
  ]);
  const [zone] = await tx
    .insert(deliveryZones)
    .values({ name: "منطقة اختبار التأكيد", shortName: "اختبار", fee: 2_000 })
    .returning();
  await tx.update(shopSettings).set({ address: "  الخليل، شارع السلام  " });

  const base = {
    customerName: "زبون اختبار",
    customerPhone: "0599 123 456",
    customerPhoneE164: "+970599123456",
    placedAt: new Date("2093-05-01T09:00:00Z"),
  };
  const [pickup, delivery] = await tx
    .insert(orders)
    .values([
      { ...base, orderNumber: "93-00001", fulfilment: "pickup", subtotal: 14_490, total: 14_490 },
      {
        ...base,
        orderNumber: "93-00002",
        fulfilment: "delivery",
        deliveryZoneId: zone.id,
        deliveryZoneName: zone.name,
        city: "رام الله",
        address: "شارع الإرسال",
        notes: "اتصل قبل الوصول",
        subtotal: 12_500,
        deliveryFee: 2_000,
        total: 14_500,
      },
    ])
    .returning();
  const line = ({ product, variant }: typeof photo) => ({
    productId: product.id,
    variantId: variant.id,
    catalogUnitPrice: variant.price,
    unitPrice: variant.price,
    quantity: 1,
    lineTotal: variant.price,
  });
  await tx.insert(orderLines).values([
    {
      ...line(plain),
      orderId: pickup.id,
      productName: "منتج بلا صورة",
      productCode: "PLACED-2",
      sort: 1,
    },
    {
      ...line(photo),
      orderId: pickup.id,
      productName: "ثريا اختبار",
      productCode: "PLACED-1",
      sizeLabel: "80 سم",
      colourName: "ذهبي",
      sort: 0,
    },
    {
      ...line(photo),
      orderId: delivery.id,
      productName: "ثريا اختبار",
      productCode: "PLACED-1",
    },
  ]);
  return { pickup, delivery, photo };
}

// covers: AC-2 (spec 0004 AC-11): the number alone opens nothing, with no database read.
describe("getPlacedOrder", () => {
  it("opens nothing when this browser has no placed cookie", async () => {
    expect(await getPlacedOrder("26-00001")).toBeNull();
  });
});

describe.skipIf(!hasLocalDb)("readPlacedOrder on the local database", () => {
  it("returns the pickup summary: subtotal, the trimmed shop address, lines in order with photos", async () => {
    const found = await withRollback(db, async (tx) => {
      const { pickup } = await seedOrders(tx);
      return readPlacedOrder(tx, "93-00001", [pickup.id]);
    });
    expect(found).toMatchObject({
      orderNumber: "93-00001",
      fulfilment: "pickup",
      subtotal: 14_490,
      deliveryFee: 0,
      total: 14_490,
      pickupAddress: "الخليل، شارع السلام",
    });
    expect(found?.lines).toEqual([
      {
        productName: "ثريا اختبار",
        sizeLabel: "80 سم",
        colourName: "ذهبي",
        quantity: 1,
        lineTotal: 12_500,
        imageKey: "products/placed/first.webp",
      },
      {
        productName: "منتج بلا صورة",
        sizeLabel: null,
        colourName: null,
        quantity: 1,
        lineTotal: 1_990,
        imageKey: null,
      },
    ]);
  });

  it("has no pickup address for a pickup order when the shop's address is blank", async () => {
    const found = await withRollback(db, async (tx) => {
      const { pickup } = await seedOrders(tx);
      await tx.update(shopSettings).set({ address: "   " });
      return readPlacedOrder(tx, "93-00001", [pickup.id]);
    });
    expect(found?.pickupAddress).toBeNull();
  });

  it("returns the saved delivery values and no pickup address for a delivery order", async () => {
    const found = await withRollback(db, async (tx) => {
      const { delivery } = await seedOrders(tx);
      return readPlacedOrder(tx, "93-00002", [delivery.id]);
    });
    expect(found).toMatchObject({
      fulfilment: "delivery",
      deliveryZoneName: "منطقة اختبار التأكيد",
      city: "رام الله",
      address: "شارع الإرسال",
      notes: "اتصل قبل الوصول",
      subtotal: 12_500,
      deliveryFee: 2_000,
      total: 14_500,
      pickupAddress: null,
    });
  });

  it("opens nothing when the id is not among this browser's placed orders", async () => {
    const found = await withRollback(db, async (tx) => {
      const { pickup } = await seedOrders(tx);
      return Promise.all([
        readPlacedOrder(tx, "93-00002", [pickup.id]),
        readPlacedOrder(tx, "93-00001", []),
      ]);
    });
    expect(found).toEqual([null, null]);
  });

  it("finds the order when this browser holds several placed ids", async () => {
    const found = await withRollback(db, async (tx) => {
      const { pickup, delivery } = await seedOrders(tx);
      return readPlacedOrder(tx, "93-00002", [pickup.id, delivery.id]);
    });
    expect(found?.orderNumber).toBe("93-00002");
  });

  it("gives each order only its own lines", async () => {
    const found = await withRollback(db, async (tx) => {
      const { delivery } = await seedOrders(tx);
      return readPlacedOrder(tx, "93-00002", [delivery.id]);
    });
    expect(found?.lines.map((line) => line.productName)).toEqual(["ثريا اختبار"]);
  });

  it("keeps the saved line total after the variant's price changes", async () => {
    const found = await withRollback(db, async (tx) => {
      const { delivery, photo } = await seedOrders(tx);
      await tx
        .update(productVariants)
        .set({ price: 99_000 })
        .where(eq(productVariants.id, photo.variant.id));
      return readPlacedOrder(tx, "93-00002", [delivery.id]);
    });
    expect(found?.lines[0].lineTotal).toBe(12_500);
    expect(found).toMatchObject({ subtotal: 12_500, total: 14_500 });
  });

  it("shows the product's current first photo, skipping its video", async () => {
    const found = await withRollback(db, async (tx) => {
      const { delivery, photo } = await seedOrders(tx);
      await tx.insert(productMedia).values([
        {
          productId: photo.product.id,
          kind: "video",
          storageKey: "products/placed/v.mp4",
          sort: -2,
        },
        {
          productId: photo.product.id,
          kind: "image",
          storageKey: "products/placed/new.webp",
          sort: -1,
        },
      ]);
      return readPlacedOrder(tx, "93-00002", [delivery.id]);
    });
    expect(found?.lines[0].imageKey).toBe("products/placed/new.webp");
  });

  it("breaks a tie in photo order by id, so the photo never flips between reads", async () => {
    const found = await withRollback(db, async (tx) => {
      const { delivery, photo } = await seedOrders(tx);
      await tx.insert(productMedia).values([
        {
          id: "ffffffff-0000-4000-8000-000000000000",
          productId: photo.product.id,
          kind: "image",
          storageKey: "products/placed/tie-high.webp",
          sort: -1,
        },
        {
          id: "00000000-0000-4000-8000-000000000000",
          productId: photo.product.id,
          kind: "image",
          storageKey: "products/placed/tie-low.webp",
          sort: -1,
        },
      ]);
      return readPlacedOrder(tx, "93-00002", [delivery.id]);
    });
    expect(found?.lines[0].imageKey).toBe("products/placed/tie-low.webp");
  });

  it("has no photo when the product has only a video", async () => {
    const found = await withRollback(db, async (tx) => {
      const { delivery, photo } = await seedOrders(tx);
      await tx.delete(productMedia).where(eq(productMedia.productId, photo.product.id));
      await tx.insert(productMedia).values({
        productId: photo.product.id,
        kind: "video",
        storageKey: "products/placed/only.mp4",
      });
      return readPlacedOrder(tx, "93-00002", [delivery.id]);
    });
    expect(found?.lines[0].imageKey).toBeNull();
  });
});
