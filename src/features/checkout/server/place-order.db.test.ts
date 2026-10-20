import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  categories,
  deliveryZones,
  orderEvents,
  orderLines,
  orderNumberCounters,
  orders,
  products,
  productVariants,
} from "@/server/db/schema";
import { hasLocalDb } from "@/server/db/testing";
import type { CheckoutInput } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { placeOrderInDb } = await import("./place-order");

// covers: AC-5, AC-7, AC-8, AC-9 (spec 0004)

const db = hasLocalDb ? getDirectDb() : (null as never);
// A far future year keeps these committed orders away from real numbers.
const YEAR = 2094;
const placedAt = new Date(`${YEAR}-05-01T09:00:00Z`);
const PREFIX = "PO-TEST";

let variantA = "";
let variantB = "";
let zone = { id: "", fee: 0, name: "" };

const pickup = (over: Partial<CheckoutInput> = {}): CheckoutInput =>
  ({
    idempotencyKey: randomUUID(),
    name: "زبون اختبار",
    phone: { typed: "0599 123 456", e164: "+970599123456" },
    fulfilment: "pickup",
    notes: undefined,
    expectedTotal: 0,
    ...over,
  }) as CheckoutInput;

async function cleanUp() {
  const placed = await db
    .select({ id: orders.id })
    .from(orders)
    .where(like(orders.orderNumber, `${String(YEAR).slice(2)}-%`));
  const ids = placed.map((order) => order.id);
  if (ids.length) {
    await db.delete(orderEvents).where(inArray(orderEvents.orderId, ids));
    await db.delete(orderLines).where(inArray(orderLines.orderId, ids));
    await db.delete(orders).where(inArray(orders.id, ids));
  }
  await db.delete(orderNumberCounters).where(eq(orderNumberCounters.year, YEAR));
  await db.delete(products).where(like(products.code, `${PREFIX}%`));
  await db.delete(categories).where(like(categories.slug, "po-test%"));
}

