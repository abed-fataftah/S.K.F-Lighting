import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { orderEvents, orders } from "@/server/db/schema";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { cancelOrderSchema } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { cancelOrderByCustomerInDb, cancelOrderInDb, changeOrderStatusInDb } =
  await import("./admin-status");
const { insertAdminUser, insertTestOrder } = await import("./testing");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

const at = new Date("2094-04-01T08:00:00Z");

async function setup(tx: Transaction, order: Partial<Parameters<typeof insertTestOrder>[1]> = {}) {
  const { variant } = await insertSimpleProduct(tx, "TEST-ST");
  const adminId = await insertAdminUser(tx);
  const another = (more: Partial<Parameters<typeof insertTestOrder>[1]>) =>
    insertTestOrder(tx, { placedAt: at, variant, ...more });
  return { adminId, row: await another(order), another };
}

const readOrder = async (tx: Transaction, id: string) =>
  (await tx.select().from(orders).where(eq(orders.id, id)))[0];

const eventsOf = (tx: Transaction, id: string) =>
  tx.select().from(orderEvents).where(eq(orderEvents.orderId, id));

// covers: AC-3, AC-18 (spec 0014)
describe.skipIf(!hasLocalDb)("changeOrderStatusInDb on the local database", () => {
  it("moves the order and writes one seen status_changed event with from, to, and actor", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row } = await setup(tx);

      expect(
        await changeOrderStatusInDb(tx, adminId, { orderId: row.id, from: "new", to: "preparing" }),
      ).toEqual({ ok: true, data: { status: "preparing", number: row.orderNumber } });

      expect(await readOrder(tx, row.id)).toMatchObject({ status: "preparing", deliveredAt: null });
      const events = await eventsOf(tx, row.id);
      expect(events).toHaveLength(2);
      expect(events.find((e) => e.type !== "created")).toMatchObject({
        type: "status_changed",
        actorKind: "admin",
        actorUserId: adminId,
        fromStatus: "new",
        toStatus: "preparing",
        data: {},
      });
      expect(events.find((e) => e.type !== "created")?.seenAt).toBeInstanceOf(Date);
    });
  });

  it("sets delivered_at on delivered, with a skip from ready", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row } = await setup(tx, { fulfilment: "delivery", status: "ready" });

      const result = await changeOrderStatusInDb(tx, adminId, {
        orderId: row.id,
        from: "ready",
        to: "delivered",
      });
      expect(result.ok).toBe(true);
      expect((await readOrder(tx, row.id)).deliveredAt).toBeInstanceOf(Date);
    });
  });

  it("gives stale for a wrong from, also confirmed sent as new, and writes nothing", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row, another } = await setup(tx, { status: "preparing" });
      expect(
        await changeOrderStatusInDb(tx, adminId, { orderId: row.id, from: "new", to: "ready" }),
      ).toEqual({ ok: false, error: "stale" });

      const confirmed = { row: await another({ status: "confirmed" }) };
      expect(
        await changeOrderStatusInDb(tx, adminId, {
          orderId: confirmed.row.id,
          from: "new",
          to: "preparing",
        }),
      ).toEqual({ ok: false, error: "stale" });

      expect((await readOrder(tx, row.id)).status).toBe("preparing");
      expect(await eventsOf(tx, row.id)).toHaveLength(1);
    });
  });

  it("gives not_allowed for an illegal move and not_found for an unknown id", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row } = await setup(tx, { status: "ready" });
      expect(
        await changeOrderStatusInDb(tx, adminId, {
          orderId: row.id,
          from: "ready",
          to: "out_for_delivery",
        }),
      ).toEqual({ ok: false, error: "not_allowed" });
      expect(
        await changeOrderStatusInDb(tx, adminId, { orderId: row.id, from: "ready", to: "new" }),
      ).toEqual({ ok: false, error: "not_allowed" });
      expect(
        await changeOrderStatusInDb(tx, adminId, {
          orderId: "0b5f8a52-8e1b-4c1e-9a55-2b1f0e7d9c11",
          from: "new",
          to: "preparing",
        }),
      ).toEqual({ ok: false, error: "not_found" });
      expect(await eventsOf(tx, row.id)).toHaveLength(1);
    });
  });
});

