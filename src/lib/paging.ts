// Numbered paging for the dashboard lists (orders: spec 0004 AC-13; products: spec 0006 AC-1). Pure.

/** The `page` search param as a page number: missing, not a whole number, or below 1 reads as 1. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** One extra row is read to know whether a next page exists; it is never shown. */
export function pageWindow(page: number, size: number) {
  return { limit: size + 1, offset: (page - 1) * size };
}

export function splitPage<T>(
  rows: readonly T[],
  size: number,
): { readonly rows: readonly T[]; readonly hasNext: boolean } {
  return { rows: rows.slice(0, size), hasNext: rows.length > size };
}
