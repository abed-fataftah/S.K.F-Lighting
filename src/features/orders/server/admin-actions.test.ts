import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-3, AC-4, AC-17 (spec 0014). The database writes are replaced by spies, so these
// tests prove what each action checks before them, and what it logs and refreshes after.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const changeOrderStatusInDb = vi.fn();
const cancelOrderInDb = vi.fn();
vi.mock("./admin-status", () => ({ changeOrderStatusInDb, cancelOrderInDb }));

const { cancelOrderByAdmin, changeOrderStatus } = await import("./admin-actions");

const ORDER_ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const info = vi.spyOn(console, "info").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin-1" } });
});

describe("every order action is admin only", () => {
  it("refuses a non admin and reads or writes nothing", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    const forbidden = { ok: false, error: "forbidden" };

    expect(await changeOrderStatus({ orderId: ORDER_ID, from: "new", to: "ready" })).toEqual(
      forbidden,
    );
    expect(await cancelOrderByAdmin({ orderId: ORDER_ID, from: "new" })).toEqual(forbidden);
    expect(getDb).not.toHaveBeenCalled();
  });
});

describe("input is checked before the database", () => {
  it("refuses a bad id, an unknown status, confirmed as a target, and a long reason", async () => {
    const invalid = { ok: false, error: "invalid" };
    expect(await changeOrderStatus({ orderId: "x", from: "new", to: "ready" })).toEqual(invalid);
    expect(await changeOrderStatus({ orderId: ORDER_ID, from: "new", to: "shipped" })).toEqual(
      invalid,
    );
    expect(await changeOrderStatus({ orderId: ORDER_ID, from: "new", to: "confirmed" })).toEqual(
      invalid,
    );
    expect(
      await cancelOrderByAdmin({ orderId: ORDER_ID, from: "new", reason: "س".repeat(301) }),
    ).toEqual(invalid);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("accepts confirmed as the from status", async () => {
    changeOrderStatusInDb.mockResolvedValue({ ok: false, error: "stale" });
    expect(
      await changeOrderStatus({ orderId: ORDER_ID, from: "confirmed", to: "preparing" }),
    ).toEqual({ ok: false, error: "stale" });
  });
});

describe("after the write", () => {
  it("refreshes the list and the order, and logs ids and statuses only", async () => {
    changeOrderStatusInDb.mockResolvedValue({
      ok: true,
      data: { status: "ready", number: "26-00042" },
    });
    expect(await changeOrderStatus({ orderId: ORDER_ID, from: "new", to: "ready" })).toEqual({
      ok: true,
      data: { status: "ready" },
    });
    expect(changeOrderStatusInDb).toHaveBeenCalledWith({}, "admin-1", {
      orderId: ORDER_ID,
      from: "new",
      to: "ready",
    });
    expect(revalidatePath.mock.calls).toEqual([["/admin/orders"], ["/admin/orders/26-00042"]]);
    expect(info).toHaveBeenCalledWith(
      JSON.stringify({
        event: "order_status_changed",
        orderId: ORDER_ID,
        from: "new",
        to: "ready",
      }),
    );
  });

  it("passes the tidied reason to the write but never logs it", async () => {
    cancelOrderInDb.mockResolvedValue({
      ok: true,
      data: { status: "cancelled", number: "26-00042" },
    });
    expect(
      await cancelOrderByAdmin({ orderId: ORDER_ID, from: "ready", reason: "  غيّر رأيه " }),
    ).toEqual({ ok: true, data: { status: "cancelled" } });
    expect(cancelOrderInDb).toHaveBeenCalledWith({}, "admin-1", {
      orderId: ORDER_ID,
      from: "ready",
      reason: "غيّر رأيه",
    });
    expect(info.mock.calls).toEqual([
      [JSON.stringify({ event: "order_cancelled", orderId: ORDER_ID, from: "ready" })],
    ]);
  });

  it("returns a refused write as is, with no refresh and no log", async () => {
    cancelOrderInDb.mockResolvedValue({ ok: false, error: "not_allowed" });
    expect(await cancelOrderByAdmin({ orderId: ORDER_ID, from: "delivered" })).toEqual({
      ok: false,
      error: "not_allowed",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
