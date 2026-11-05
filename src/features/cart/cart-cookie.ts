// The cart cookie `skf_cart` (spec 0004): variant ids and quantities only, in cart order, never a
// price or a name. Pure codecs: a tampered or malformed cookie can only empty the cart, never throw.
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/quantity";
import { isUuid } from "@/lib/uuid";

export const CART_COOKIE = "skf_cart";
export const MAX_CART_LINES = 30;
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type CartLine = { readonly variantId: string; readonly quantity: number };

const capped = (quantity: number) => Math.min(MAX_QUANTITY, quantity);

const isQuantity = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= MIN_QUANTITY && (value as number) <= MAX_QUANTITY;

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Keeps well formed entries, merges repeats (capped at 99), and cuts after 30 lines. */
export function parseCart(raw: string | undefined): readonly CartLine[] {
  const data = raw ? readJson(raw) : null;
  if (!Array.isArray(data)) return [];

  return data
    .flatMap((entry: unknown): CartLine[] => {
      const { v, q } = (entry ?? {}) as { v?: unknown; q?: unknown };
      return isUuid(v) && isQuantity(q) ? [{ variantId: v.toLowerCase(), quantity: q }] : [];
    })
    .reduce<readonly CartLine[]>((lines, line) => {
      const at = lines.findIndex((kept) => kept.variantId === line.variantId);
      if (at === -1) return [...lines, line];
      return lines.map((kept, i) =>
        i === at ? { ...kept, quantity: capped(kept.quantity + line.quantity) } : kept,
      );
    }, [])
    .slice(0, MAX_CART_LINES);
}

export function serializeCart(lines: readonly CartLine[]): string {
  return JSON.stringify(lines.map((line) => ({ v: line.variantId, q: line.quantity })));
}

export type AddLineResult =
  | { readonly ok: true; readonly lines: readonly CartLine[] }
  | { readonly ok: false; readonly error: "cart_full" };

/** Adds to the line's quantity when the variant is already there (capped at 99); a 31st line is refused. */
export function addLine(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
): AddLineResult {
  const id = variantId.toLowerCase();
  if (lines.some((line) => line.variantId === id)) {
    return {
      ok: true,
      lines: lines.map((line) =>
        line.variantId === id ? { ...line, quantity: capped(line.quantity + quantity) } : line,
      ),
    };
  }
  if (lines.length >= MAX_CART_LINES) return { ok: false, error: "cart_full" };
  return { ok: true, lines: [...lines, { variantId: id, quantity: capped(quantity) }] };
}

/** Sets one line's quantity, clamped to 1 to 99; an id not in the cart changes nothing. */
export function setQuantity(
  lines: readonly CartLine[],
  variantId: string,
  quantity: number,
): readonly CartLine[] {
  const id = variantId.toLowerCase();
  const clamped = Math.max(MIN_QUANTITY, capped(quantity));
  return lines.map((line) => (line.variantId === id ? { ...line, quantity: clamped } : line));
}

export function removeLine(lines: readonly CartLine[], variantId: string): readonly CartLine[] {
  const id = variantId.toLowerCase();
  return lines.filter((line) => line.variantId !== id);
}
