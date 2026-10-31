import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-4, AC-10 (spec 0016); AC-15 (spec 0017). The cookies, the session, the owner check,
// and the database write are replaced by stand ins,
// so these tests prove what the action checks before the write, and what it logs after.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const readPlacedIds = vi.fn(async (): Promise<readonly string[]> => []);
vi.mock("@/features/checkout/server/placed", () => ({ readPlacedIds }));
const readTrackedIds = vi.fn(async (): Promise<readonly string[]> => []);
vi.mock("./tracked", () => ({ readTrackedIds }));

const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const cancelOrderByCustomerInDb = vi.fn();
vi.mock("./admin-status", () => ({ cancelOrderByCustomerInDb }));

const getClaims = vi.fn(async (): Promise<{ sub?: string } | null> => null);
vi.mock("@/server/auth/session", () => ({ getClaims }));
const isOwnedOrder = vi.fn(async () => false);
vi.mock("./customer-order", () => ({ isOwnedOrder }));

const { cancelOrderByCustomer } = await import("./customer-actions");

const ORDER_ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const OTHER_ID = "1b2c3d4e-5f60-4a71-8b2c-3d4e5f607182";
const USER_ID = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const REASON = "وجدت أرخص";
const info = vi.spyOn(console, "info").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  readPlacedIds.mockResolvedValue([]);
  readTrackedIds.mockResolvedValue([]);
  getClaims.mockResolvedValue(null);
  isOwnedOrder.mockResolvedValue(false);
  cancelOrderByCustomerInDb.mockResolvedValue({
    ok: true,
    data: { status: "cancelled", number: "26-00042" },
  });
});

describe("who may cancel", () => {
  it("gives not_found for an id in neither cookie, with no database call", async () => {
    readPlacedIds.mockResolvedValue([OTHER_ID]);
    readTrackedIds.mockResolvedValue([OTHER_ID]);
    expect(await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(getDb).not.toHaveBeenCalled();
    expect(cancelOrderByCustomerInDb).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("reaches the write for an id in skf_placed", async () => {
    readPlacedIds.mockResolvedValue([ORDER_ID]);
    expect((await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new" })).ok).toBe(true);
    expect(cancelOrderByCustomerInDb).toHaveBeenCalledWith(
      {},
      { orderId: ORDER_ID, from: "new", reason: null },
    );
  });

  it("reaches the write for the signed in account that placed the order, with no cookie", async () => {
    getClaims.mockResolvedValue({ sub: USER_ID });
    isOwnedOrder.mockResolvedValue(true);
    expect((await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new" })).ok).toBe(true);
    expect(isOwnedOrder).toHaveBeenCalledWith({}, ORDER_ID, USER_ID);
    expect(cancelOrderByCustomerInDb).toHaveBeenCalledWith(
      {},
      { orderId: ORDER_ID, from: "new", reason: null },
    );
  });

  it("gives not_found to another signed in account", async () => {
    getClaims.mockResolvedValue({ sub: USER_ID });
    expect(await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(cancelOrderByCustomerInDb).not.toHaveBeenCalled();
  });

  it("skips the owner check when a cookie already holds the id", async () => {
    getClaims.mockResolvedValue({ sub: USER_ID });
    readPlacedIds.mockResolvedValue([ORDER_ID]);
    expect((await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new" })).ok).toBe(true);
    expect(isOwnedOrder).not.toHaveBeenCalled();
  });

  it("reaches the write for an id in skf_tracked, typed in upper case", async () => {
    readTrackedIds.mockResolvedValue([ORDER_ID]);
    expect(
      (await cancelOrderByCustomer({ orderId: ORDER_ID.toUpperCase(), from: "ready" })).ok,
    ).toBe(true);
    expect(cancelOrderByCustomerInDb.mock.calls[0][1]).toMatchObject({ orderId: ORDER_ID });
  });
});

describe("input is checked before anything else", () => {
  it("refuses a bad id, an unknown status, and a long reason", async () => {
    readPlacedIds.mockResolvedValue([ORDER_ID]);
    const invalid = { ok: false, error: "invalid" };
    expect(await cancelOrderByCustomer({ orderId: "x", from: "new" })).toEqual(invalid);
    expect(await cancelOrderByCustomer({ orderId: ORDER_ID, from: "shipped" })).toEqual(invalid);
    expect(
      await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new", reason: "س".repeat(301) }),
    ).toEqual(invalid);
    expect(await cancelOrderByCustomer(null)).toEqual(invalid);
    expect(readPlacedIds).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("after the write", () => {
  it("refreshes the order page and logs the event, id, and from only, never the reason", async () => {
    readPlacedIds.mockResolvedValue([ORDER_ID]);
    expect(
      await cancelOrderByCustomer({ orderId: ORDER_ID, from: "preparing", reason: ` ${REASON} ` }),
    ).toEqual({ ok: true, data: { status: "cancelled" } });
    expect(cancelOrderByCustomerInDb).toHaveBeenCalledWith(
      {},
      { orderId: ORDER_ID, from: "preparing", reason: REASON },
    );
    expect(revalidatePath.mock.calls).toEqual([["/orders/26-00042"]]);
    expect(info.mock.calls).toEqual([
      [
        JSON.stringify({
          event: "order_cancelled_by_customer",
          orderId: ORDER_ID,
          from: "preparing",
        }),
      ],
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain(REASON);
  });

  it("returns a refused write as is, with no refresh and no log", async () => {
    readTrackedIds.mockResolvedValue([ORDER_ID]);
    for (const error of ["stale", "not_allowed", "not_found"] as const) {
      cancelOrderByCustomerInDb.mockResolvedValueOnce({ ok: false, error });
      expect(await cancelOrderByCustomer({ orderId: ORDER_ID, from: "new" })).toEqual({
        ok: false,
        error,
      });
    }
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
