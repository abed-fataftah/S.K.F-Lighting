import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { orderEvents, orderLines, orders } from "@/server/db/schema";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { allocateOrderNumber } = await import("./order-number");
const { markOrderSeen, readAdminOrder, readAdminOrders, readUnseenCount } =
  await import("./admin-queries");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// A far future year keeps these orders at the top of the newest first list, inside the rollback.
const at = (minute: number) => new Date(`2094-03-01T08:${String(minute).padStart(2, "0")}:00Z`);

async function insertOrder(
  tx: Transaction,
  placedAt: Date,
  variant: { id: string; productId: string },
) {
  const orderNumber = await allocateOrderNumber(tx, placedAt);
  const [order] = await tx
    .insert(orders)
    .values({
      orderNumber,
      customerName: "زبون اختبار",
      customerPhone: "0599123456",
      customerPhoneE164: "+970599123456",
      fulfilment: "pickup",
      subtotal: 25_000,
      total: 25_000,
      placedAt,
    })
    .returning();
  await tx.insert(orderLines).values({
    orderId: order.id,
    productId: variant.productId,
    variantId: variant.id,
    productName: "ثريا اختبار",
    productCode: "TEST-ADM",
    quantity: 2,
    catalogUnitPrice: 12_500,
    unitPrice: 12_500,
    lineTotal: 25_000,
  });
  await tx.insert(orderEvents).values({ orderId: order.id, type: "created", actorKind: "guest" });
  return order;
}

// covers: AC-13 (spec 0004); AC-8 (spec 0005: the phone is read as stored E.164, for formatPhone)
describe.skipIf(!hasLocalDb)("dashboard order reads on the local database", () => {
  it("lists newest first with the new flag, and opening an order clears only its flag", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-ADM");
      const older = await insertOrder(tx, at(1), variant);
      const newer = await insertOrder(tx, at(2), variant);

      const { rows } = await readAdminOrders(tx, 1);
      expect(rows.slice(0, 2)).toMatchObject([
        {
          number: newer.orderNumber,
          name: "زبون اختبار",
          phoneE164: "+970599123456",
          fulfilment: "pickup",
          isUnseen: true,
        },
        { number: older.orderNumber, total: 25_000, isUnseen: true },
      ]);

      const opened = await readAdminOrder(tx, newer.orderNumber);
      expect(opened).toMatchObject({
        number: newer.orderNumber,
        phoneE164: "+970599123456",
        status: "new",
        events: [{ type: "created", actorKind: "guest", toStatus: null }],
        lines: [{ name: "ثريا اختبار", code: "TEST-ADM", quantity: 2, lineTotal: 25_000 }],
      });
      await markOrderSeen(tx, newer.id);

      const after = await readAdminOrders(tx, 1);
      expect(after.rows.slice(0, 2).map((row) => row.isUnseen)).toEqual([false, true]);
      const [event] = await tx.select().from(orderEvents).where(eq(orderEvents.orderId, newer.id));
      expect(event.seenAt).toBeInstanceOf(Date);
    });
  });

  it("returns null for an unknown number", async () => {
    expect(await readAdminOrder(db, "00-99999")).toBeNull();
  });
});

// covers: AC-8, AC-14, AC-15 (spec 0014)
describe.skipIf(!hasLocalDb)("unseen orders on the local database", () => {
  it("counts each order once, never the owner's own events, and a customer cancel again", async () => {
    await withRollback(db, async (tx) => {
      const { insertAdminUser, insertTestOrder } = await import("./testing");
      const { cancelOrderInDb, changeOrderStatusInDb } = await import("./admin-status");
      const { variant } = await insertSimpleProduct(tx, "TEST-UNS");
      const adminId = await insertAdminUser(tx);
      const before = await readUnseenCount(tx);

      const fresh = await insertTestOrder(tx, { placedAt: at(10), variant });
      // A second unseen event on the same order still counts it once.
      await tx.insert(orderEvents).values({
        orderId: fresh.id,
        type: "cancelled",
        actorKind: "guest",
        toStatus: "cancelled",
      });
      const opened = await insertTestOrder(tx, { placedAt: at(11), variant, unseen: false });
      expect(await readUnseenCount(tx)).toBe(before + 1);

      // The owner's move and cancel are written seen.
      await changeOrderStatusInDb(tx, adminId, { orderId: opened.id, from: "new", to: "ready" });
      await cancelOrderInDb(tx, adminId, { orderId: opened.id, from: "ready", reason: null });
      expect(await readUnseenCount(tx)).toBe(before + 1);
      const { rows } = await readAdminOrders(tx, 1);
      expect(rows.find((row) => row.number === opened.orderNumber)).toMatchObject({
        status: "cancelled",
        isUnseen: false,
        cancelledByCustomer: false,
      });

      // A customer cancelling after the owner opened it flags it again.
      const later = await insertTestOrder(tx, { placedAt: at(12), variant, unseen: false });
      await tx
        .update(orders)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "customer" })
        .where(eq(orders.id, later.id));
      await tx.insert(orderEvents).values({
        orderId: later.id,
        type: "cancelled",
        actorKind: "customer",
        fromStatus: "new",
        toStatus: "cancelled",
      });
      expect(await readUnseenCount(tx)).toBe(before + 2);
      const after = await readAdminOrders(tx, 1);
      expect(after.rows.find((row) => row.number === later.orderNumber)).toMatchObject({
        isUnseen: true,
        cancelledByCustomer: true,
      });

      await markOrderSeen(tx, later.id);
      await markOrderSeen(tx, fresh.id);
      expect(await readUnseenCount(tx)).toBe(before);
    });
  });

  it("reads the history oldest first and keeps other event types out", async () => {
    await withRollback(db, async (tx) => {
      const { insertTestOrder } = await import("./testing");
      const { variant } = await insertSimpleProduct(tx, "TEST-HIS");
      const order = await insertTestOrder(tx, { placedAt: at(20), variant });
      await tx.insert(orderEvents).values([
        { orderId: order.id, type: "note", actorKind: "admin", createdAt: at(21) },
        {
          orderId: order.id,
          type: "status_changed",
          actorKind: "admin",
          fromStatus: "new",
          toStatus: "preparing",
          createdAt: at(22),
        },
      ]);
      const read = await readAdminOrder(tx, order.orderNumber);
      expect(read?.events.map((event) => [event.type, event.toStatus])).toEqual([
        ["created", null],
        ["status_changed", "preparing"],
      ]);
    });
  });
});
