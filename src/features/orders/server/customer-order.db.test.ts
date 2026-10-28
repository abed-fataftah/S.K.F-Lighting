import { afterAll, describe, expect, it, vi } from "vitest";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";

vi.mock("server-only", () => ({}));

const { getDirectDb } = await import("@/server/db/direct");
const { insertTestOrder } = await import("./testing");
const { findLookupOrderId, readCustomerOrder } = await import("./customer-order");

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
