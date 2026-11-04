import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import {
  categories,
  colours,
  orderEvents,
  orderLinePriceChanges,
  orderLines,
  orderNumberCounters,
  orders,
  products,
  productVariants,
} from "@/server/db/schema";
import { pgErrorOf } from "@/server/db/pg-error";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import type { AdjustPricesInput } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { adjustOrderPricesInDb } = await import("./price-adjust");
const { recomputeOrderTotals } = await import("./totals");
const { insertAdminUser, insertTestOrder } = await import("./testing");

// covers: AC-4, AC-5, AC-6, AC-10, AC-13 (spec 0022)

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

const at = new Date("2094-07-01T08:00:00Z");

type TestOrderInput = Partial<Parameters<typeof insertTestOrder>[1]>;

/**
 * An electrician order with two lines: the test order's line (2 × ₪125) and a second one
 * (3 × ₪40), totals recomputed, so the order total is ₪370 for pickup.
 */
async function setup(tx: Transaction, order: TestOrderInput = {}, code = "TEST-PA") {
  const { variant } = await insertSimpleProduct(tx, code);
  const adminId = await insertAdminUser(tx);
  const row = await insertTestOrder(tx, {
    placedAt: at,
    variant,
    placedByRole: "electrician",
    unseen: false,
    ...order,
  });
  await tx.insert(orderLines).values({
    orderId: row.id,
    productId: variant.productId,
    variantId: variant.id,
    productName: "سبوت اختبار",
    productCode: `${code}-2`,
    quantity: 3,
    catalogUnitPrice: 4_000,
    unitPrice: 4_000,
    lineTotal: 12_000,
    sort: 1,
  });
  const { total } = await recomputeOrderTotals(tx, row.id);
  const [first, second] = await tx
    .select()
    .from(orderLines)
    .where(eq(orderLines.orderId, row.id))
    .orderBy(orderLines.sort);
  return { adminId, row, total, first, second, variant };
}

const readOrder = async (tx: Transaction, id: string) =>
  (await tx.select().from(orders).where(eq(orders.id, id)))[0];

const linesOf = (tx: Transaction, id: string) =>
  tx.select().from(orderLines).where(eq(orderLines.orderId, id)).orderBy(orderLines.sort);

const priceEventsOf = (tx: Transaction, id: string) =>
  tx
    .select()
    .from(orderEvents)
    .where(sql`${orderEvents.orderId} = ${id} and ${orderEvents.type} = 'line_price_changed'`);

const changesOf = (tx: Transaction, lineIds: readonly string[]) =>
  tx
    .select()
    .from(orderLinePriceChanges)
    .where(inArray(orderLinePriceChanges.orderLineId, [...lineIds]));

type Line = { readonly id: string; readonly unitPrice: number };

const input = (
  orderId: string,
  expectedTotal: number,
  lines: readonly (readonly [Line, number])[],
  note?: string,
): AdjustPricesInput => ({
  orderId,
  expectedTotal,
  note,
  lines: lines.map(([line, price]) => ({
    lineId: line.id,
    expectedUnitPrice: line.unitPrice,
    price,
  })),
});

/** Nothing about the order moved: totals, line prices, no price event, no change row. */
async function expectUntouched(tx: Transaction, setupResult: Awaited<ReturnType<typeof setup>>) {
  const { row, total, first, second } = setupResult;
  expect(await readOrder(tx, row.id)).toMatchObject({ total, subtotal: total });
  expect((await linesOf(tx, row.id)).map((line) => line.unitPrice)).toEqual([
    first.unitPrice,
    second.unitPrice,
  ]);
  expect(await priceEventsOf(tx, row.id)).toHaveLength(0);
  expect(await changesOf(tx, [first.id, second.id])).toHaveLength(0);
}