describe.skipIf(!hasLocalDb)("placeOrderInDb on the local database", () => {
  beforeAll(async () => {
    await cleanUp();
    const [category] = await db
      .insert(categories)
      .values({ name: "فئة اختبار الطلب", slug: "po-test" })
      .returning();
    const made = await db
      .insert(products)
      .values([
        { categoryId: category.id, code: `${PREFIX}-A`, name: "منتج أ", slug: "po-test-a" },
        { categoryId: category.id, code: `${PREFIX}-B`, name: "منتج ب", slug: "po-test-b" },
      ])
      .returning();
    const variants = await db
      .insert(productVariants)
      .values([
        { productId: made[0].id, price: 12_500, isDefault: true },
        { productId: made[1].id, price: 1_990, isDefault: true },
      ])
      .returning();
    [variantA, variantB] = variants.map((variant) => variant.id);
    const [first] = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true));
    zone = { id: first.id, fee: first.fee, name: first.name };
  });

  afterAll(async () => {
    if (!hasLocalDb) return;
    await cleanUp();
    await db.$client.end();
  });

  it("saves a pickup order with copied lines, totals, and a created event", async () => {
    const cart = [
      { variantId: variantA, quantity: 2 },
      { variantId: variantB, quantity: 1 },
    ];
    const outcome = await placeOrderInDb(db, {
      input: pickup({ expectedTotal: 26_990 }),
      cart,
      placedAt,
    });
    expect(outcome).toMatchObject({ kind: "placed", lineCount: 2, total: 26_990 });
    if (outcome.kind !== "placed") return;
    expect(outcome.orderNumber).toMatch(/^94-\d{5}$/);

    const [order] = await db.select().from(orders).where(eq(orders.id, outcome.orderId));
    expect(order).toMatchObject({
      city: null,
      address: null,
      customerPhone: "0599 123 456",
      customerPhoneE164: "+970599123456",
      subtotal: 26_990,
      deliveryFee: 0,
      total: 26_990,
      placedByUserId: null,
    });
    const lines = await db
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, order.id))
      .orderBy(orderLines.sort);
    expect(
      lines.map((line) => [line.productName, line.quantity, line.lineTotal, line.sort]),
    ).toEqual([
      ["منتج أ", 2, 25_000, 0],
      ["منتج ب", 1, 1_990, 1],
    ]);
    const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "created",
      actorKind: "guest",
      data: {},
      seenAt: null,
    });
  });

  it("saves a delivery order with the zone fee and city", async () => {
    const outcome = await placeOrderInDb(db, {
      input: pickup({
        fulfilment: "delivery",
        zoneId: zone.id,
        city: "رام الله",
        address: "شارع الإرسال 4",
        expectedTotal: 1_990 + zone.fee,
      } as Partial<CheckoutInput>),
      cart: [{ variantId: variantB, quantity: 1 }],
      placedAt,
    });
    expect(outcome.kind).toBe("placed");
    if (outcome.kind !== "placed") return;
    const [order] = await db.select().from(orders).where(eq(orders.id, outcome.orderId));
    expect(order).toMatchObject({
      city: "رام الله",
      deliveryZoneName: zone.name,
      deliveryFee: zone.fee,
      total: 1_990 + zone.fee,
    });
  });

  it("replays the same order for a used key, even with an empty cart", async () => {
    const input = pickup({ expectedTotal: 1_990 });
    const first = await placeOrderInDb(db, {
      input,
      cart: [{ variantId: variantB, quantity: 1 }],
      placedAt,
    });
    const again = await placeOrderInDb(db, { input, cart: [], placedAt });
    expect(first.kind).toBe("placed");
    expect(again).toMatchObject({
      kind: "replayed",
      orderId: (first as { orderId: string }).orderId,
    });
    const count = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey));
    expect(count).toHaveLength(1);
  });

  it("saves one order when two submits with the same key race", async () => {
    const input = pickup({ expectedTotal: 1_990 });
    const cart = [{ variantId: variantB, quantity: 1 }];
    const [a, b] = await Promise.all([
      placeOrderInDb(db, { input, cart, placedAt }),
      placeOrderInDb(db, { input, cart, placedAt }),
    ]);
    expect([a.kind, b.kind].sort()).toEqual(["placed", "replayed"]);
    expect((a as { orderNumber: string }).orderNumber).toBe(
      (b as { orderNumber: string }).orderNumber,
    );
  });

  it("gives two different carts at the same moment consecutive numbers", async () => {
    const cart = [{ variantId: variantB, quantity: 1 }];
    const results = await Promise.all([
      placeOrderInDb(db, { input: pickup({ expectedTotal: 1_990 }), cart, placedAt }),
      placeOrderInDb(db, { input: pickup({ expectedTotal: 1_990 }), cart, placedAt }),
    ]);
    const numbers = results
      .map((result) => Number((result as { orderNumber: string }).orderNumber.slice(3)))
      .sort((x, y) => x - y);
    expect(numbers[1] - numbers[0]).toBe(1);
  });

  it("refuses a changed total and saves nothing", async () => {
    const before = await db.select({ id: orders.id }).from(orders);
    const outcome = await placeOrderInDb(db, {
      input: pickup({ expectedTotal: 1 }),
      cart: [{ variantId: variantB, quantity: 1 }],
      placedAt,
    });
    expect(outcome).toMatchObject({ kind: "price_changed" });
    if (outcome.kind === "price_changed") {
      expect(outcome.cart.subtotal).toBe(1_990);
      expect(outcome.zones.length).toBeGreaterThan(0);
    }
    expect(await db.select({ id: orders.id }).from(orders)).toHaveLength(before.length);
  });

  it("refuses an unsellable line, an unknown zone, and an empty cart", async () => {
    await db
      .update(productVariants)
      .set({ isAvailable: false })
      .where(eq(productVariants.id, variantA));
    expect(
      await placeOrderInDb(db, {
        input: pickup({ expectedTotal: 0 }),
        cart: [{ variantId: variantA, quantity: 1 }],
        placedAt,
      }),
    ).toMatchObject({ kind: "not_sellable" });
    await db
      .update(productVariants)
      .set({ isAvailable: true })
      .where(eq(productVariants.id, variantA));

    expect(
      await placeOrderInDb(db, {
        input: pickup({
          fulfilment: "delivery",
          zoneId: randomUUID(),
          city: "نابلس",
          address: "شارع فيصل 10",
          expectedTotal: 1_990,
        } as Partial<CheckoutInput>),
        cart: [{ variantId: variantB, quantity: 1 }],
        placedAt,
      }),
    ).toMatchObject({ kind: "zone_invalid" });

    expect(await placeOrderInDb(db, { input: pickup(), cart: [], placedAt })).toEqual({
      kind: "cart_empty",
    });
  });
});
