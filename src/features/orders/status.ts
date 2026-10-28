// The order status rules (spec 0014 AC-1, AC-2). Pure: the dashboard actions, the status card,
// and later the customer's order page (features 16 and 17) all read the moves from here.

/** Every value of the `order_status` enum, in path order. `confirmed` is never written. */
export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A status an action may write: every value but `confirmed` (AC-1). */
export type WritableStatus = Exclude<OrderStatus, "confirmed">;

/** The six statuses the dashboard offers, in path order (the chips, AC-9). */
export const ORDER_STATUSES_SHOWN = [
  "new",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const satisfies readonly WritableStatus[];

export type Fulfilment = "pickup" | "delivery";

/** Each fulfilment's steps in order: the dashboard moves and the customer timeline (spec 0015 AC-9). */
export const PATHS: Readonly<Record<Fulfilment, readonly WritableStatus[]>> = {
  pickup: ["new", "preparing", "ready", "delivered"],
  delivery: ["new", "preparing", "ready", "out_for_delivery", "delivered"],
};

export type OrderMoves = {
  /** The following step on the path: the primary button. */
  readonly next: WritableStatus | null;
  /** Every step after `next` (skips). */
  readonly forward: readonly WritableStatus[];
  /** The previous step on the path, whatever the order came from. */
  readonly back: WritableStatus | null;
  readonly canCancel: boolean;
};

const NO_MOVES: OrderMoves = { next: null, forward: [], back: null, canCancel: false };

/** What the owner may do with an order at `status`; `confirmed` counts as `new`. */
export function orderMoves(fulfilment: Fulfilment, status: OrderStatus): OrderMoves {
  if (status === "delivered" || status === "cancelled") return NO_MOVES;
  const path = PATHS[fulfilment];
  const at = path.indexOf(status === "confirmed" ? "new" : status);
  // A status off this path (a pickup order at out_for_delivery) has no steps, only cancel.
  if (at < 0) return { ...NO_MOVES, canCancel: true };
  return {
    next: path[at + 1] ?? null,
    forward: path.slice(at + 2),
    back: at > 0 ? path[at - 1] : null,
    canCancel: true,
  };
}

/** True only for `next`, a skip ahead, or one step back. Cancelling never passes through here. */
export function isAllowedMove(fulfilment: Fulfilment, from: OrderStatus, to: OrderStatus): boolean {
  const moves = orderMoves(fulfilment, from);
  return to === moves.next || to === moves.back || moves.forward.some((step) => step === to);
}

export type StatusBadgeVariant = "new" | "proc" | "ok" | "off";

const BADGES: Readonly<Record<OrderStatus, StatusBadgeVariant>> = {
  new: "new",
  confirmed: "new",
  preparing: "proc",
  ready: "proc",
  out_for_delivery: "proc",
  delivered: "ok",
  cancelled: "off",
};

/** The `Badge` variant that shows `status` (AC-1). */
export function statusBadgeVariant(status: OrderStatus): StatusBadgeVariant {
  return BADGES[status];
}
