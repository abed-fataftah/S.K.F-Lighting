// The orders list filters (spec 0014 AC-9 to AC-12). Pure: every filter lives in the address,
// read here and written back in one fixed order, so a filtered view can be bookmarked and back and
// reload keep it. Unknown or broken values are ignored, never an error.
import { addDaysToKey, isDateKey } from "@/lib/format";
import { parsePage } from "@/lib/paging";
import { ORDER_STATUSES_SHOWN } from "./status";

export type ShownStatus = (typeof ORDER_STATUSES_SHOWN)[number];

export const ORDER_RANGES = ["today", "7d", "month"] as const;
export type OrderRange = (typeof ORDER_RANGES)[number];

export const ORDER_TYPES = ["customer", "electrician"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_METHODS = ["delivery", "pickup"] as const;
export type OrderMethod = (typeof ORDER_METHODS)[number];

export type OrderFilters = {
  readonly status: ShownStatus | null;
  readonly unseen: boolean;
  /** A preset; null when custom dates are set. */
  readonly range: OrderRange | null;
  /** Custom shop days `YYYY-MM-DD`, both ends included. */
  readonly from: string | null;
  readonly to: string | null;
  readonly type: OrderType | null;
  readonly method: OrderMethod | null;
  readonly page: number;
};

/** The shop days the list covers: the custom dates, or the preset resolved against today. */
export type OrderDays = { readonly from: string | null; readonly to: string | null };

export const NO_ORDER_FILTERS: OrderFilters = {
  status: null,
  unseen: false,
  range: null,
  from: null,
  to: null,
  type: null,
  method: null,
  page: 1,
};

export type SearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

const first = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === "string" ? value : value?.[0];

const oneOf = <T extends string>(options: readonly T[], value: string | undefined): T | null =>
  options.find((option) => option === value) ?? null;

const dateKey = (value: string | undefined): string | null =>
  value !== undefined && isDateKey(value) ? value : null;

/** Reads the list's search params; `today` is the shop's date key on this request. */
export function parseOrderFilters(params: SearchParams, today: string) {
  let from = dateKey(first(params.from));
  let to = dateKey(first(params.to));
  if (from && to && from > to) [from, to] = [to, from];
  const custom = from !== null || to !== null;

  const filters: OrderFilters = {
    // `confirmed` is not a chip (AC-1), so `status=confirmed` is ignored like any unknown value.
    status: oneOf(ORDER_STATUSES_SHOWN, first(params.status)),
    unseen: first(params.unseen) === "1",
    // Custom dates win over a preset.
    range: custom ? null : oneOf(ORDER_RANGES, first(params.range)),
    from,
    to,
    type: oneOf(ORDER_TYPES, first(params.type)),
    method: oneOf(ORDER_METHODS, first(params.method)),
    page: parsePage(first(params.page)),
  };
  return { filters, days: orderDays(filters, today) };
}

/** The preset or the custom dates as from and to keys; today gives from = to = today. */
export function orderDays(filters: OrderFilters, today: string): OrderDays {
  switch (filters.range) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDaysToKey(today, -6), to: today };
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case null:
      return { from: filters.from, to: filters.to };
  }
}

/** True when any filter narrows the list (paging aside). */
export function hasOrderFilters(filters: OrderFilters): boolean {
  return (
    filters.status !== null ||
    filters.unseen ||
    filters.range !== null ||
    filters.from !== null ||
    filters.to !== null ||
    filters.type !== null ||
    filters.method !== null
  );
}

/** The search params in one fixed order; only custom dates or the preset, and page 1 left out. */
export function orderFiltersToParams(filters: OrderFilters, page = filters.page): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.unseen) params.set("unseen", "1");
  if (filters.from || filters.to) {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  } else if (filters.range) {
    params.set("range", filters.range);
  }
  if (filters.type) params.set("type", filters.type);
  if (filters.method) params.set("method", filters.method);
  if (page > 1) params.set("page", String(page));
  return params;
}
