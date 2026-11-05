import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasLocalDb, insertSimpleProduct, withRollback } from "@/server/db/testing";
import type { Transaction } from "@/server/db/types";

// covers: AC-13, AC-17 (spec 0014). The action runs against the local database inside a rollback;
// only the admin check is replaced at the edge.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin, requireAdminPage: vi.fn() }));
let current: Transaction | null = null;
vi.mock("@/server/db", () => ({ getDb: async () => current }));

const { getDirectDb } = await import("@/server/db/direct");
const { searchAdminOrders } = await import("./admin-actions");
const { insertTestOrder } = await import("./testing");
const { shopYear } = await import("@/lib/format");

const db = hasLocalDb ? getDirectDb() : (null as never);
const info = vi.spyOn(console, "info").mockImplementation(() => {});

afterAll(async () => {
  if (hasLocalDb) await db.$client.end();
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin-1" } });
});

const at = (minute: number) => new Date(`2094-05-01T08:${String(minute).padStart(2, "0")}:00Z`);

async function within<T>(run: (tx: Transaction) => Promise<T>) {
  return withRollback(db, async (tx) => {
    current = tx;
    try {
      return await run(tx);
    } finally {
      current = null;
    }
  });
}

describe.skipIf(!hasLocalDb)("searchAdminOrders on the local database", () => {
  it("opens an existing number and says no_order for a missing one", async () => {
    await within(async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-SRC");
      const order = await insertTestOrder(tx, { placedAt: at(1), variant });

      expect(await searchAdminOrders({ text: order.orderNumber })).toEqual({
        ok: true,
        data: { kind: "open", number: order.orderNumber },
      });
      expect(await searchAdminOrders({ text: "94-99999" })).toEqual({
        ok: false,
        error: "no_order",
      });
    });
  });

  it("finds this year's order by its short form", async () => {
    await within(async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-SRS");
      const order = await insertTestOrder(tx, { placedAt: new Date(), variant });
      const short = String(Number(order.orderNumber.split("-")[1]));
      expect(order.orderNumber.startsWith(String(shopYear(new Date()) % 100))).toBe(true);
      expect(await searchAdminOrders({ text: short })).toEqual({
        ok: true,
        data: { kind: "open", number: order.orderNumber },
      });
    });
  });

  it("lists every order with a phone, newest first, whatever the status", async () => {
    await within(async (tx) => {
      const { variant } = await insertSimpleProduct(tx, "TEST-SRP");
      const phoneE164 = "+970591112233";
      const older = await insertTestOrder(tx, { placedAt: at(2), variant, phoneE164 });
      const newer = await insertTestOrder(tx, {
        placedAt: at(3),
        variant,
        phoneE164,
        status: "delivered",
      });
      await insertTestOrder(tx, { placedAt: at(4), variant, phoneE164: "+970591112244" });

      const result = await searchAdminOrders({ text: "059 111 2233" });
      expect(result.ok && result.data.kind === "rows" && result.data.rows).toMatchObject([
        { number: newer.orderNumber, status: "delivered" },
        { number: older.orderNumber, status: "new" },
      ]);
      expect(await searchAdminOrders({ text: "0591119999" })).toEqual({
        ok: true,
        data: { kind: "rows", rows: [] },
      });
    });
  });

  it("refuses a non admin and invalid text, and logs only the kind", async () => {
    await within(async () => {
      requireAdmin.mockResolvedValueOnce({ ok: false, error: "forbidden" });
      expect(await searchAdminOrders({ text: "0599123456" })).toEqual({
        ok: false,
        error: "forbidden",
      });
      expect(await searchAdminOrders({ text: "أحمد" })).toEqual({ ok: false, error: "invalid" });
      expect(await searchAdminOrders({ text: "1".repeat(41) })).toEqual({
        ok: false,
        error: "invalid",
      });
      await searchAdminOrders({ text: "0599123456" });
      expect(info.mock.calls).toEqual([
        [JSON.stringify({ event: "admin_order_search", kind: "invalid" })],
        [JSON.stringify({ event: "admin_order_search", kind: "phone" })],
      ]);
    });
  });
});