describe.skipIf(!hasLocalDb)("adjustOrderPricesInDb on the local database", () => {
  it("writes the lines, totals, one seen event, and one change row per changed line", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row, total, first, second, variant } = await setup(tx, {
        status: "preparing",
      });
      expect(total).toBe(37_000);

      const result = await adjustOrderPricesInDb(
        tx,
        adminId,
        input(
          row.id,
          total,
          [
            [first, 10_000],
            [second, 0],
          ],
          "مشروع كبير",
        ),
      );
      expect(result).toEqual({
        ok: true,
        data: {
          number: row.orderNumber,
          subtotal: 20_000,
          total: 20_000,
          fromTotal: 37_000,
          lineCount: 2,
          lines: [
            { lineId: first.id, unitPrice: 10_000, lineTotal: 20_000 },
            { lineId: second.id, unitPrice: 0, lineTotal: 0 },
          ],
        },
      });

      expect(await readOrder(tx, row.id)).toMatchObject({
        subtotal: 20_000,
        total: 20_000,
        deliveryFee: 0,
        discountTotal: 0,
        status: "preparing",
      });
      const lines = await linesOf(tx, row.id);
      expect(lines.map((line) => [line.catalogUnitPrice, line.unitPrice, line.lineTotal])).toEqual([
        [12_500, 10_000, 20_000],
        [4_000, 0, 0],
      ]);
      const [catalog] = await tx
        .select({ price: productVariants.price })
        .from(productVariants)
        .where(eq(productVariants.id, variant.id));
      expect(catalog.price).toBe(12_500);

      const [event, ...more] = await priceEventsOf(tx, row.id);
      expect(more).toHaveLength(0);
      expect(event).toMatchObject({
        actorKind: "admin",
        actorUserId: adminId,
        data: { lineCount: 2, fromTotal: 37_000, toTotal: 20_000, note: "مشروع كبير" },
      });
      expect(event.seenAt).toBeInstanceOf(Date);

      const changes = await changesOf(tx, [first.id, second.id]);
      expect(
        changes
          .map((change) => [
            change.orderEventId,
            change.orderLineId,
            change.oldUnitPrice,
            change.newUnitPrice,
          ])
          .sort((a, b) => Number(a[2]) - Number(b[2])),
      ).toEqual([
        [event.id, second.id, 4_000, 0],
        [event.id, first.id, 12_500, 10_000],
      ]);
    });
  });

  it("writes rows only for lines whose price changed, and leaves the note out when empty", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row, total, first, second } = await setup(tx);

      const result = await adjustOrderPricesInDb(
        tx,
        adminId,
        input(row.id, total, [
          [first, 12_500],
          [second, 3_500],
        ]),
      );
      expect(result).toMatchObject({ ok: true, data: { lineCount: 1, total: 35_500 } });
      const [event] = await priceEventsOf(tx, row.id);
      expect(event.data).toEqual({ lineCount: 1, fromTotal: 37_000, toTotal: 35_500 });
      const changes = await changesOf(tx, [first.id, second.id]);
      expect(changes.map((change) => change.orderLineId)).toEqual([second.id]);
    });
  });

  it("chains a second save from the first one's prices", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row, total, first, second } = await setup(tx);
      await adjustOrderPricesInDb(tx, adminId, input(row.id, total, [[first, 10_000]]));
      const after = { ...first, unitPrice: 10_000 };
      expect(
        await adjustOrderPricesInDb(tx, adminId, input(row.id, 32_000, [[after, 12_500]])),
      ).toMatchObject({ ok: true, data: { total: 37_000, fromTotal: 32_000 } });
      const changes = await changesOf(tx, [first.id, second.id]);
      expect(changes.map((c) => [c.oldUnitPrice, c.newUnitPrice]).sort()).toEqual([
        [10_000, 12_500],
        [12_500, 10_000],
      ]);
    });
  });

  it("answers not_electrician for customer and guest orders", async () => {
    await withRollback(db, async (tx) => {
      for (const placedByRole of ["customer", null] as const) {
        const made = await setup(tx, { placedByRole }, placedByRole ? "TEST-PA-C" : "TEST-PA-G");
        expect(
          await adjustOrderPricesInDb(
            tx,
            made.adminId,
            input(made.row.id, made.total, [[made.first, 10_000]]),
          ),
        ).toEqual({ ok: false, error: "not_electrician" });
        await expectUntouched(tx, made);
        await tx.execute(sql`delete from auth.users where email = 'owner-orders@example.test'`);
      }
    });
  });

  it("answers locked for delivered and cancelled, before stale", async () => {
    await withRollback(db, async (tx) => {
      for (const status of ["delivered", "cancelled"] as const) {
        const made = await setup(
          tx,
          { status },
          status === "delivered" ? "TEST-PA-D" : "TEST-PA-X",
        );
        // A stale total too: the lock is checked first.
        expect(
          await adjustOrderPricesInDb(
            tx,
            made.adminId,
            input(made.row.id, made.total + 1, [[made.first, 10_000]]),
          ),
        ).toEqual({ ok: false, error: "locked" });
        await expectUntouched(tx, made);
        await tx.execute(sql`delete from auth.users where email = 'owner-orders@example.test'`);
      }
    });
  });

  it("answers stale on a moved total and on a moved line price", async () => {
    await withRollback(db, async (tx) => {
      const made = await setup(tx);
      const { adminId, row, total, first } = made;
      expect(
        await adjustOrderPricesInDb(tx, adminId, input(row.id, total - 100, [[first, 10_000]])),
      ).toEqual({ ok: false, error: "stale" });
      expect(
        await adjustOrderPricesInDb(
          tx,
          adminId,
          input(row.id, total, [[{ ...first, unitPrice: 12_000 }, 10_000]]),
        ),
      ).toEqual({ ok: false, error: "stale" });
      await expectUntouched(tx, made);
    });
  });

  it("answers invalid with above_catalog per line, and no_change when nothing moves", async () => {
    await withRollback(db, async (tx) => {
      const made = await setup(tx);
      const { adminId, row, total, first, second } = made;
      expect(
        await adjustOrderPricesInDb(
          tx,
          adminId,
          input(row.id, total, [
            [first, 12_501],
            [second, 3_000],
          ]),
        ),
      ).toEqual({ ok: false, error: "invalid", lineErrors: { [first.id]: "above_catalog" } });
      expect(
        await adjustOrderPricesInDb(
          tx,
          adminId,
          input(row.id, total, [
            [first, 12_500],
            [second, 4_000],
          ]),
        ),
      ).toEqual({ ok: false, error: "no_change" });
      await expectUntouched(tx, made);
    });
  });

  it("answers below_paid and rolls back the line updates", async () => {
    await withRollback(db, async (tx) => {
      const made = await setup(tx);
      await tx.update(orders).set({ amountPaid: 30_000 }).where(eq(orders.id, made.row.id));
      expect(
        await adjustOrderPricesInDb(
          tx,
          made.adminId,
          input(made.row.id, made.total, [[made.first, 5_000]]),
        ),
      ).toEqual({ ok: false, error: "below_paid", paid: 30_000 });
      await expectUntouched(tx, made);
      // Down to exactly the paid amount is fine.
      expect(
        await adjustOrderPricesInDb(
          tx,
          made.adminId,
          input(made.row.id, made.total, [[made.first, 9_000]]),
        ),
      ).toMatchObject({ ok: true, data: { total: 30_000 } });
    });
  });

  it("answers not_found for an unknown order and for a line of another order", async () => {
    await withRollback(db, async (tx) => {
      const made = await setup(tx);
      const other = await insertTestOrder(tx, {
        placedAt: at,
        variant: made.variant,
        placedByRole: "electrician",
      });
      const [otherLine] = await linesOf(tx, other.id);
      expect(
        await adjustOrderPricesInDb(
          tx,
          made.adminId,
          input("00000000-0000-4000-8000-000000000000", made.total, [[made.first, 10_000]]),
        ),
      ).toEqual({ ok: false, error: "not_found" });
      expect(
        await adjustOrderPricesInDb(
          tx,
          made.adminId,
          input(made.row.id, made.total, [
            [made.first, 10_000],
            [otherLine, 10_000],
          ]),
        ),
      ).toEqual({ ok: false, error: "not_found" });
      await expectUntouched(tx, made);
    });
  });
});

