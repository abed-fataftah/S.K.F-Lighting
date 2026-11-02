import { afterAll, describe, expect, it, vi } from "vitest";
import { orderLines } from "@/server/db/schema";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { insertCustomerUser, insertTestOrder } = await import("./testing");
const { readMyOrders } = await import("./my-orders");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// A far future year keeps these numbers away from real ones, inside the rollback.
const at = (day: number) => new Date(`2096-05-${String(day).padStart(2, "0")}T08:00:00Z`);

// covers: AC-2, AC-3, AC-5 (spec 0018)
describe.skipIf(!hasLocalDb)("readMyOrders on the local database", () => {
  it("reads only this account's orders, newest first, then the higher number on a tie", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-MINE");
      const me = await insertCustomerUser(tx, "my-orders-me@example.test");
      const other = await insertCustomerUser(tx, "my-orders-other@example.test");
      const oldest = await insertTestOrder(tx, { placedAt: at(1), variant, placedByUserId: me });
      const tieFirst = await insertTestOrder(tx, { placedAt: at(3), variant, placedByUserId: me });
      const tieSecond = await insertTestOrder(tx, {
        placedAt: at(3),
        variant,
        placedByUserId: me,
        status: "cancelled",
      });
      await insertTestOrder(tx, { placedAt: at(4), variant, placedByUserId: other });
      await insertTestOrder(tx, { placedAt: at(5), variant });

      const read = await readMyOrders(tx, me, 1);

      expect(read.total).toBe(3);
      expect(read.rows.map((row) => row.number)).toEqual([
        tieSecond.orderNumber,
        tieFirst.orderNumber,
        oldest.orderNumber,
      ]);
      expect(read.rows.map((row) => row.position)).toEqual([1, 2, 3]);
      expect(read.rows[0]).toEqual({
        position: 1,
        number: tieSecond.orderNumber,
        status: "cancelled",
        placedAt: at(3),
        total: 25_000,
        amountPaid: 0,
        lineCount: 1,
      });
    });
  });

  it("counts lines, not quantities", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-LINES");
      const me = await insertCustomerUser(tx, "my-orders-lines@example.test");
      const order = await insertTestOrder(tx, { placedAt: at(1), variant, placedByUserId: me });
      await tx.insert(orderLines).values({
        orderId: order.id,
        productId: variant.productId,
        variantId: variant.id,
        productName: "ثريا اختبار",
        productCode: "TEST-LINES",
        quantity: 200,
        catalogUnitPrice: 100,
        unitPrice: 100,
        lineTotal: 20_000,
        sort: 1,
      });

      const [row] = (await readMyOrders(tx, me, 1)).rows;
      expect(row.lineCount).toBe(2);
    });
  });

  it("shows 20 per step with the full count, and every order on a page past the end", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-PAGES");
      const me = await insertCustomerUser(tx, "my-orders-pages@example.test");
      for (let day = 1; day <= 21; day++) {
        await insertTestOrder(tx, { placedAt: at(day), variant, placedByUserId: me });
      }

      const first = await readMyOrders(tx, me, 1);
      expect(first.rows).toHaveLength(20);
      expect(first.total).toBe(21);
      expect(first.rows[0].placedAt).toEqual(at(21));

      const past = await readMyOrders(tx, me, 9);
      expect(past.rows).toHaveLength(21);
      expect(past.total).toBe(21);
      expect(past.rows.at(-1)?.placedAt).toEqual(at(1));
    });
  });

  it("reads no orders and a count of 0 for a new account", async () => {
    await withRollback(db, async (tx) => {
      const me = await insertCustomerUser(tx, "my-orders-empty@example.test");
      expect(await readMyOrders(tx, me, 1)).toEqual({ rows: [], total: 0 });
    });
  });
});
