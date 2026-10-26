import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  colours,
  orderEvents,
  orderLines,
  orderNumberCounters,
  orders,
  productVariants,
  products,
} from "@/server/db/schema";
import {
  expectViolation,
  hasLocalDb,
  insertSimpleProduct,
  withRollback,
} from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { normalizePhone } from "@/lib/phone";
import { computeLineTotal } from "../totals";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { allocateOrderNumber } = await import("./order-number");
const { recomputeOrderTotals } = await import("./totals");

const db = hasLocalDb ? getDirectDb() : (null as never);

// Far future years keep the committing tests away from real order numbers and from each other.
const COMMIT_YEAR = 2091;
const CONCURRENT_YEAR = 2092;
const ROLLBACK_YEAR = 2093;
const inYear = (year: number) => new Date(`${year}-06-15T09:00:00Z`);

const clearCounters = () =>
  db
    .delete(orderNumberCounters)
    .where(sql`${orderNumberCounters.year} in (${COMMIT_YEAR}, ${CONCURRENT_YEAR})`);

afterAll(async () => {
  if (!hasLocalDb) return;
  await clearCounters();
  await db.$client.end();
});

/**
 * Places a pickup order the way the checkout action will (feature 6): one `placedAt`, the number
 * from the counter, lines copied from the catalog read inside the transaction, then the totals.
 */
async function placeOrder(
  tx: Transaction,
  input: { variantId: string; quantity: number; placedAt: Date },
) {
  const [item] = await tx
    .select({
      productId: products.id,
      productName: products.name,
      productCode: products.code,
      variantCode: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      colourName: colours.name,
      price: productVariants.price,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(colours, eq(colours.id, productVariants.colourId))
    .where(eq(productVariants.id, input.variantId));

  const orderNumber = await allocateOrderNumber(tx, input.placedAt);
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber,
      customerName: "زبون اختبار",
      customerPhone: "0599 123 456",
      customerPhoneE164: normalizePhone("0599 123 456")!,
      city: "رام الله",
      fulfilment: "pickup",
      subtotal: 0,
      total: 0,
      placedAt: input.placedAt,
    })
    .returning();
  await tx.insert(orderLines).values({
    orderId: order.id,
    productId: item.productId,
    variantId: input.variantId,
    productName: item.productName,
    productCode: item.productCode,
    variantCode: item.variantCode,
    sizeLabel: item.sizeLabel,
    colourName: item.colourName,
    quantity: input.quantity,
    catalogUnitPrice: item.price,
    unitPrice: item.price,
    lineTotal: computeLineTotal(item.price, input.quantity),
  });
  await tx.insert(orderEvents).values({ orderId: order.id, type: "created", actorKind: "guest" });
  const totals = await recomputeOrderTotals(tx, order.id);
  return { ...order, ...totals };
}

