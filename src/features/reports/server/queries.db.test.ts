import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { orderLines, orders, products, productVariants } from "@/server/db/schema";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { addDaysToKey, shopDateKey, shopDayStart } from "@/lib/format";
import type { ReportDays } from "../period";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { exportOrdersInDb, salesSeriesInDb, salesSummaryInDb, topProductsInDb } =
  await import("./queries");
const { insertTestOrder } = await import("@/features/orders/server/testing");

// covers: AC-4, AC-6, AC-7, AC-9, AC-10, AC-14 (spec 0024)

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// Shop year 2019: no seed or flow writes orders there, so the period holds only these fixtures.
const MARCH: ReportDays = { from: "2019-03-01", to: "2019-03-31" };
const noon = (key: string) => new Date(shopDayStart(key).getTime() + 12 * 3_600_000);

type Variant = { readonly id: string; readonly productId: string };
type OrderOptions = Omit<Parameters<typeof insertTestOrder>[1], "placedAt" | "variant">;

const order = (tx: Transaction, variant: Variant, placedAt: Date, options: OrderOptions = {}) =>
  insertTestOrder(tx, { placedAt, variant, unseen: false, ...options });

/** The first day of 2019 on the shop's clock that is not 24 hours long (summer time starts). */
function summerTimeDay(): string {
  for (let key = "2019-01-01"; key < "2019-12-31"; key = addDaysToKey(key, 1)) {
    const hours =
      (shopDayStart(addDaysToKey(key, 1)).getTime() - shopDayStart(key).getTime()) / 3_600_000;
    if (hours !== 24) return key;
  }
  throw new Error("No summer time change in 2019");
}

describe.skipIf(!hasLocalDb)("salesSummaryInDb", () => {
  it("counts every status but cancelled, full totals, delivery apart, and what is paid", async () => {
    const summary = await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-REP1");
      // ₪270 delivery, ₪100 paid; ₪250 pickup, paid in full; ₪250 cancelled after a refund.
      const partly = await order(tx, variant, noon("2019-03-04"), {
        fulfilment: "delivery",
        status: "out_for_delivery",
      });
      await tx.update(orders).set({ amountPaid: 10_000 }).where(eq(orders.id, partly.id));
      const paid = await order(tx, variant, noon("2019-03-10"), { status: "delivered" });
      await tx.update(orders).set({ amountPaid: 25_000 }).where(eq(orders.id, paid.id));
      await order(tx, variant, noon("2019-03-12"), { status: "cancelled" });
      // Outside the period on both sides.
      await order(tx, variant, noon("2019-02-28"));
      await order(tx, variant, noon("2019-04-01"));
      return salesSummaryInDb(tx, MARCH);
    });
    expect(summary).toEqual({
      orders: 2,
      sales: 52_000,
      deliveryFees: 2_000,
      collected: 35_000,
      cancelled: 1,
    });
  });

  it("gives zeros for a period with no orders", async () => {
    const summary = await withRollback(db, (tx) => salesSummaryInDb(tx, MARCH));
    expect(summary).toEqual({ orders: 0, sales: 0, deliveryFees: 0, collected: 0, cancelled: 0 });
  });

  it("lowers the period the order was placed in after a price cut", async () => {
    const [before, after] = await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-REP2");
      const row = await order(tx, variant, noon("2019-03-15"));
      const before = await salesSummaryInDb(tx, MARCH);
      // A ₪50 cut on the order's goods (spec 0022), long after the period.
      await tx.update(orders).set({ subtotal: 20_000, total: 20_000 }).where(eq(orders.id, row.id));
      return [before, await salesSummaryInDb(tx, MARCH)];
    });
    expect(before.sales).toBe(25_000);
    expect(after.sales).toBe(20_000);
  });

  it("takes an order at 23:30 on the last shop day and leaves one at 00:10 the next day", async () => {
    const counts = await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-REP3");
      const last = "2019-03-20";
      const nextStart = shopDayStart(addDaysToKey(last, 1)).getTime();
      await order(tx, variant, new Date(nextStart - 30 * 60_000));
      await order(tx, variant, new Date(nextStart + 10 * 60_000));
      return [
        (await salesSummaryInDb(tx, { from: "2019-03-01", to: last })).orders,
        (await salesSummaryInDb(tx, { from: addDaysToKey(last, 1), to: "2019-03-31" })).orders,
      ];
    });
    expect(counts).toEqual([1, 1]);
  });

  it("keeps the shop day edges across a summer time change", async () => {
    const change = summerTimeDay();
    const result = await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-REP4");
      const changeStart = shopDayStart(change).getTime();
      const nextStart = shopDayStart(addDaysToKey(change, 1)).getTime();
      // 23:30 the evening before the change, then 23:30 and 00:10 around the change day's end.
      const before = new Date(changeStart - 30 * 60_000);
      const lateOnChange = new Date(nextStart - 30 * 60_000);
      const earlyAfter = new Date(nextStart + 10 * 60_000);
      for (const at of [before, lateOnChange, earlyAfter]) await order(tx, variant, at);
      const onChange = await salesSummaryInDb(tx, { from: change, to: change });
      const series = await salesSeriesInDb(tx, {
        from: addDaysToKey(change, -1),
        to: addDaysToKey(change, 1),
      });
      return { onChange, series, days: [before, lateOnChange, earlyAfter].map(shopDateKey) };
    });
    expect(result.days).toEqual([addDaysToKey(change, -1), change, addDaysToKey(change, 1)]);
    expect(result.onChange.orders).toBe(1);
    expect(result.series).toEqual([
      { key: addDaysToKey(change, -1), sales: 25_000 },
      { key: change, sales: 25_000 },
      { key: addDaysToKey(change, 1), sales: 25_000 },
    ]);
  });
});

