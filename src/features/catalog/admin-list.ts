// The dashboard products list rules (spec 0006 AC-1). Pure: search param parsing, the status label,
// the "من" price rule, and which option counts show. Paging is `src/lib/paging.ts`.
import { tidyText, toWesternDigits } from "@/lib/arabic";
import { isUuid } from "@/lib/uuid";

export const ADMIN_PRODUCTS_PAGE_SIZE = 50;

export const PRODUCT_FILTERS = ["all", "available", "unavailable", "hidden", "archived"] as const;
export type ProductFilter = (typeof PRODUCT_FILTERS)[number];

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The status chip; anything unknown is "all" (everything but archived). */
export function parseProductFilter(value: string | string[] | undefined): ProductFilter {
  const raw = first(value);
  return PRODUCT_FILTERS.find((filter) => filter === raw) ?? "all";
}

/** A category id to filter by, or null; whether it names a category is the query's job. */
export function parseCategoryFilter(value: string | string[] | undefined): string | null {
  const raw = first(value)?.trim();
  return raw && isUuid(raw) ? raw.toLowerCase() : null;
}

/** The search text after tidying and Western digits; null when nothing is left. */
export function parseSearch(value: string | string[] | undefined): string | null {
  const text = toWesternDigits(tidyText(first(value) ?? ""));
  return text || null;
}

/** Escapes `\`, `%`, and `_` so typed text matches itself inside `like`. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export type ProductStatusLabel = "archived" | "hidden" | "available" | "unavailable";

/** The badge and chip word: archived and hidden first, then whether anything can be sold. */
export function statusLabel(
  status: "active" | "hidden" | "archived",
  hasSellableVariant: boolean,
): ProductStatusLabel {
  if (status === "archived") return "archived";
  if (status === "hidden") return "hidden";
  return hasSellableVariant ? "available" : "unavailable";
}

export const statusBadge: Readonly<Record<ProductStatusLabel, "ok" | "off">> = {
  available: "ok",
  unavailable: "off",
  hidden: "off",
  archived: "off",
};

/**
 * The list price: the lowest live variant price, available or not (unlike the shop's list price,
 * which counts sellable variants only), shown with "من" when the live prices differ.
 */
export function listPrice(
  minPrice: number | null,
  maxPrice: number | null,
): { readonly amount: number; readonly from: boolean } | null {
  if (minPrice === null || maxPrice === null) return null;
  return { amount: minPrice, from: minPrice !== maxPrice };
}

/** Which option counts show: each only when above 0; a simple product shows none. */
export function optionCounts(
  sizeCount: number,
  colourCount: number,
): readonly { readonly kind: "sizes" | "colours"; readonly count: number }[] {
  return [
    ...(sizeCount > 0 ? [{ kind: "sizes" as const, count: sizeCount }] : []),
    ...(colourCount > 0 ? [{ kind: "colours" as const, count: colourCount }] : []),
  ];
}
