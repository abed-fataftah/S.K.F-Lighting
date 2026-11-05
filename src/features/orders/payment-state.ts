// What the customer's order page says about payment (spec 0015 AC-11), from the payments the owner
// recorded. Pure, from the saved `amount_paid` and `total` only.

export type PaymentState = "none" | "partial" | "paid";

export function paymentState(amountPaid: number, total: number): PaymentState {
  if (amountPaid <= 0) return "none";
  return amountPaid >= total ? "paid" : "partial";
}

const BADGES = { none: "off", partial: "proc", paid: "ok" } as const;

/** The `Badge` variant that shows a payment state. */
export function paymentBadgeVariant(state: PaymentState): (typeof BADGES)[PaymentState] {
  return BADGES[state];
}

export type CustomerPaymentRow = {
  readonly key: "paidAmount" | "remainingAmount" | "refundDue";
  readonly amount: number;
};

/**
 * The amounts under the badge (spec 0023 AC-12): المدفوع and, while above 0, المتبقي on a live order;
 * on a cancelled one the money owed back. Nothing until something is paid.
 */
export function customerPaymentRows(
  cancelled: boolean,
  amountPaid: number,
  total: number,
): readonly CustomerPaymentRow[] {
  if (amountPaid <= 0) return [];
  if (cancelled) return [{ key: "refundDue", amount: amountPaid }];
  const remaining = total - amountPaid;
  return [
    { key: "paidAmount", amount: amountPaid },
    ...(remaining > 0 ? [{ key: "remainingAmount" as const, amount: remaining }] : []),
  ];
}
