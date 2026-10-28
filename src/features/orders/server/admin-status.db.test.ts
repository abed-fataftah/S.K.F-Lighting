import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { orderEvents, orders } from "@/server/db/schema";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";
import { cancelOrderSchema } from "../schemas";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { cancelOrderInDb, changeOrderStatusInDb } = await import("./admin-status");
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
