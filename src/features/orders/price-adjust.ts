// Electrician price adjustments (spec 0022): which orders may be cut, the per line price rule, the
// discount worked out on read, the edit mode's live preview, and how a save's refusal reads on
// the page. Pure: the edit mode and the Server Action share these.
import { toShekelsInput } from "@/lib/money";
import { adjustedPriceField } from "./schemas";
import type { OrderStatus } from "./status";
import { computeLineTotal, computeOrderTotals, type OrderTotals } from "./totals";

export type PlacedByRole = "customer" | "electrician" | "admin";

/** The statuses whose prices may still move (AC-1); `delivered` and `cancelled` lock them. */
const OPEN_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

/** An electrician's order still open (AC-1). A guest order (null role) is not an electrician's. */
export function canAdjustPrices(placedByRole: PlacedByRole | null, status: OrderStatus): boolean {
  return placedByRole === "electrician" && OPEN_STATUSES.includes(status);
}

/** An electrician's order whose prices are now locked: it shows the muted locked line (AC-1). */
export function pricesLocked(placedByRole: PlacedByRole | null, status: OrderStatus): boolean {
  return placedByRole === "electrician" && !OPEN_STATUSES.includes(status);
}

export type AdjustedPriceError = "required" | "price_invalid" | "above_catalog";

export type AdjustedPriceCheck =
  | { readonly ok: true; readonly agorot: number }
  | { readonly ok: false; readonly error: AdjustedPriceError };

/** Typed shekels to agorot, then at most the line's catalog price (AC-3). */
export function checkAdjustedPrice(text: string, catalogUnitPrice: number): AdjustedPriceCheck {
  const parsed = adjustedPriceField.safeParse(text);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message === "required" ? "required" : "price_invalid",
    };
  }
  return parsed.data > catalogUnitPrice
    ? { ok: false, error: "above_catalog" }
    : { ok: true, agorot: parsed.data };
}

/** Typed text to agorot for the preview only: no catalog cap, null when it does not parse. */
export function previewPrice(text: string): number | null {
  const parsed = adjustedPriceField.safeParse(text);
  return parsed.success ? parsed.data : null;
}

export type DiscountLine = {
  readonly catalogUnitPrice: number;
  readonly unitPrice: number;
  readonly quantity: number;
};

/**
 * "قبل الخصم" (Σ catalog price × quantity) and the price discount (Σ (catalog − unit) × quantity),
 * never stored (AC-7, AC-9). `catalogSubtotal - discount` is the order's line subtotal.
 */
export function priceDiscount(lines: readonly DiscountLine[]): {
  readonly catalogSubtotal: number;
  readonly discount: number;
} {
  const catalogSubtotal = lines.reduce(
    (sum, line) => sum + computeLineTotal(line.catalogUnitPrice, line.quantity),
    0,
  );
  const subtotal = lines.reduce(
    (sum, line) => sum + computeLineTotal(line.unitPrice, line.quantity),
    0,
  );
  return { catalogSubtotal, discount: catalogSubtotal - subtotal };
}

export type PreviewLine = {
  readonly unitPrice: number;
  readonly quantity: number;
  /** What the field holds; undefined when it was never touched. */
  readonly typed: string | undefined;
};

export type Preview = OrderTotals & {
  readonly unitPrices: readonly number[];
  readonly lineTotals: readonly number[];
};

/**
 * The edit mode's live totals (AC-2): a field that parses is previewed (even above the catalog
 * price), one that does not keeps its saved price. A preview the totals refuse (below 0) falls back
 * to the saved totals.
 */
export function previewTotals(
  lines: readonly PreviewLine[],
  deliveryFee: number,
  discountTotal: number,
): Preview {
  const previewed = lines.map((line) => ({
    quantity: line.quantity,
    unitPrice: (line.typed === undefined ? null : previewPrice(line.typed)) ?? line.unitPrice,
  }));
  const unitPrices = previewed.map((line) => line.unitPrice);
  const lineTotals = previewed.map((line) => computeLineTotal(line.unitPrice, line.quantity));
  try {
    const totals = computeOrderTotals({ lines: previewed, deliveryFee, discountTotal });
    return { ...totals, unitPrices, lineTotals };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return { ...computeOrderTotals({ lines, deliveryFee, discountTotal }), unitPrices, lineTotals };
  }
}

