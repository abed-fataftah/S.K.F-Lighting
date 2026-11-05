// Short order numbers a customer can read over WhatsApp: `YY-NNNNN`, for example `26-00042`.

import { tidyText, toWesternDigits } from "@/lib/arabic";
import { shopYear } from "@/lib/format";

/** The calendar year of `placedAt` on the shop's clock, which names the order's number series. */
export function orderYear(placedAt: Date): number {
  return shopYear(placedAt);
}

/** `formatOrderNumber(2026, 42)` is `"26-00042"`; past 99999 the sequence simply grows longer. */
export function formatOrderNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new RangeError(`year must be a four digit year, got ${year}`);
  }
  if (!Number.isSafeInteger(seq) || seq < 1) {
    throw new RangeError(`sequence must be an integer of at least 1, got ${seq}`);
  }
  const yy = String(year % 100).padStart(2, "0");
  return `${yy}-${String(seq).padStart(5, "0")}`;
}

/** `true` for text shaped like an order number, `YY-NNNNN` or longer (spec 0013 AC-1). */
export function isOrderNumber(text: string): boolean {
  return /^\d{2}-\d{5,}$/.test(text);
}

// Dash punctuation, the minus sign, and white space: what people type between the two parts.
const NUMBER_SEPARATORS = /[\p{Pd}−\s]/gu;

/**
 * A typed order number in its saved form (spec 0015 AC-2), or `null`. Tidied, Arabic digits made
 * Western, separators dropped; 7 to 12 digits then read as `YY-NNNNN…`. `٢٦ ٠٠٠٤٢`, `2600042`,
 * and `26–00042` all give `26-00042`.
 */
export function parseOrderNumberInput(raw: string): string | null {
  const digits = toWesternDigits(tidyText(raw)).replace(NUMBER_SEPARATORS, "");
  if (!/^\d{7,12}$/.test(digits)) return null;
  const number = `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return isOrderNumber(number) ? number : null;
}
