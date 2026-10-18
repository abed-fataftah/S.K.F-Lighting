// Short order numbers a customer can read over WhatsApp: `YY-NNNNN`, for example `26-00042`.

const SHOP_TIME_ZONE = "Asia/Jerusalem";

const yearFormat = new Intl.DateTimeFormat("en-US", { timeZone: SHOP_TIME_ZONE, year: "numeric" });

/** The calendar year of `placedAt` in the shop's time zone, which names the order's number series. */
export function orderYear(placedAt: Date): number {
  return Number(yearFormat.format(placedAt));
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