export type EditLine = {
  readonly id: string;
  readonly unitPrice: number;
  readonly catalogUnitPrice: number;
};

/** The field's text: what was typed, else the saved price (AC-2 prefill). */
export const fieldText = (line: EditLine, typed: string | undefined): string =>
  typed ?? toShekelsInput(line.unitPrice);

/** The field no longer shows the saved price, so the save sends it (AC-4). */
export const differsFromSaved = (line: EditLine, typed: string | undefined): boolean =>
  typed !== undefined && typed !== toShekelsInput(line.unitPrice);

/** The field no longer shows the catalog price: the struck catalog price and the reset link (AC-2). */
export function differsFromCatalog(line: EditLine, typed: string | undefined): boolean {
  const text = fieldText(line, typed);
  const agorot = previewPrice(text);
  return agorot === null
    ? text !== toShekelsInput(line.catalogUnitPrice)
    : agorot !== line.catalogUnitPrice;
}

/** Every field's problem, in line order, for the page's own check before it sends (AC-3). */
export function fieldErrors(
  lines: readonly EditLine[],
  typed: Readonly<Record<string, string>>,
): Readonly<Record<string, AdjustedPriceError>> {
  return Object.fromEntries(
    lines.flatMap((line) => {
      const check = checkAdjustedPrice(fieldText(line, typed[line.id]), line.catalogUnitPrice);
      return check.ok ? [] : [[line.id, check.error] as const];
    }),
  );
}

/**
 * The per line errors in a failed parse of the save's input (AC-3): each `lines.N.price` issue
 * under its `lineId`. Null when any other part of the input is wrong, which is a plain `invalid`.
 */
export function lineErrorsFromIssues(
  input: unknown,
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[],
): Readonly<Record<string, AdjustedPriceError>> | null {
  const lines =
    typeof input === "object" && input !== null && "lines" in input && Array.isArray(input.lines)
      ? (input.lines as readonly unknown[])
      : [];
  const errors: Record<string, AdjustedPriceError> = {};
  for (const issue of issues) {
    const [root, index, field] = issue.path;
    const line = typeof index === "number" ? lines[index] : undefined;
    const lineId =
      typeof line === "object" && line !== null && "lineId" in line ? line.lineId : undefined;
    if (
      root !== "lines" ||
      field !== "price" ||
      typeof lineId !== "string" ||
      issue.path.length !== 3
    ) {
      return null;
    }
    errors[lineId] = issue.message === "required" ? "required" : "price_invalid";
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export type PriceSaveError =
  | "forbidden"
  | "invalid"
  | "not_found"
  | "not_electrician"
  | "locked"
  | "stale"
  | "no_change"
  | "below_paid";

export type PriceNotice = {
  readonly key:
    | "pricesNoChange"
    | "pricesNotElectrician"
    | "pricesLocked"
    | "pricesStale"
    | "pricesBelowPaid"
    | "pricesSaveFailed";
  /** The page refreshes, which closes edit mode, and focus moves to the notice (AC-6). */
  readonly refresh: boolean;
};

/**
 * How a refusal reads on the page (AC-6). Null for `forbidden` (the refresh sends the browser to
 * sign in) and for an `invalid` that came with line errors (the fields show them).
 */
export function priceNotice(error: PriceSaveError, hasLineErrors: boolean): PriceNotice | null {
  switch (error) {
    case "forbidden":
      return null;
    case "invalid":
      return hasLineErrors ? null : { key: "pricesSaveFailed", refresh: false };
    case "no_change":
      return { key: "pricesNoChange", refresh: false };
    case "not_electrician":
      return { key: "pricesNotElectrician", refresh: true };
    case "locked":
      return { key: "pricesLocked", refresh: true };
    case "stale":
      return { key: "pricesStale", refresh: true };
    case "below_paid":
      return { key: "pricesBelowPaid", refresh: false };
    case "not_found":
      return { key: "pricesSaveFailed", refresh: false };
  }
}