// covers: AC-4 (spec 0014)
describe.skipIf(!hasLocalDb)("cancelOrderInDb on the local database", () => {
  it("sets the three columns and writes one seen cancelled event with no reason in it", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row } = await setup(tx, { status: "ready" });
      const input = cancelOrderSchema.parse({
        orderId: row.id,
        from: "ready",
        reason: "  العميل غيّر رأيه  ",
      });

      expect(await cancelOrderInDb(tx, adminId, input)).toEqual({
        ok: true,
        data: { status: "cancelled", number: row.orderNumber },
      });
      const order = await readOrder(tx, row.id);
      expect(order).toMatchObject({
        status: "cancelled",
        cancelledBy: "admin",
        cancelReason: "العميل غيّر رأيه",
      });
      expect(order.cancelledAt).toBeInstanceOf(Date);
      const events = await eventsOf(tx, row.id);
      expect(events.find((e) => e.type !== "created")).toMatchObject({
        type: "cancelled",
        actorKind: "admin",
        actorUserId: adminId,
        fromStatus: "ready",
        toStatus: "cancelled",
        data: {},
      });
      expect(events.find((e) => e.type !== "created")?.seenAt).toBeInstanceOf(Date);
    });
  });

  it("keeps a blank reason as null", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row } = await setup(tx);
      const input = cancelOrderSchema.parse({ orderId: row.id, from: "new", reason: " \n " });
      expect((await cancelOrderInDb(tx, adminId, input)).ok).toBe(true);
      expect((await readOrder(tx, row.id)).cancelReason).toBeNull();
    });
  });

  it("refuses a delivered order and gives stale for one already cancelled", async () => {
    await withRollback(db, async (tx) => {
      const { adminId, row, another } = await setup(tx, { status: "delivered" });
      expect(
        await cancelOrderInDb(tx, adminId, { orderId: row.id, from: "delivered", reason: null }),
      ).toEqual({ ok: false, error: "not_allowed" });

      const cancelled = { row: await another({ status: "cancelled" }) };
      expect(
        await cancelOrderInDb(tx, adminId, {
          orderId: cancelled.row.id,
          from: "new",
          reason: null,
        }),
      ).toEqual({ ok: false, error: "stale" });
      expect((await readOrder(tx, row.id)).status).toBe("delivered");
    });
  });
});

const recordPayment = (tx: Transaction, id: string, amountPaid: number) =>
  tx.update(orders).set({ amountPaid }).where(eq(orders.id, id));

// covers: AC-1, AC-4, AC-6 (spec 0016)
describe.skipIf(!hasLocalDb)("cancelOrderByCustomerInDb on the local database", () => {
  it("sets the four columns and writes one unseen cancelled event as a guest", async () => {
    await withRollback(db, async (tx) => {
      const { row } = await setup(tx, { fulfilment: "delivery", status: "preparing" });
      const input = cancelOrderSchema.parse({
        orderId: row.id,
        from: "preparing",
        reason: "  وجدت أرخص ",
      });

      expect(await cancelOrderByCustomerInDb(tx, input)).toEqual({
        ok: true,
        data: { status: "cancelled", number: row.orderNumber },
      });
      const order = await readOrder(tx, row.id);
      expect(order).toMatchObject({
        status: "cancelled",
        cancelledBy: "guest",
        cancelReason: "وجدت أرخص",
      });
      expect(order.cancelledAt).toBeInstanceOf(Date);
      const events = (await eventsOf(tx, row.id)).filter((e) => e.type !== "created");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "cancelled",
        actorKind: "guest",
        actorUserId: null,
        fromStatus: "preparing",
        toStatus: "cancelled",
        data: {},
        seenAt: null,
      });
    });
  });

  it("cancels new, confirmed, and a pickup order at ready, with a blank reason as null", async () => {
    await withRollback(db, async (tx) => {
      const { row, another } = await setup(tx, { status: "new" });
      const confirmed = await another({ status: "confirmed" });
      const ready = await another({ fulfilment: "pickup", status: "ready" });
      for (const [order, from] of [
        [row, "new"],
        [confirmed, "confirmed"],
        [ready, "ready"],
      ] as const) {
        const input = cancelOrderSchema.parse({ orderId: order.id, from, reason: " " });
        expect((await cancelOrderByCustomerInDb(tx, input)).ok).toBe(true);
        expect((await readOrder(tx, order.id)).cancelReason).toBeNull();
      }
    });
  });

  it("gives stale for a wrong from, and not_allowed when shipped, paid, or final", async () => {
    await withRollback(db, async (tx) => {
      const { row, another } = await setup(tx, { status: "preparing" });
      const shipped = await another({ fulfilment: "delivery", status: "out_for_delivery" });
      const paid = await another({ status: "ready" });
      await recordPayment(tx, paid.id, 5_000);
      const delivered = await another({ status: "delivered" });
      const cancelled = await another({ status: "cancelled" });
      const cancel = (orderId: string, from: CancelFrom) =>
        cancelOrderByCustomerInDb(tx, { orderId, from, reason: null });

      expect(await cancel(row.id, "new")).toEqual({ ok: false, error: "stale" });
      expect(await cancel(shipped.id, "out_for_delivery")).toEqual({
        ok: false,
        error: "not_allowed",
      });
      expect(await cancel(paid.id, "ready")).toEqual({ ok: false, error: "not_allowed" });
      expect(await cancel(delivered.id, "delivered")).toEqual({ ok: false, error: "not_allowed" });
      expect(await cancel(delivered.id, "ready")).toEqual({ ok: false, error: "stale" });
      expect(await cancel(cancelled.id, "new")).toEqual({ ok: false, error: "stale" });
      expect(await cancel("9f8e7d6c-5b4a-4321-8fed-cba987654321", "new")).toEqual({
        ok: false,
        error: "not_found",
      });

      for (const [order, status] of [
        [row, "preparing"],
        [shipped, "out_for_delivery"],
        [paid, "ready"],
        [delivered, "delivered"],
      ] as const) {
        expect(await readOrder(tx, order.id)).toMatchObject({ status, cancelReason: null });
        expect((await eventsOf(tx, order.id)).map((e) => e.type)).toEqual(["created"]);
      }
    });
  });
});

type CancelFrom = Parameters<typeof cancelOrderByCustomerInDb>[1]["from"];
