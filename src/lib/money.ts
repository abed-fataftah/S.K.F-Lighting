// Money on screen (spec 0005, AC-2). Amounts are integer agorot (1 ₪ = 100 agorot) end to end:
// no floats and no Intl, so every runtime and browser prints the same text.
import { formatNumber } from "./format";

/** `₪1,250`, `₪19.90`, `-₪50`: agorot shown only when the amount is not whole shekels. */
export function formatPrice(agorot: number): string {
  if (!Number.isSafeInteger(agorot)) {
    throw new RangeError(`formatPrice needs a safe integer of agorot, got ${agorot}`);
  }
  const abs = Math.abs(agorot);
  const rest = abs % 100;
  // abs - rest is a multiple of 100, so this division is exact.
  const shekels = formatNumber((abs - rest) / 100);
  const fraction = rest === 0 ? "" : `.${String(rest).padStart(2, "0")}`;
  return `${agorot < 0 ? "-" : ""}₪${shekels}${fraction}`;
}

/** The highest price the shop takes: ₪1,000,000 (spec 0004 AC-2). */
export const MAX_PRICE_AGOROT = 100_000_000;

// Whole shekels, plain (`1250`) or with comma thousands (`1,250`), then up to two decimals.
const SHEKELS = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * Typed shekels to integer agorot by string arithmetic, never floats: `"19.9"` is 1990,
 * `"1,250"` is 125000. Expects a cleaned number field (Western digits, see `digitsField`).
 * `null` for anything else, more than two decimals, 0 or below, or above `MAX_PRICE_AGOROT`.
 */
export function parseShekels(text: string): number | null {
  const match = SHEKELS.exec(text.trim());
  if (!match) return null;
  const whole = match[1].replaceAll(",", "").replace(/^0+(?=\d)/, "");
  // Ten digits of shekels is already far above the limit; stop before Number loses precision.
  if (whole.length > 9) return null;
  const agorot = Number(whole) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return agorot > 0 && agorot <= MAX_PRICE_AGOROT ? agorot : null;
}
