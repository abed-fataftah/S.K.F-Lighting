// Paging rules for the dashboard orders list (spec 0004 AC-13). Pure.

export const ADMIN_ORDERS_PAGE_SIZE = 50;

/** The `page` search param as a page number: missing, not a whole number, or below 1 reads as 1. */
export function parseAdminPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** One extra row is read to know whether a next page exists; it is never shown. */
export function pageWindow(page: number) {
  return { limit: ADMIN_ORDERS_PAGE_SIZE + 1, offset: (page - 1) * ADMIN_ORDERS_PAGE_SIZE };
}

export function splitPage<T>(rows: readonly T[]): { rows: readonly T[]; hasNext: boolean } {
  return {
    rows: rows.slice(0, ADMIN_ORDERS_PAGE_SIZE),
    hasNext: rows.length > ADMIN_ORDERS_PAGE_SIZE,
  };
}
