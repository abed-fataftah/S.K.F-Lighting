import { describe, expect, it } from "vitest";
import {
  applyEntry,
  netPaid,
  orderPaymentBadge,
  paymentFormMode,
  paymentLimit,
  paymentRowsView,
  paymentSummaryRows,
  type PaymentRow,
} from "./ledger";

// covers: AC-4, AC-6, AC-14 (spec 0023)
describe("applyEntry", () => {
  it("adds a payment, subtracts a refund, and undoes each with a reversal", () => {
    expect(applyEntry(0, { kind: "payment", amount: 10_000 })).toBe(10_000);
    expect(applyEntry(10_000, { kind: "refund", amount: 4_000 })).toBe(6_000);
    expect(applyEntry(10_000, { kind: "reversal", amount: 4_000, reversedKind: "payment" })).toBe(
      6_000,
    );
    expect(applyEntry(6_000, { kind: "reversal", amount: 4_000, reversedKind: "refund" })).toBe(
      10_000,
    );
  });

  it("throws below 0, a bug the actions refuse first", () => {
    expect(() => applyEntry(1_000, { kind: "refund", amount: 1_001 })).toThrow(RangeError);
    expect(() => applyEntry(0, { kind: "reversal", amount: 1, reversedKind: "payment" })).toThrow(
      RangeError,
    );
  });
});

const row = (
  id: string,
  kind: PaymentRow["kind"],
  amount: number,
  reversesPaymentId: string | null = null,
) => ({ id, kind, amount, reversesPaymentId });

// covers: AC-14 (spec 0023)
describe("netPaid", () => {
  it("is 0 with no rows", () => {
    expect(netPaid([])).toBe(0);
  });

  it("sums a mixed run the same way applyEntry steps through it", () => {
    const rows = [
      row("a", "payment", 10_000),
      row("b", "payment", 15_000),
      row("c", "reversal", 15_000, "b"),
      row("d", "refund", 3_000),
      row("e", "reversal", 3_000, "d"),
      row("f", "refund", 2_000),
    ];
    expect(netPaid(rows)).toBe(8_000);
  });

  it("throws on a reversal that points nowhere or at a reversal", () => {
    expect(() => netPaid([row("a", "reversal", 1, "x")])).toThrow();
    expect(() =>
      netPaid([row("a", "payment", 5), row("b", "reversal", 5, "a"), row("c", "reversal", 5, "b")]),
    ).toThrow();
  });
});

// covers: AC-2 (spec 0023)
describe("paymentFormMode", () => {
  it.each([
    ["new", 25_000, 0, "payment"],
    ["preparing", 25_000, 10_000, "payment"],
    ["ready", 25_000, 24_999, "payment"],
    ["out_for_delivery", 25_000, 0, "payment"],
    ["delivered", 25_000, 10_000, "payment"],
    ["confirmed", 25_000, 0, "payment"],
    ["delivered", 25_000, 25_000, "settled"],
    ["new", 25_000, 25_000, "settled"],
    ["new", 0, 0, null],
    ["cancelled", 25_000, 10_000, "refund"],
    ["cancelled", 25_000, 0, null],
    ["cancelled", 0, 0, null],
  ] as const)("%s with total %i and %i paid is %s", (status, total, paid, mode) => {
    expect(paymentFormMode(status, total, paid)).toBe(mode);
  });
});

// covers: AC-3, AC-5 (spec 0023)
describe("paymentLimit", () => {
  it("is what remains for a payment and what was paid for a refund", () => {
    expect(paymentLimit("payment", 25_000, 10_000)).toBe(15_000);
    expect(paymentLimit("refund", 25_000, 10_000)).toBe(10_000);
  });
});

// covers: AC-11 (spec 0023)
describe("orderPaymentBadge", () => {
  it.each([
    ["new", 0, 25_000, { state: "none", variant: "off" }],
    ["new", 0, 0, { state: "none", variant: "off" }],
    ["preparing", 1, 25_000, { state: "partial", variant: "proc" }],
    ["delivered", 25_000, 25_000, { state: "paid", variant: "ok" }],
    ["cancelled", 10_000, 25_000, { state: "refund_due", variant: "new" }],
    ["cancelled", 0, 25_000, null],
  ] as const)("%s with %i paid of %i", (status, paid, total, badge) => {
    expect(orderPaymentBadge(status, paid, total)).toEqual(badge);
  });
});

// covers: AC-1 (spec 0023)
describe("paymentSummaryRows", () => {
  it("shows المتبقي on a live order, settled included", () => {
    expect(paymentSummaryRows("new", 25_000, 10_000)).toEqual([
      { key: "total", amount: 25_000 },
      { key: "paid", amount: 10_000 },
      { key: "remaining", amount: 15_000 },
    ]);
    expect(paymentSummaryRows("delivered", 25_000, 25_000).at(-1)).toEqual({
      key: "remaining",
      amount: 0,
    });
  });

  it("shows مستحق للعميل instead on a cancelled order holding money, and neither without", () => {
    expect(paymentSummaryRows("cancelled", 25_000, 10_000)).toEqual([
      { key: "total", amount: 25_000 },
      { key: "paid", amount: 10_000 },
      { key: "owedBack", amount: 10_000 },
    ]);
    expect(paymentSummaryRows("cancelled", 25_000, 0)).toEqual([
      { key: "total", amount: 25_000 },
      { key: "paid", amount: 0 },
    ]);
  });
});

const ledgerRow = (
  id: string,
  kind: PaymentRow["kind"],
  receivedOn: string,
  createdAt: string,
  extra: Partial<PaymentRow> = {},
): PaymentRow => ({
  id,
  kind,
  amount: 5_000,
  reversesPaymentId: null,
  method: "cash",
  receivedOn,
  chequeNumber: null,
  chequeBank: null,
  chequeDueDate: null,
  note: null,
  createdAt: new Date(createdAt),
  ...extra,
});

// covers: AC-1, AC-6 (spec 0023)
describe("paymentRowsView", () => {
  it("lists payments and refunds oldest first by day then entry time, never a reversal", () => {
    const view = paymentRowsView([
      ledgerRow("late", "payment", "2026-11-04", "2026-11-04T08:00:00Z"),
      ledgerRow("second", "payment", "2026-11-02", "2026-11-05T09:00:00Z"),
      ledgerRow("first", "refund", "2026-11-02", "2026-11-05T08:00:00Z"),
    ]);
    expect(view.map((entry) => entry.id)).toEqual(["first", "second", "late"]);
    expect(view.every((entry) => entry.reversal === null)).toBe(true);
  });

  it("pairs a reversal with the row it reverses, carrying its day and reason", () => {
    const view = paymentRowsView([
      ledgerRow("pay", "payment", "2026-11-02", "2026-11-02T08:00:00Z"),
      ledgerRow("rev", "reversal", "2026-11-05", "2026-11-05T08:00:00Z", {
        reversesPaymentId: "pay",
        note: "شيك مرتجع",
      }),
    ]);
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({
      id: "pay",
      reversal: { receivedOn: "2026-11-05", reason: "شيك مرتجع" },
    });
  });
});
