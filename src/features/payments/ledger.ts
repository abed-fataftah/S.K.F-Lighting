// The money rules of an order (spec 0023). Pure: the actions, the dashboard card, the orders list,
// and the tests all read them from here. Amounts are integer agorot; `amount_paid` is the running
// sum of the ledger, kept between 0 and the order total.
import type { OrderPaymentFilter } from "@/features/orders/admin-filters";
import { paymentState } from "@/features/orders/payment-state";
import type { OrderStatus } from "@/features/orders/status";

export const PAYMENT_KINDS = ["payment", "refund", "reversal"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/** Cash or cheque: how money changed hands. Never a list filter (that `method` is pickup or delivery). */
export const PAYMENT_METHODS = ["cash", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A row the owner records with the form: money in, or money paid back on a cancelled order. */
export type RecordKind = Exclude<PaymentKind, "reversal">;

export type LedgerEntry =
  | { readonly kind: RecordKind; readonly amount: number }
  | { readonly kind: "reversal"; readonly amount: number; readonly reversedKind: RecordKind };

/**
 * `amount_paid` after one entry: a payment adds, a refund subtracts, a reversal undoes the row it
 * points at. Below 0 is a bug (the actions refuse first), so it throws.
 */
export function applyEntry(amountPaid: number, entry: LedgerEntry): number {
  const direction = entry.kind === "reversal" ? entry.reversedKind : entry.kind;
  const sign = (direction === "payment" ? 1 : -1) * (entry.kind === "reversal" ? -1 : 1);
  const next = amountPaid + sign * entry.amount;
  if (next < 0) throw new RangeError(`amount_paid would be ${next}`);
  return next;
}

export type LedgerRow = {
  readonly id: string;
  readonly kind: PaymentKind;
  readonly amount: number;
  readonly reversesPaymentId: string | null;
};

/** What the rows of one order add up to: the value `orders.amount_paid` must hold (AC-14). */
export function netPaid(rows: readonly LedgerRow[]): number {
  const kinds = new Map(rows.map((row) => [row.id, row.kind]));
  return rows.reduce((sum, row) => {
    if (row.kind !== "reversal") return sum + (row.kind === "payment" ? row.amount : -row.amount);
    const reversed = row.reversesPaymentId ? kinds.get(row.reversesPaymentId) : undefined;
    if (!reversed || reversed === "reversal") {
      throw new Error(`reversal ${row.id} points at no payment or refund of this order`);
    }
    return sum + (reversed === "payment" ? -row.amount : row.amount);
  }, 0);
}

export type PaymentFormMode = "payment" | "settled" | "refund";

/**
 * What sits under the card's summary (AC-2): the payment form while money is owed, a settled line
 * once paid in full, the refund form on a cancelled order holding money, else nothing.
 */
export function paymentFormMode(
  status: OrderStatus,
  total: number,
  amountPaid: number,
): PaymentFormMode | null {
  if (status === "cancelled") return amountPaid > 0 ? "refund" : null;
  if (total === 0 && amountPaid === 0) return null;
  return amountPaid < total ? "payment" : "settled";
}

/** The most one entry may move (AC-3): what remains for a payment, what was paid for a refund. */
export function paymentLimit(kind: RecordKind, total: number, amountPaid: number): number {
  return kind === "payment" ? total - amountPaid : amountPaid;
}

type OrderPayment = OrderPaymentFilter;

const BADGE_VARIANTS = { none: "off", partial: "proc", paid: "ok", refund_due: "new" } as const;

export type OrderPaymentBadge = {
  readonly state: OrderPayment;
  readonly variant: (typeof BADGE_VARIANTS)[OrderPayment];
};

/** The orders list's الدفع badge (AC-11). A cancelled order shows one only while money is owed back; a total of 0 is unpaid. */
export function orderPaymentBadge(
  status: OrderStatus,
  amountPaid: number,
  total: number,
): OrderPaymentBadge | null {
  const state: OrderPayment | null =
    status === "cancelled"
      ? amountPaid > 0
        ? "refund_due"
        : null
      : paymentState(amountPaid, total);
  return state ? { state, variant: BADGE_VARIANTS[state] } : null;
}

export type SummaryRow = {
  readonly key: "total" | "paid" | "remaining" | "owedBack";
  readonly amount: number;
};

/** The summary under the card's list (AC-1): المتبقي on a live order, مستحق للعميل on a cancelled one. */
export function paymentSummaryRows(
  status: OrderStatus,
  total: number,
  amountPaid: number,
): readonly SummaryRow[] {
  const base: readonly SummaryRow[] = [
    { key: "total", amount: total },
    { key: "paid", amount: amountPaid },
  ];
  if (status !== "cancelled") return [...base, { key: "remaining", amount: total - amountPaid }];
  return amountPaid > 0 ? [...base, { key: "owedBack", amount: amountPaid }] : base;
}

export type PaymentRow = LedgerRow & {
  readonly method: PaymentMethod;
  /** `YYYY-MM-DD` on the shop's calendar. */
  readonly receivedOn: string;
  readonly chequeNumber: string | null;
  readonly chequeBank: string | null;
  readonly chequeDueDate: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
};

export type PaymentRowView = PaymentRow & {
  readonly kind: RecordKind;
  readonly reversal: { readonly receivedOn: string; readonly reason: string } | null;
};

// Day keys sort as plain text; `localeCompare` would bring the locale in.
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const oldestFirst = (a: PaymentRow, b: PaymentRow) =>
  byKey(a.receivedOn, b.receivedOn) || a.createdAt.getTime() - b.createdAt.getTime();

/**
 * The card's list (AC-1): payments and refunds oldest first, each carrying its reversal (day and
 * reason) if it has one. A reversal is never listed on its own.
 */
export function paymentRowsView(rows: readonly PaymentRow[]): readonly PaymentRowView[] {
  const reversals = new Map(
    rows.flatMap((row) =>
      row.kind === "reversal" && row.reversesPaymentId
        ? [[row.reversesPaymentId, { receivedOn: row.receivedOn, reason: row.note ?? "" }] as const]
        : [],
    ),
  );
  return rows
    .filter((row): row is PaymentRow & { readonly kind: RecordKind } => row.kind !== "reversal")
    .toSorted(oldestFirst)
    .map((row) => ({ ...row, reversal: reversals.get(row.id) ?? null }));
}
