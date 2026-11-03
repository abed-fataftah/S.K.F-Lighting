// The rules behind the customer page (spec 0019 AC-5, AC-10, AC-11, AC-13). Pure.
import type { ProfileInput } from "@/features/accounts/schemas";
import type { OrderStatus } from "@/features/orders/status";
import type { AssignableRole } from "./roles";

export type DetailField = "full_name" | "phone";

/**
 * The fields an edit changes (AC-10): the name when the parsed name differs, the phone when the
 * typed phone or its E.164 form differs. Empty means nothing to write.
 */
export function changedFields(
  current: {
    readonly fullName: string | null;
    readonly phone: string | null;
    readonly phoneE164: string | null;
  },
  input: ProfileInput,
): readonly DetailField[] {
  const fields: DetailField[] = [];
  if (input.name !== current.fullName) fields.push("full_name");
  if (input.phone.typed !== current.phone || input.phone.e164 !== current.phoneE164) {
    fields.push("phone");
  }
  return fields;
}

export type MoneyOrder = {
  readonly status: OrderStatus;
  readonly total: number;
  readonly amountPaid: number;
};

const isOwing = (order: MoneyOrder) =>
  order.status === "delivered" && order.amountPaid < order.total;

/** Why an account cannot be removed yet (AC-11), open orders first; null when it can. */
export function removalBlock(
  orders: readonly MoneyOrder[],
): "has_open_orders" | "has_balance" | null {
  if (orders.some((order) => order.status !== "delivered" && order.status !== "cancelled")) {
    return "has_open_orders";
  }
  return orders.some(isOwing) ? "has_balance" : null;
}

export type CustomerTotals = {
  /** Orders that are not cancelled. */
  readonly orderCount: number;
  /** `total` over delivered orders, delivery fee included. */
  readonly spent: number;
  /** What delivered orders still owe; an order not delivered yet owes nothing. */
  readonly owed: number;
};

/** The totals strip (AC-5); the SQL sums in `readCustomerTotals` must agree with this. */
export function customerTotals(orders: readonly MoneyOrder[]): CustomerTotals {
  return orders.reduce<CustomerTotals>(
    (totals, order) => ({
      orderCount: totals.orderCount + (order.status === "cancelled" ? 0 : 1),
      spent: totals.spent + (order.status === "delivered" ? order.total : 0),
      owed: totals.owed + (isOwing(order) ? order.total - order.amountPaid : 0),
    }),
    { orderCount: 0, spent: 0, owed: 0 },
  );
}

export type AccountEventView =
  | {
      readonly type: "role_changed";
      readonly fromRole: AssignableRole;
      readonly toRole: AssignableRole;
    }
  | { readonly type: "details_edited"; readonly fields: readonly DetailField[] }
  | { readonly type: "removed" };

export type HistoryLine =
  | {
      readonly key: "historyRoleChanged";
      readonly from: AssignableRole;
      readonly to: AssignableRole;
    }
  | { readonly key: "historyDetailsEdited"; readonly fields: DetailField | "both" }
  | { readonly key: "historyRemoved" };

/** One line of "سجل الحساب" (AC-13): the message key and what fills it. */
export function historyLine(event: AccountEventView): HistoryLine {
  switch (event.type) {
    case "role_changed":
      return { key: "historyRoleChanged", from: event.fromRole, to: event.toRole };
    case "details_edited":
      return {
        key: "historyDetailsEdited",
        fields: event.fields.length > 1 ? "both" : (event.fields[0] ?? "full_name"),
      };
    case "removed":
      return { key: "historyRemoved" };
  }
}