// covers: AC-10 (spec 0022)
describe.skipIf(!hasLocalDb)("order_line_price_changes is append only", () => {
  const refused = async (tx: Transaction, run: (sp: Transaction) => Promise<unknown>) => {
    const error = await tx.transaction(run).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error, "expected the trigger to refuse").not.toBeNull();
    expect(pgErrorOf(error)?.code).toBe("23001");
  };

  it("refuses update, delete, and truncate, and keeps the line and order through restrict", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row, total, first } = await setup(tx);
      await adjustOrderPricesInDb(tx, adminId, input(row.id, total, [[first, 10_000]]));

      await refused(tx, (sp) =>
        sp
          .update(orderLinePriceChanges)
          .set({ newUnitPrice: 1 })
          .where(eq(orderLinePriceChanges.orderLineId, first.id)),
      );
      await refused(tx, (sp) =>
        sp.delete(orderLinePriceChanges).where(eq(orderLinePriceChanges.orderLineId, first.id)),
      );
      await refused(tx, (sp) => sp.execute(sql`truncate public.order_line_price_changes`));

      const lineDelete = await tx
        .transaction((sp) => sp.delete(orderLines).where(eq(orderLines.id, first.id)))
        .then(
          () => null,
          (caught: unknown) => caught,
        );
      expect(pgErrorOf(lineDelete)?.code).toBe("23503");
      expect(await changesOf(tx, [first.id])).toHaveLength(1);
    });
  });
});

