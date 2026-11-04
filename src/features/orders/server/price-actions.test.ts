import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-3, AC-4, AC-6, AC-11 (spec 0022). The transaction is a spy, so these tests prove what
// the action checks before it, and what it logs and refreshes after.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const adjustOrderPricesInDb = vi.fn();
vi.mock("./price-adjust", () => ({ adjustOrderPricesInDb }));

const { adjustOrderPrices } = await import("./price-actions");

const ORDER_ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const LINE_ID = "9b1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const info = vi.spyOn(console, "info").mockImplementation(() => {});

const valid = {
  orderId: ORDER_ID,
  expectedTotal: 25_000,
  note: "مشروع كبير",
  lines: [{ lineId: LINE_ID, expectedUnitPrice: 12_500, price: "١٠٠" }],
};

const logged = () => info.mock.calls.map(([line]) => JSON.parse(String(line)));

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin-1" } });
});

describe("adjustOrderPrices", () => {
  it("refuses a non admin before reading anything, and logs the code", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await adjustOrderPrices(valid)).toEqual({ ok: false, error: "forbidden" });
    expect(getDb).not.toHaveBeenCalled();
    expect(logged()).toEqual([
      { event: "order_prices_refused", orderId: ORDER_ID, error: "forbidden" },
    ]);
  });

  it("returns per line errors for a bad price, and plain invalid for a bad shape", async () => {
    expect(
      await adjustOrderPrices({ ...valid, lines: [{ ...valid.lines[0], price: "" }] }),
    ).toEqual({ ok: false, error: "invalid", lineErrors: { [LINE_ID]: "required" } });
    expect(await adjustOrderPrices({ ...valid, orderId: "x" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await adjustOrderPrices({ ...valid, lines: [] })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("passes the parsed input to the transaction, then refreshes and logs no note", async () => {
    adjustOrderPricesInDb.mockResolvedValue({
      ok: true,
      data: {
        number: "26-00042",
        subtotal: 20_000,
        total: 20_000,
        fromTotal: 25_000,
        lineCount: 1,
        lines: [{ lineId: LINE_ID, unitPrice: 10_000, lineTotal: 20_000 }],
      },
    });

    expect(await adjustOrderPrices(valid)).toEqual({
      ok: true,
      data: {
        subtotal: 20_000,
        total: 20_000,
        lines: [{ lineId: LINE_ID, unitPrice: 10_000, lineTotal: 20_000 }],
      },
    });
    expect(adjustOrderPricesInDb).toHaveBeenCalledWith({}, "admin-1", {
      ...valid,
      lines: [{ ...valid.lines[0], price: 10_000 }],
    });
    expect(revalidatePath.mock.calls.flat()).toEqual([
      "/admin/orders/26-00042",
      "/admin/orders",
      "/orders/26-00042",
    ]);
    expect(logged()).toEqual([
      {
        event: "order_prices_adjusted",
        orderId: ORDER_ID,
        lineCount: 1,
        fromTotal: 25_000,
        toTotal: 20_000,
      },
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("مشروع");
  });

  it("returns a refusal from the transaction as it is, refreshing nothing", async () => {
    adjustOrderPricesInDb.mockResolvedValue({ ok: false, error: "below_paid", paid: 30_000 });
    expect(await adjustOrderPrices(valid)).toEqual({
      ok: false,
      error: "below_paid",
      paid: 30_000,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(logged()).toEqual([
      { event: "order_prices_refused", orderId: ORDER_ID, error: "below_paid" },
    ]);
  });
});
