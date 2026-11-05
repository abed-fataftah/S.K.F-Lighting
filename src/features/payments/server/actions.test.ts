import { beforeEach, describe, expect, it, vi } from "vitest";

// covers: AC-4, AC-6, AC-7, AC-15 (spec 0023). The transactions are spies, so these tests prove
// what each action checks before them, and what it logs and refreshes after.

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));

const requireAdmin = vi.fn();
vi.mock("@/server/auth/admin", () => ({ requireAdmin }));

const getDb = vi.fn(async () => ({}));
vi.mock("@/server/db", () => ({ getDb }));

const recordPaymentInDb = vi.fn();
const reversePaymentInDb = vi.fn();
vi.mock("./record", () => ({ recordPaymentInDb, reversePaymentInDb }));

const { recordPayment, reversePayment } = await import("./actions");
const { shopDateKey } = await import("@/lib/format");

const ORDER_ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const PAYMENT_ID = "9b1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const REVERSAL_ID = "ab1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
const info = vi.spyOn(console, "info").mockImplementation(() => {});

const payment = {
  paymentId: PAYMENT_ID,
  orderId: ORDER_ID,
  kind: "payment",
  expectedAmountPaid: 0,
  amount: "١٠٠",
  method: "cheque",
  chequeNumber: "445566",
  chequeBank: "بنك فلسطين",
  chequeDueDate: "2026-12-01",
  receivedOn: "2026-11-01",
  note: "سرّي",
};

const reversal = {
  reversalId: REVERSAL_ID,
  orderId: ORDER_ID,
  paymentId: PAYMENT_ID,
  expectedAmountPaid: 10_000,
  reason: "شيك مرتجع",
};

const written = {
  amountPaid: 10_000,
  duplicate: false,
  number: "26-00042",
  kind: "payment",
  method: "cheque",
  amount: 10_000,
  fromPaid: 0,
};

const logged = () => info.mock.calls.map(([line]) => JSON.parse(String(line)));

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ ok: true, data: { userId: "admin-1" } });
});

describe("recordPayment", () => {
  it("refuses a non admin before reading anything, and logs the code", async () => {
    requireAdmin.mockResolvedValue({ ok: false, error: "forbidden" });
    expect(await recordPayment(payment)).toEqual({ ok: false, error: "forbidden" });
    expect(getDb).not.toHaveBeenCalled();
    expect(logged()).toEqual([{ event: "payment_refused", orderId: ORDER_ID, error: "forbidden" }]);
  });

  it("returns field errors for bad fields and none for a bad shape, before the database", async () => {
    expect(await recordPayment({ ...payment, amount: "0", chequeBank: " " })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { amount: "amount_invalid", chequeBank: "required" },
    });
    expect(await recordPayment({ ...payment, receivedOn: "2999-01-01" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { receivedOn: "date_future" },
    });
    expect(await recordPayment({ ...payment, orderId: "x" })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: {},
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("passes the parsed input and the shop's today, then refreshes and logs no private detail", async () => {
    recordPaymentInDb.mockResolvedValue({ ok: true, data: written });
    expect(await recordPayment(payment)).toEqual({
      ok: true,
      data: { amountPaid: 10_000, duplicate: false },
    });
    const [, adminId, parsed, today] = recordPaymentInDb.mock.calls[0];
    expect(adminId).toBe("admin-1");
    expect(today).toBe(shopDateKey(new Date()));
    expect(parsed).toMatchObject({
      amount: 10_000,
      cheque: { number: "445566", bank: "بنك فلسطين", dueDate: "2026-12-01" },
    });
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/admin/orders/26-00042",
      "/admin/orders",
      "/orders/26-00042",
      "/account/orders",
    ]);
    expect(logged()).toEqual([
      {
        event: "payment_recorded",
        orderId: ORDER_ID,
        kind: "payment",
        method: "cheque",
        amount: 10_000,
        fromPaid: 0,
        toPaid: 10_000,
        duplicate: false,
      },
    ]);
    const lines = JSON.stringify(info.mock.calls);
    for (const secret of ["سرّي", "445566", "بنك فلسطين"]) expect(lines).not.toContain(secret);
  });

  it("returns a refusal as it came, logging only its code", async () => {
    recordPaymentInDb.mockResolvedValue({ ok: false, error: "too_much", limit: 15_000 });
    expect(await recordPayment(payment)).toEqual({ ok: false, error: "too_much", limit: 15_000 });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(logged()).toEqual([{ event: "payment_refused", orderId: ORDER_ID, error: "too_much" }]);
  });
});

describe("reversePayment", () => {
  it("refuses a non admin and an empty reason before the database", async () => {
    requireAdmin.mockResolvedValueOnce({ ok: false, error: "forbidden" });
    expect(await reversePayment(reversal)).toEqual({ ok: false, error: "forbidden" });
    expect(await reversePayment({ ...reversal, reason: "  " })).toEqual({
      ok: false,
      error: "invalid",
      fieldErrors: { reason: "required" },
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("reverses, refreshes, and logs the reversal without its reason", async () => {
    reversePaymentInDb.mockResolvedValue({
      ok: true,
      data: { ...written, kind: "reversal", amountPaid: 0, fromPaid: 10_000 },
    });
    expect(await reversePayment(reversal)).toEqual({
      ok: true,
      data: { amountPaid: 0, duplicate: false },
    });
    expect(reversePaymentInDb.mock.calls[0][2]).toEqual(reversal);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/orders/26-00042");
    expect(logged()).toEqual([
      expect.objectContaining({ event: "payment_recorded", kind: "reversal", toPaid: 0 }),
    ]);
    expect(JSON.stringify(info.mock.calls)).not.toContain("شيك مرتجع");
  });

  it("returns already_reversed as it came", async () => {
    reversePaymentInDb.mockResolvedValue({ ok: false, error: "already_reversed" });
    expect(await reversePayment(reversal)).toEqual({ ok: false, error: "already_reversed" });
    expect(logged()).toEqual([
      { event: "payment_refused", orderId: ORDER_ID, error: "already_reversed" },
    ]);
  });
});
