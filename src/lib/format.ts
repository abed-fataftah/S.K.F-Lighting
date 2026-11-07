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

// Shop days as `YYYY-MM-DD` keys (spec 0014 AC-10): the dashboard's date filters count days on
// the shop's clock, so "today" and "this month" follow Asia/Hebron, summer time included.

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function keyParts(key: string): readonly [number, number, number] | null {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // A real calendar day survives the round trip: 2026-02-30 and 2026-13-01 do not.
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? [year, month, day] : null;
}

const keyOf = (date: Date): string =>
  `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

function partsOrThrow(key: string): readonly [number, number, number] {
  const parts = keyParts(key);
  if (!parts) throw new RangeError(`Not a calendar day key: ${key}`);
  return parts;
}

/** True for a `YYYY-MM-DD` that names a real calendar day. */
export function isDateKey(text: string): boolean {
  return keyParts(text) !== null;
}

/** The shop's calendar day for an instant: `2026-10-28`. */
export function shopDateKey(date: Date): string {
  const clock = onShopClock(date);
  return `${clock.year}-${clock.month}-${clock.day}`;
}

/** The key `days` calendar days after `key` (before, when negative). */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = partsOrThrow(key);
  return keyOf(new Date(Date.UTC(year, month - 1, day + days)));
}

/** The shop's clock time of an instant, read back as if it were UTC, minus the instant. */
function shopOffsetMs(instant: number): number {
  const clock = onShopClock(new Date(instant));
  const wall = Date.UTC(
    Number(clock.year),
    Number(clock.month) - 1,
    Number(clock.day),
    clock.hour,
    Number(clock.minute),
  );
  return wall - Math.floor(instant / 60_000) * 60_000;
}

/** The first instant of a shop day: 00:00 in Asia/Hebron (01:00 on a day whose midnight is skipped). */
export function shopDayStart(key: string): Date {
  const [year, month, day] = partsOrThrow(key);
  const midnight = Date.UTC(year, month - 1, day);
  // The offset before and after the day starts; on a change day they differ. The earliest
  // candidate still on this shop day is its start.
  const candidates = [midnight - 12 * 3_600_000, midnight + 12 * 3_600_000]
    .map((probe) => midnight - shopOffsetMs(probe))
    .filter((instant) => shopDateKey(new Date(instant)) === key);
  return new Date(Math.min(...candidates));
}

/** A shop day key (a `date` column) as `20/10/2026` (spec 0023): the same text as `formatDate`. */
export function formatDayKey(key: string): string {
  return formatDate(shopDayStart(key));
}

/** A shop day key as a short chart label (spec 0024 AC-6): `2026-11-05` reads `5/11`. */
export function formatDayShort(key: string): string {
  const [, month, day] = partsOrThrow(key);
  return `${day}/${month}`;
}

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

/** A month key `YYYY-MM` as a chart label (spec 0024 AC-6): `2026-11` reads `11/2026`. */
export function formatMonthKey(key: string): string {
  const match = MONTH_KEY.exec(key);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) throw new RangeError(`Not a month key: ${key}`);
  return `${month}/${match[1]}`;
}

/** `1,250`, `-3`. Whole numbers only: quantities, counts, KPIs. Money goes through `formatPrice`. */
export function formatNumber(n: number): string {
  if (!Number.isSafeInteger(n)) throw new RangeError(`formatNumber needs a safe integer, got ${n}`);
  const grouped = String(Math.abs(n)).replace(/\B(?=(\d{3})+$)/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}

// Measured numbers for the launch check's table (spec 0028 AC-14): a script, not a page, but the
// same rule that every printed number comes from here.

/** `2,345 ms`: a measured time, to the millisecond. */
export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`formatMs needs a time, got ${ms}`);
  return `${formatNumber(Math.round(ms))} ms`;
}

/** `87`: a Lighthouse score from 0 to 1, read the way Lighthouse shows it, out of 100. */
export function formatScore(score: number): string {
  if (!(score >= 0 && score <= 1)) throw new RangeError(`formatScore needs 0 to 1, got ${score}`);
  return String(Math.round(score * 100));
}

/** `0.052`: a small measure such as the layout shift score, rounded to `places` decimals. */
export function formatDecimal(n: number, places: number): string {
  if (!Number.isFinite(n) || !Number.isInteger(places) || places < 1 || places > 6) {
    throw new RangeError(`formatDecimal needs a number and 1 to 6 places, got ${n}, ${places}`);
  }
  const factor = 10 ** places;
  const scaled = Math.round(Math.abs(n) * factor);
  const whole = formatNumber(Math.floor(scaled / factor));
  const fraction = String(scaled % factor).padStart(places, "0");
  return `${n < 0 && scaled !== 0 ? "-" : ""}${whole}.${fraction}`;
}

const STORED_MOBILE = /^\+97[02](5\d)(\d{3})(\d{4})$/;

/** `+970599123456` reads `059 912 3456`; anything that is not a stored mobile comes back unchanged. */
export function formatPhone(e164: string): string {
  const match = STORED_MOBILE.exec(e164);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164;
}
