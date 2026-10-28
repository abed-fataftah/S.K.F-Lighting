// The customer's own cancel (spec 0016 AC-1, AC-6, AC-7). Pure: the order page picks its cancel UI
// from here, and the customer cancel write checks the same rule inside its row lock.
import type { ActorKind, OrderStatus } from "./status";

export type CustomerCancelState = "allowed" | "shipped" | "paid" | "final";

/**
 * Whether the customer may cancel, checked in this order: final, then shipped, then paid. A pickup
 * order at `out_for_delivery` is shipped too, and shipped wins over paid.
 */
export function customerCancelState(status: OrderStatus, amountPaid: number): CustomerCancelState {
  if (status === "delivered" || status === "cancelled") return "final";
  if (status === "out_for_delivery") return "shipped";
  if (amountPaid > 0) return "paid";
  return "allowed";
}

/** "ألغيت هذا الطلب" for anyone on the customer side, "ألغى المتجر" for the shop or no one known. */
export function cancelledLine(cancelledBy: ActorKind | null): "byYou" | "byShop" {
  return cancelledBy === "guest" || cancelledBy === "customer" || cancelledBy === "electrician"
    ? "byYou"
    : "byShop";
}

export type CustomerCancelError = "invalid" | "not_found" | "stale" | "not_allowed";

/** The dialog's message for a refused cancel: the order changed, or the cancel failed (AC-6). */
export function cancelProblem(error: CustomerCancelError): "cancelChanged" | "cancelFailed" {
  return error === "stale" || error === "not_allowed" ? "cancelChanged" : "cancelFailed";
}
