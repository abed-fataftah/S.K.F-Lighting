// Display formats (spec 0005): Western digits (0 to 9) and the shop's own clock, whatever the
// browser's or the server's language and time zone. Every number, date, time, and phone a page or
// a WhatsApp message shows comes from here (or `formatPrice` in money.ts); src/language-rules.test.ts
// fails on any other way of formatting.

/** The West Bank clock the shop and its owner live on. The only time zone named in src/. */
export const SHOP_TIME_ZONE = "Asia/Hebron";

// Built once: it is immutable, and read by part type, so only digits reach the output.
const shopClock = new Intl.DateTimeFormat("en-US", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type ShopClock = {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly hour: number;
  readonly minute: string;
};

function onShopClock(date: Date): ShopClock {
  if (Number.isNaN(date.getTime())) throw new RangeError("Cannot format an invalid date");
  const parts = new Map(shopClock.formatToParts(date).map((part) => [part.type, part.value]));
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.get(type) ?? "";
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: Number(part("hour")),
    minute: part("minute"),
  };
}

const dateOf = (clock: ShopClock): string => `${clock.day}/${clock.month}/${clock.year}`;

const timeOf = (clock: ShopClock): string =>
  `${clock.hour % 12 || 12}:${clock.minute} ${clock.hour < 12 ? "ص" : "م"}`;

/** `20/10/2026`: the day on the shop's clock, which may already be tomorrow in UTC terms. */
export function formatDate(date: Date): string {
  return dateOf(onShopClock(date));
}

/** `4:45 م`: a 12 hour time on the shop's clock, `ص` before noon and `م` from noon. */
export function formatTime(date: Date): string {
  return timeOf(onShopClock(date));
}

/** `20/10/2026 · 4:45 م`. Show it inside `<time dateTime={date.toISOString()}>`, never in `<Ltr>`. */
export function formatDateTime(date: Date): string {
  const clock = onShopClock(date);
  return `${dateOf(clock)} · ${timeOf(clock)}`;
}

/** The calendar year on the shop's clock (names the order number series). */
export function shopYear(date: Date): number {
  return Number(onShopClock(date).year);
}

/** `1,250`, `-3`. Whole numbers only: quantities, counts, KPIs. Money goes through `formatPrice`. */
export function formatNumber(n: number): string {
  if (!Number.isSafeInteger(n)) throw new RangeError(`formatNumber needs a safe integer, got ${n}`);
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+$)/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}

const STORED_MOBILE = /^\+97[02](5\d)(\d{3})(\d{4})$/;

/** `+970599123456` reads `059 912 3456`; anything that is not a stored mobile comes back unchanged. */
export function formatPhone(e164: string): string {
  const match = STORED_MOBILE.exec(e164);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164;
}
