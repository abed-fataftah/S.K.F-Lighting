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
