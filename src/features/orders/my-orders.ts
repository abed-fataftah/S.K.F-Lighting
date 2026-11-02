// The My Orders list (spec 0018 AC-4, AC-5): how many orders a step shows, whether more exist, and
// the money line under each total. Pure.
import { paymentState } from "./payment-state";
import type { OrderStatus } from "./status";

export const MY_ORDERS_PAGE_SIZE = 20;
/** Past this page the load more link stops, so a huge `page` never builds a huge query (AC-5). */
export const MY_ORDERS_MAX_PAGE = 1000;

/** How many orders `?page=N` shows: every step up to N, held to the cap. */
export function myOrdersLimit(page: number): number {
  return Math.min(page, MY_ORDERS_MAX_PAGE) * MY_ORDERS_PAGE_SIZE;
}

/** Whether a load more link shows, and where it goes (ignored when `hasMore` is false). */
export function myOrdersStep(
  page: number,
  shown: number,
  total: number,
): { readonly hasMore: boolean; readonly nextPage: number; readonly nextPosition: number } {
  return {
    hasMore: shown < total && page < MY_ORDERS_MAX_PAGE,
    nextPage: page + 1,
    nextPosition: shown + 1,
  };
}

export type OrderMoneyLine =
  | { readonly kind: "none" }
  | { readonly kind: "remaining"; readonly amount: number }
  | { readonly kind: "paid" };

/** The line under a card's total (AC-4): nothing on a cancelled or unpaid order. */
export function orderMoneyLine(
  status: OrderStatus,
  amountPaid: number,
  total: number,
): OrderMoneyLine {
  if (status === "cancelled") return { kind: "none" };
  const state = paymentState(amountPaid, total);
  if (state === "partial") return { kind: "remaining", amount: total - amountPaid };
  return state === "paid" ? { kind: "paid" } : { kind: "none" };
}
