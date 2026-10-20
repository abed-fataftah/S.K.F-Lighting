// Short order numbers a customer can read over WhatsApp: `YY-NNNNN`, for example `26-00042`.

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
