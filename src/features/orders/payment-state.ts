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