describe.skipIf(!hasLocalDb)("salesSeriesInDb", () => {
  it("sums counted orders per shop day, in order, days with orders only", async () => {
    const series = await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-REP5");
      await order(tx, variant, noon("2019-03-09"), { fulfilment: "delivery" });
      await order(tx, variant, noon("2019-03-02"));
      await order(tx, variant, noon("2019-03-02"));
      await order(tx, variant, noon("2019-03-05"), { status: "cancelled" });
      return salesSeriesInDb(tx, MARCH);
    });
    expect(series).toEqual([
      { key: "2019-03-02", sales: 50_000 },
      { key: "2019-03-09", sales: 27_000 },
    ]);
  });
});

describe.skipIf(!hasLocalDb)("topProductsInDb", () => {
  it("groups a product's variants, ranks by quantity, sales, name, then id, under current names", async () => {
    const result = await withRollback(db, async (tx) => {
      const named = async (code: string, name: string) => {
        const { product, variant } = await insertSimpleProduct(tx, code);
        await tx.update(products).set({ name }).where(eq(products.id, product.id));
        return variant;
      };
      const day = noon("2019-03-07");
      // Two variants of one product: one row with quantity 4.
      const lamp = await named("TEST-TOP1", "مصباح قديم");
      const [second] = await tx
        .insert(productVariants)
        .values({ productId: lamp.productId, price: 12_500, sizeLabel: "كبير" })
        .returning();
      await order(tx, lamp, day);
      await order(tx, second, day);
      // Renamed after it sold: the table shows the current name.
      await tx.update(products).set({ name: "مصباح" }).where(eq(products.id, lamp.productId));
      // Quantity 2 each: higher sales first, then name, then id.
      const beh = await named("TEST-TOP2", "ب");
      const alef = await named("TEST-TOP3", "أ");
      const yeh = await named("TEST-TOP4", "ي");
      const twinA = await named("TEST-TOP5", "ج");
      const twinB = await named("TEST-TOP6", "ج");
      for (const variant of [beh, alef, twinA, twinB]) await order(tx, variant, day);
      const big = await order(tx, yeh, day);
      await tx
        .update(orderLines)
        .set({ unitPrice: 15_000, lineTotal: 30_000 })
        .where(eq(orderLines.orderId, big.id));
      // Cancelled: never counted.
      await order(tx, await named("TEST-TOP7", "ملغى"), day, { status: "cancelled" });
      const twins = [twinA.productId, twinB.productId].sort();
      return { top: await topProductsInDb(tx, MARCH), lamp: lamp.productId, twins };
    });
    expect(
      result.top.map(({ name, code, quantity, sales }) => ({ name, code, quantity, sales })),
    ).toEqual([
      { name: "مصباح", code: "TEST-TOP1", quantity: 4, sales: 50_000 },
      { name: "ي", code: "TEST-TOP4", quantity: 2, sales: 30_000 },
      { name: "أ", code: "TEST-TOP3", quantity: 2, sales: 25_000 },
      { name: "ب", code: "TEST-TOP2", quantity: 2, sales: 25_000 },
      { name: "ج", code: expect.any(String), quantity: 2, sales: 25_000 },
      { name: "ج", code: expect.any(String), quantity: 2, sales: 25_000 },
    ]);
    expect(result.top[0].productId).toBe(result.lamp);
    expect(result.top.slice(4).map((row) => row.productId)).toEqual(result.twins);
  });

  it("returns at most 10 products", async () => {
    const top = await withRollback(db, async (tx) => {
      for (let i = 0; i < 12; i++) {
        const { variant } = await insertSimpleProduct(tx, `TEST-MANY${i}`);
        await order(tx, variant, noon("2019-03-08"));
      }
      return topProductsInDb(tx, MARCH);
    });
    expect(top).toHaveLength(10);
  });
});

describe.skipIf(!hasLocalDb)("exportOrdersInDb", () => {
  it("lists every order in the period, cancelled included, oldest first then by number", async () => {
    const result = await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-EXP1");
      const late = await order(tx, variant, noon("2019-03-20"));
      const sameA = await order(tx, variant, noon("2019-03-03"), { status: "cancelled" });
      const sameB = await order(tx, variant, noon("2019-03-03"));
      await order(tx, variant, noon("2019-04-02"));
      const rows = await exportOrdersInDb(tx, MARCH);
      return { rows, expected: [sameA, sameB, late].map((row) => row.orderNumber) };
    });
    expect(result.rows.map((row) => row.orderNumber)).toEqual(result.expected);
    expect(result.rows[0]).toMatchObject({ status: "cancelled", total: 25_000, amountPaid: 0 });
    expect(Object.keys(result.rows[0])).not.toContain("customerPhoneE164");
  });
});
