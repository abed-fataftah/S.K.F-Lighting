import { afterAll, describe, expect, it, vi } from "vitest";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { insertCustomerUser, insertTestOrder } = await import("./testing");
const { findLookupOrderId, isOwnedOrder, readCustomerOrder, readOwnedOrderId } =
  await import("./customer-order");
const { cancelOrderByCustomerInDb } = await import("./admin-status");

const db = hasLocalDb ? getDirectDb() : (null as never);

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

// A far future year keeps these numbers away from real ones, inside the rollback.
const placedAt = new Date("2095-04-02T08:00:00Z");
const PHONE = "+970599123456";

// The columns that must never reach the customer's page (AC-13).
const PERSONAL = [
  "customerName",
  "customerPhone",
  "customerPhoneE164",
  "city",
  "address",
  "area",
  "notes",
];

// covers: AC-5, AC-7, AC-10, AC-13 (spec 0015)
describe.skipIf(!hasLocalDb)("customer order reads on the local database", () => {
  it("finds an order only when the number and the phone both match", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-LOOKUP");
      const order = await insertTestOrder(tx, { placedAt, variant, phoneE164: PHONE });
      const other = await insertTestOrder(tx, { placedAt, variant, phoneE164: "+970598000000" });

      expect(await findLookupOrderId(tx, order.orderNumber, PHONE)).toBe(order.id);
      expect(await findLookupOrderId(tx, order.orderNumber, "+970598000000")).toBeNull();
      expect(await findLookupOrderId(tx, other.orderNumber, PHONE)).toBeNull();
      expect(await findLookupOrderId(tx, "95-99999", PHONE)).toBeNull();
    });
  });

  it("reads the order only for an id the browser holds, with no personal column", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-LOOKUP");
      const order = await insertTestOrder(tx, { placedAt, variant, fulfilment: "delivery" });
      const other = await insertTestOrder(tx, { placedAt, variant });

      expect(await readCustomerOrder(tx, order.orderNumber, [])).toBeNull();
      expect(await readCustomerOrder(tx, order.orderNumber, [other.id])).toBeNull();

      const read = await readCustomerOrder(tx, order.orderNumber, [other.id, order.id]);
      expect(read).toMatchObject({
        id: order.id,
        orderNumber: order.orderNumber,
        status: "new",
        fulfilment: "delivery",
        deliveryZoneName: order.deliveryZoneName,
        placedAt,
        subtotal: 25_000,
        deliveryFee: 2_000,
        total: 27_000,
        amountPaid: 0,
        cancelledAt: null,
        cancelledBy: null,
        pickupAddress: null,
      });
      expect(read?.lines).toEqual([
        {
          productName: "ثريا اختبار",
          sizeLabel: null,
          colourName: null,
          quantity: 2,
          lineTotal: 25_000,
          imageKey: null,
        },
      ]);
      for (const column of PERSONAL) expect(read).not.toHaveProperty(column);
      expect(JSON.stringify(read)).not.toMatch(/رام الله|الإرسال|زبون اختبار|599123456/);
    });
  });
});

// covers: AC-7, AC-10 (spec 0016)
describe.skipIf(!hasLocalDb)("a cancelled order on the customer's page", () => {
  it("reads who cancelled it and when, and never the reason", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-LOOKUP");
      const order = await insertTestOrder(tx, { placedAt, variant, status: "ready" });
      const cancelled = await cancelOrderByCustomerInDb(tx, {
        orderId: order.id,
        from: "ready",
        reason: "سبب خاص جداً",
      });
      expect(cancelled.ok).toBe(true);

      const read = await readCustomerOrder(tx, order.orderNumber, [order.id]);
      expect(read).toMatchObject({ status: "cancelled", cancelledBy: "guest" });
      expect(read?.cancelledAt).toBeInstanceOf(Date);
      expect(read).not.toHaveProperty("cancelReason");
      expect(JSON.stringify(read)).not.toContain("سبب خاص جداً");
    });
  });
});

// covers: AC-14, AC-15 (spec 0017)
describe.skipIf(!hasLocalDb)("orders placed by an account, on the local database", () => {
  it("finds the order only for the account that placed it", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-OWNER");
      const owner = await insertCustomerUser(tx, "owner-read@example.test");
      const other = await insertCustomerUser(tx, "other-read@example.test");
      const order = await insertTestOrder(tx, { placedAt, variant, placedByUserId: owner });
      const guest = await insertTestOrder(tx, { placedAt, variant });

      expect(await readOwnedOrderId(tx, order.orderNumber, owner)).toBe(order.id);
      expect(await readOwnedOrderId(tx, order.orderNumber, other)).toBeNull();
      expect(await readOwnedOrderId(tx, guest.orderNumber, owner)).toBeNull();
      expect(await isOwnedOrder(tx, order.id, owner)).toBe(true);
      expect(await isOwnedOrder(tx, order.id, other)).toBe(false);
      expect(await isOwnedOrder(tx, guest.id, owner)).toBe(false);

      const read = await readCustomerOrder(tx, order.orderNumber, [order.id]);
      expect(read).toMatchObject({ id: order.id, status: "new" });
    });
  });

  it("lets the owner's cancel through the same guarded write, recorded as guest", async () => {
    await withRollback(db, async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-OWNER");
      const owner = await insertCustomerUser(tx, "owner-cancel@example.test");
      const order = await insertTestOrder(tx, { placedAt, variant, placedByUserId: owner });

      expect(await isOwnedOrder(tx, order.id, owner)).toBe(true);
      expect(
        await cancelOrderByCustomerInDb(tx, { orderId: order.id, from: "new", reason: null }),
      ).toMatchObject({ ok: true });
      expect(await readCustomerOrder(tx, order.orderNumber, [order.id])).toMatchObject({
        status: "cancelled",
        cancelledBy: "guest",
      });
    });
  });
});