// covers: AC-6, AC-13 (spec 0022). Two connections need committed rows; cleanup turns the append
// only triggers off for its own transaction only.
describe.skipIf(!hasLocalDb)("two concurrent price saves", () => {
  const YEAR = 2089;
  const CODE = "PA-RACE";
  const EMAIL = "pa-race-owner@example.test";
  const second = hasLocalDb ? getDirectDb() : (null as never);

  async function cleanUp() {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      const placed = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(like(orders.orderNumber, `${String(YEAR).slice(2)}-%`));
      const ids = placed.map((order) => order.id);
      if (ids.length) {
        const lineIds = (
          await tx
            .select({ id: orderLines.id })
            .from(orderLines)
            .where(inArray(orderLines.orderId, ids))
        ).map((line) => line.id);
        if (lineIds.length) {
          await tx
            .delete(orderLinePriceChanges)
            .where(inArray(orderLinePriceChanges.orderLineId, lineIds));
        }
        await tx.delete(orderEvents).where(inArray(orderEvents.orderId, ids));
        await tx.delete(orderLines).where(inArray(orderLines.orderId, ids));
        await tx.delete(orders).where(inArray(orders.id, ids));
      }
      await tx.delete(orderNumberCounters).where(eq(orderNumberCounters.year, YEAR));
      await tx.execute(sql`delete from auth.users where email = ${EMAIL}`);
      await tx.delete(products).where(like(products.code, `${CODE}%`));
      await tx.delete(categories).where(like(categories.slug, `test-${CODE.toLowerCase()}%`));
      await tx.delete(colours).where(eq(colours.name, `لون ${CODE}`));
    });
  }

  afterAll(async () => {
    await cleanUp();
    await second.$client.end();
  });

  it("lets one save win and answers stale to the other, with nothing of it written", async () => {
    await cleanUp();
    const made = await db.transaction(async (tx) => {
      const { variant } = await insertSimpleProduct(tx, CODE);
      const adminId = await insertAdminUser(tx, EMAIL);
      const row = await insertTestOrder(tx, {
        placedAt: new Date(`${YEAR}-01-01T09:00:00Z`),
        variant,
        placedByRole: "electrician",
        unseen: false,
      });
      const [line] = await linesOf(tx, row.id);
      return { adminId, row, line };
    });

    const save = (on: typeof db, price: number) =>
      adjustOrderPricesInDb(on, made.adminId, input(made.row.id, 25_000, [[made.line, price]]));
    const results = await Promise.all([save(db, 10_000), save(second, 11_000)]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, error: "stale" }]);
    const winner = results[0].ok ? 10_000 : 11_000;
    const [line] = await db.select().from(orderLines).where(eq(orderLines.id, made.line.id));
    expect(line.unitPrice).toBe(winner);
    const changes = await db
      .select()
      .from(orderLinePriceChanges)
      .where(eq(orderLinePriceChanges.orderLineId, made.line.id));
    expect(changes.map((change) => change.newUnitPrice)).toEqual([winner]);
  });
});