describe.skipIf(!hasLocalDb)("placing an order on the local database", () => {
  // covers: AC-1, AC-5, AC-7
  it("writes the order, its line, its totals, and a created event in one transaction", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-HAPPY", 12_500);
      const order = await placeOrder(tx, {
        variantId: variant.id,
        quantity: 2,
        placedAt: inYear(ROLLBACK_YEAR),
      });

      const [stored] = await tx.select().from(orders).where(eq(orders.id, order.id));
      const events = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, order.id));

      expect(stored).toMatchObject({
        orderNumber: "93-00001",
        subtotal: 25_000,
        total: 25_000,
        customerPhoneE164: "+970599123456",
      });
      expect(events.map((e) => e.type)).toEqual(["created"]);
    });
  });

  // covers: AC-5
  it("keeps the line's copied details when the catalog changes after ordering", async () => {
    await withRollback(db, async (tx) => {
      const { product, variant, colour } = await insertSimpleProduct(tx, "TEST-SNAP", 12_500);
      await tx
        .update(productVariants)
        .set({ colourId: colour.id, sizeLabel: "60 سم", code: "TEST-SNAP-60" })
        .where(eq(productVariants.id, variant.id));
      const order = await placeOrder(tx, {
        variantId: variant.id,
        quantity: 1,
        placedAt: inYear(ROLLBACK_YEAR),
      });

      await tx.update(products).set({ name: "اسم جديد" }).where(eq(products.id, product.id));
      await tx
        .update(productVariants)
        .set({ price: 99_900, sizeLabel: "80 سم" })
        .where(eq(productVariants.id, variant.id));
      await tx.update(colours).set({ name: "لون جديد" }).where(eq(colours.id, colour.id));

      const [line] = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id));
      const [after] = await tx.select().from(orders).where(eq(orders.id, order.id));
      expect(line).toMatchObject({
        productName: "ثريا اختبار",
        productCode: "TEST-SNAP",
        variantCode: "TEST-SNAP-60",
        sizeLabel: "60 سم",
        colourName: colour.name,
        catalogUnitPrice: 12_500,
        unitPrice: 12_500,
        lineTotal: 12_500,
      });
      expect(after).toMatchObject({ subtotal: 12_500, total: 12_500 });
    });
  });

  // covers: AC-6
  it("changes one line's price without touching the catalog price, and the totals follow", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-ADJ", 12_500);
      const order = await placeOrder(tx, {
        variantId: variant.id,
        quantity: 3,
        placedAt: inYear(ROLLBACK_YEAR),
      });
      const [line] = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id));

      await tx
        .update(orderLines)
        .set({ unitPrice: 10_000, lineTotal: computeLineTotal(10_000, line.quantity) })
        .where(eq(orderLines.id, line.id));
      const totals = await recomputeOrderTotals(tx, order.id);

      const [changed] = await tx.select().from(orderLines).where(eq(orderLines.id, line.id));
      const [catalog] = await tx
        .select({ price: productVariants.price })
        .from(productVariants)
        .where(eq(productVariants.id, variant.id));
      expect(changed).toMatchObject({
        catalogUnitPrice: 12_500,
        unitPrice: 10_000,
        lineTotal: 30_000,
      });
      expect(catalog.price).toBe(12_500);
      expect(totals).toEqual({ subtotal: 30_000, total: 30_000 });
    });
  });

  // covers: AC-6
  it("rejects a line total or an order total that does not add up", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-BAD", 12_500);
      const order = await placeOrder(tx, {
        variantId: variant.id,
        quantity: 1,
        placedAt: inYear(ROLLBACK_YEAR),
      });

      await expectViolation(tx, "order_lines_line_total_check", (sp) =>
        sp.update(orderLines).set({ unitPrice: 10_000 }).where(eq(orderLines.orderId, order.id)),
      );
      await expectViolation(tx, "orders_total_check", (sp) =>
        sp.update(orders).set({ total: 1 }).where(eq(orders.id, order.id)),
      );
      await expectViolation(tx, "orders_total_check", (sp) =>
        sp.update(orders).set({ discountTotal: 20_000 }).where(eq(orders.id, order.id)),
      );
    });
  });

  it("throws when recomputing an order that does not exist (a bug in the caller)", async () => {
    await withRollback(db, async (tx) => {
      await expect(recomputeOrderTotals(tx, crypto.randomUUID())).rejects.toThrow(/does not exist/);
    });
  });
});

// covers: AC-7. These commit, so they use their own years and clear the counters first.
describe.skipIf(!hasLocalDb)("order numbers", () => {
  beforeEach(clearCounters);

  it("runs consecutively within a year", async () => {
    const numbers: string[] = [];
    for (let i = 0; i < 3; i++) {
      numbers.push(await db.transaction((tx) => allocateOrderNumber(tx, inYear(COMMIT_YEAR))));
    }

    expect(numbers).toEqual(["91-00001", "91-00002", "91-00003"]);
  });

  it("releases the number of an order that rolls back", async () => {
    await withRollback(db, (tx) => allocateOrderNumber(tx, inYear(COMMIT_YEAR)));
    const next = await db.transaction((tx) => allocateOrderNumber(tx, inYear(COMMIT_YEAR)));

    expect(next).toBe("91-00001");
  });

  it("restarts at 00001 in a new year, taking the year on the shop's clock", async () => {
    await db.transaction((tx) => allocateOrderNumber(tx, inYear(COMMIT_YEAR)));
    // 22:30 UTC on 31 December is already 1 January on the shop's clock.
    const newYear = new Date(`${CONCURRENT_YEAR - 1}-12-31T22:30:00Z`);
    const first = await db.transaction((tx) => allocateOrderNumber(tx, newYear));

    expect(first).toBe("92-00001");
  });

  it("gives 20 orders placed at the same moment 20 distinct consecutive numbers", async () => {
    const placedAt = inYear(CONCURRENT_YEAR);
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () => db.transaction((tx) => allocateOrderNumber(tx, placedAt))),
    );

    const expected = Array.from({ length: 20 }, (_, i) => `92-${String(i + 1).padStart(5, "0")}`);
    expect([...numbers].sort()).toEqual(expected);
  });
});
