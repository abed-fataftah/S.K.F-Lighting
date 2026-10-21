# 0005. Arabic language rules: digits, prices, dates, and Arabic text

**Date**: 2026-10-20
**Status**: In Progress

## Summary

The shop is Arabic only. This spec settles how numbers, prices, dates, times, and phone numbers read, and the rules for Arabic text the owner and customers type. Everything shows Western digits (0 to 9), prices read `₪1,250`, dates read `20/10/2026`, and times read `4:45 م`, always on the West Bank clock (`Asia/Hebron`). One small set of pure functions (functions with no side effects) produces every one of these, a rule test stops anyone formatting another way, and owner content such as product names must contain Arabic letters.

## Requirements

**User stories**:
- As a shopper on a phone, I want prices, dates, and order numbers to read the same on every page and in WhatsApp, so that I trust what I am paying and can read my order number back.
- As a shopper with an Arabic keyboard, I want my phone number and quantities accepted when I type Arabic digits (٠٥٩…), so that I am never stuck on a form.
- As the owner, I want the dashboard to show dates and times on my own wall clock in one familiar style, so that I can tell which order came first.
- As the owner, I want the shop to refuse a product name with no Arabic in it, so that nothing slips onto the shop in English by mistake.
- As the builder of every later feature, I want ready functions and a test that fails on the wrong pattern, so that I never choose a format again.

**Acceptance criteria**:
- **AC-1**: Western digits everywhere. Every number the app renders as text (prices, quantities, counts, order numbers, dates, times, phone numbers), on the storefront and the dashboard, uses the digits 0 to 9, whatever the browser's language, region, or time zone. A Playwright run with browser locale `ar-PS` and time zone `America/New_York` shows the same digits and the same dates for the same fixed instants as one with `en-US` and `Asia/Hebron`. Browser drawn controls (native date pickers, `type="number"` spinners, built in validation bubbles) are out of scope; the app does not use them for these values (see Exceptions).
- **AC-2**: Prices. `formatPrice(agorot)` (spec 0004 AC-14, defined here) returns `₪` before the number with no space, comma thousands, and no decimals when the amount is whole shekels, else exactly two: `formatPrice(2000)` is `₪20`, `formatPrice(125000)` is `₪1,250`, `formatPrice(1990)` is `₪19.90`, `formatPrice(1905)` is `₪19.05`, `formatPrice(0)` is `₪0`, `formatPrice(-0)` is `₪0`, `formatPrice(-5000)` is `-₪50` (ASCII `-`), `formatPrice(123456789)` is `₪1,234,567.89`. It uses integer arithmetic only (no floats, no `Intl`) and throws a `RangeError` on a value that is not a safe integer (`1.5`, `NaN`, a string).
- **AC-3**: Dates. `formatDate(date)` returns day, month, and year as `DD/MM/YYYY`, day and month padded to two digits, in `SHOP_TIME_ZONE` (`Asia/Hebron`): `2026-10-20T13:45:00Z` gives `20/10/2026`; `2026-03-04T22:30:00Z` gives `05/03/2026` (already the next day on the shop's clock). An invalid `Date` throws a `RangeError`.
- **AC-4**: Times. `formatTime(date)` returns a 12 hour time: the hour without padding (`12` for hours 0 and 12), `:`, minutes padded to two digits, a space, then `ص` for hours 0 to 11 or `م` for hours 12 to 23, all on the shop's clock. Fixtures: `2026-10-20T13:45:00Z` gives `4:45 م`; `2026-10-19T21:05:00Z` gives `12:05 ص`; `2026-10-20T09:00:00Z` gives `12:00 م`; across the 2026 West Bank clock changes (summer time from `2026-03-28T00:00:00Z`, winter time from `2026-10-23T23:00:00Z`), `2026-03-27T12:00:00Z` gives `2:00 م`, `2026-03-28T12:00:00Z` gives `3:00 م`, `2026-10-23T12:00:00Z` gives `3:00 م`, and `2026-10-24T12:00:00Z` gives `2:00 م` (Jerusalem would still say `3:00 م`). An invalid `Date` throws a `RangeError`.
- **AC-5**: Date with time. `formatDateTime(date)` returns `formatDate`, a space, `·`, a space, then `formatTime`: `2026-10-20T13:45:00Z` gives `20/10/2026 · 4:45 م`. No screen shows relative times (such as منذ 5 دقائق).
- **AC-6**: No hidden marks. No output of a format function, and no WhatsApp message built from them, contains any character AC-10 removes as invisible (U+061C, U+200B to U+200F, U+202A to U+202E, U+2060 to U+2069, U+FEFF).
- **AC-7**: Plain numbers. `formatNumber(n)` returns a whole number with comma thousands and an ASCII `-` for negatives (`formatNumber(1250)` is `1,250`, `formatNumber(7)` is `7`, `formatNumber(-3)` is `-3`, `formatNumber(-0)` is `0`), built by string grouping with no `Intl`, and throws a `RangeError` on a value that is not a safe integer. Quantities, counts, and KPIs that are not money use it.
- **AC-8**: Phone numbers. `formatPhone(e164)` turns a stored mobile number (`+970` or `+972` then 9 digits starting `5`) into the local 10 digit form grouped 3, 3, 4: `+970599123456` gives `059 912 3456`, `+972521234567` gives `052 123 4567`. Anything else is returned unchanged. Pages and the dashboard show phones this way inside `<Ltr>`. The phone kept "as typed" (spec 0004 `customer_phone` and W5) is the typed value after the number field cleaning in AC-9, so it never holds Arabic digits or hidden marks.
- **AC-9**: Typed Arabic digits. `toWesternDigits(text)` turns `٠` to `٩` (U+0660 to U+0669) and `۰` to `۹` (U+06F0 to U+06F9) into `0` to `9`, `٫` (U+066B) into `.`, and `٬` (U+066C) into `,`, leaving everything else alone. Every number field runs `digitsField`: single line `tidyText` (AC-10), then `toWesternDigits`, then the field's own steps (uppercase for a code, `normalizePhone`, `parseShekels`, the pattern). Number fields: phone, price, delivery fee, quantity, product code, payment amount, cheque number, and order number lookup. A checkout with phone `٠٥٩٩١٢٣٤٥٦` or `‏0599 123 456` (a pasted RLM in front) is accepted: `customer_phone` holds the cleaned text (`0599123456` and `0599 123 456`), `customer_phone_e164` holds `+970599123456`, and W5 shows Western digits. A price typed `١٬٢٥٠` reads as `1,250`; `parseShekels` accepts comma thousands (`1,250` and `1250` both give 125000 agorot; a comma anywhere but between groups of three is invalid). Typing `١٢` in the quantity stepper commits `12`. Free text fields (names, addresses, notes, descriptions, search queries) keep their digits as typed; search converts its own copy (AC-12).
- **AC-10**: Tidy text on save. Every free text field, from the owner or a customer, is tidied before its length and content checks, in this order: `\r\n` and `\r` become `\n`; Unicode NFC; tatweel (`ـ`, U+0640) removed; invisible format characters removed (U+00AD, U+061C, U+200B, U+200E, U+200F, U+202A to U+202E, U+2060 to U+2069, U+FEFF); other control characters (U+0000 to U+001F except `\n` and `\t`, and U+007F to U+009F) removed; every tab and Unicode space separator (`\p{Zs}`, including U+00A0) becomes a plain space, and U+2028 and U+2029 become `\n`; runs of spaces collapse to one; each line is trimmed; the ends are trimmed. ZWNJ (U+200C) and ZWJ (U+200D) are kept, so emoji sequences in notes survive. Single line fields turn every `\n` into one space (then collapse again); multi line fields keep line breaks with at most one empty line in a row. Diacritics (tashkeel) and the letters stay as written, except that NFC composes a decomposed hamza (`ا` + U+0654 becomes `أ`). Length limits count code points (`Array.from(text).length`) after tidying. `"  ثريـــا   كريستال‏ "` is saved as `ثريا كريستال`. Multi line fields: product description, customer notes, policy page text. Every other free text field is single line.
- **AC-11**: Arabic required in owner content. These owner typed fields must contain at least one Arabic letter after tidying (a character in the Arabic script that is also a letter, `[\p{Script=Arabic}&&\p{L}]` with the `v` flag; this counts Persian and Urdu letters and presentation forms, not tatweel, Arabic digits, or Arabic punctuation), else the field shows `arabic_required` ("اكتب هذا الحقل بالعربية"): product name, category name, product description (when filled), spec labels, option group labels and colour names, image alt text, banner titles, policy page titles and text, and shop settings text (shop name lines, address, delivery zone names). Not checked: values typed beside a spec label (`60W`, `120 cm`), size values (`XL`, `120 cm`), and product codes. A shop name line may hold the Latin brand `S.K.F lighting` beside Arabic (`S.K.F lighting للإنارة` passes; `S.K.F lighting` alone fails). `Philips 60W` is rejected; `ثريا كريستال Philips 60W` is accepted; `ــــ` and `١٢٣` are rejected. An optional field left blank (`""` after tidying) is treated as not filled and skips every check. In this feature the rule is wired into the fields that exist (spec 0004: product name and new category name); each later feature applies it to its fields from this list.
- **AC-12**: Search matching. `normalizeForSearch(text)` runs, in this order: tidy (AC-10, single line); Unicode NFKC (so presentation forms such as `ﻻ` become `لا`; it also folds `²`, `ﬁ`, and full width Latin, which is wanted for search); remove the marks in `ARABIC_MARKS` (U+0610 to U+061A, U+064B to U+065F, U+0670, U+06D6 to U+06ED) and tatweel; fold `أ` `إ` `آ` `ٱ` into `ا`, `ى` into `ي`, `ة` into `ه`, `ؤ` into `و`, `ئ` into `ي`; `toWesternDigits`; lowercase; collapse whitespace and trim. It is idempotent. `normalizeForSearch("إنارةُ  الزينة")` equals `normalizeForSearch("انارة الزينه")`. Feature 11 (search) uses it on both the query and the product text; this feature ships the function and its tests only.
- **AC-13**: Messages file rules. Each message in `src/i18n/messages/ar.json` is parsed with `@formatjs/icu-messageformat-parser` (already installed with next-intl) and the tree walked: every `plural` node has `other`, `one`, `two`, `few`, `many`, and one of `zero` or `=0`; no message has a pound node (`#`) or a `number`, `date`, or `time` argument (numbers arrive as preformatted string arguments, like `{shown}` in `Shell.cartWithCount`, which passes today); literal text has no Arabic Indic or Persian digits and no ASCII `?` or `;` (use `؟` and `؛`). Every message keeps Arabic text (the existing test).
- **AC-14**: Direction. Prices, product codes, order numbers, and phone numbers in the page render inside `<Ltr>` (`src/components/ltr.tsx`, `<bdi dir="ltr">`), whether in a sentence, a table cell, or alone, so `-₪50` and `CH-1020` never flip. Dates and times render without `<Ltr>`, inside `<time dateTime={iso}>`, so `4:45 م` reads with `م` after the number. WhatsApp text is plain and gets no marks (AC-6). Checked by Playwright on the gallery and on spec 0004's product, cart, checkout, and admin orders pages.
- **AC-15**: One way to format. A Vitest rule test (`src/language-rules.test.ts`) scans `.ts` and `.tsx` files in `src/` (test files excluded, comments stripped before matching) and fails on `toLocaleString(`, `toLocaleDateString(`, `toLocaleTimeString(`, `toDateString(`, `toTimeString(`, `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.ListFormat`, `useFormatter`, `getFormatter`, `.toFixed(`, the date accessors `getHours(`, `getMinutes(`, `getDate(`, `getDay(`, `getMonth(`, `getFullYear(` (local time, the server's or the browser's zone, never the shop's), and the strings `"Asia/Jerusalem"` or `"Asia/Hebron"`, anywhere outside `src/lib/format.ts` and `src/lib/money.ts`; and on an Arabic Indic or Persian digit outside `src/lib/arabic.ts`. It also runs the AC-13 checks on `ar.json`. Planted fixtures are built from string pieces so the test never flags itself. It passes on the finished tree.
- **AC-16**: Applied to what exists. `SHOP_TIME_ZONE = "Asia/Hebron"` in `src/lib/format.ts` is the only time zone in `src/`: `src/i18n/request.ts` uses it, `orderYear` in `src/features/orders/order-number.ts` delegates to `shopYear` (same results; both zones are UTC+2 at New Year), and any SQL that names a zone takes it as a parameter. The design system gallery shows its sample prices, KPI, and order totals through `formatPrice` and `formatNumber`, plus one date and time row for the fixed instant `2026-10-20T13:45:00Z` reading `20/10/2026 · 4:45 م`; no hand typed price is left in `src/app/`. Visible copy on every screen comes from `ar.json`, except the root `src/app/not-found.tsx`, which sits outside next-intl and keeps its Arabic literal.

## Decision

**Chosen option**: Option 1: Own pure functions pinned to Western digits, with a rule test.

All display formatting goes through pure functions in `src/lib/format.ts` and `src/lib/money.ts`: numbers and prices by integer string grouping with no `Intl`, dates and times from one cached `Intl.DateTimeFormat` read as 24 hour numeric parts in `Asia/Hebron`, with the 12 hour clock and `ص`/`م` computed in code. All Arabic text rules live in `src/lib/arabic.ts` with Zod helpers in `src/lib/text-schemas.ts`; a rule test makes any other path fail CI.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`), for keeping the format calls server first and the cached formatter at module level (it is immutable, not shared mutable state).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Standard definition

**Canonical pattern**:

```tsx
// Server or client component: format first, then pass strings to messages.
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { Ltr } from "@/components/ltr";

<p>{t("total")}: <Ltr>{formatPrice(order.totalAgorot)}</Ltr></p>
<time dateTime={order.placedAt.toISOString()}>{formatDateTime(order.placedAt)}</time>
<p>{t("cartWithCount", { count, shown: formatNumber(count) })}</p>

// Schema: number fields clean then validate; text fields tidy then check Arabic.
import { arabicText, digitsField, tidiedText } from "@/lib/text-schemas";

const productSchema = z.object({
  name: arabicText({ min: 2, max: 120 }),
  code: digitsField((s) => s.toUpperCase(), z.string().regex(CODE_PATTERN)),
  description: arabicText({ max: 4000, multiline: true, optional: true }),
  notes: tidiedText({ max: 500, multiline: true, optional: true }),
});
```

`digitsField(prepare, schema)` is `z.string().transform((s) => prepare(toWesternDigits(tidyText(s)))).pipe(schema)`; `tidiedText` and `arabicText` are `z.string().transform(tidy).pipe(z.string().min().max()...refine())`, with lengths counted in code points. With `optional: true`, a blank result becomes `undefined` and skips the length and Arabic checks.

**Replaces**:
- `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString`, the local time `Date` getters, and inline `new Intl.*Format(...)` in components or actions.
- next-intl's `useFormatter` / `getFormatter` and ICU `{n, number}`, `{d, date}`, `#` inside messages (they follow next-intl's plain `ar` locale, whose digits differ between browsers).
- Hand typed prices like `"₪1,250"` in code, and `.toFixed(2)` on money.
- A separate `"Asia/Jerusalem"` string per file.

**Enforcement**: `src/language-rules.test.ts` (AC-15), run by `pnpm exec vitest run` locally and in CI (the Vitest step of `.github/workflows/ci.yml`).

**Rollout**: new code immediately. The tree today breaks it only with the gallery literals and the time zone strings, which this feature fixes in one change (AC-16).

**Exceptions**: machine readable output uses machine formats, never display formats: `<time dateTime>` attributes (ISO 8601), JSON-LD prices (`"1250.00"` with `priceCurrency: "ILS"`, feature 28), CSV exports (plain numbers and ISO dates, feature 27), URLs and query strings, and database values. The brand `S.K.F lighting` and product codes stay Latin. Number inputs are `type="text"` with `inputMode="numeric"` or `"decimal"`, never `type="number"`; any future date input is a text field or a custom picker, not the browser's native one. `src/app/not-found.tsx` keeps its literal (AC-16).

## Feature design

**Data model sketch**: no schema change. Text is stored tidied (AC-10) in the existing `text` columns; the Arabic rule (AC-11) is checked by the shared Zod schema on the client and again on the server, not by a database check. Search may later store a normalized copy (feature 11 decides).

**Modules**:

| File | Exports | Notes |
|---|---|---|
| `src/lib/format.ts` | `SHOP_TIME_ZONE` (`"Asia/Hebron"`), `formatDate`, `formatTime`, `formatDateTime`, `formatNumber`, `formatPhone`, `shopYear` | One `Intl.DateTimeFormat("en-US", { timeZone: SHOP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })` at module level, read with `formatToParts` by part type (digits only, so no locale text or marks reach the output); `formatTime` computes the 12 hour value and `ص`/`م` itself; `formatNumber` groups digits with a string replace |
| `src/lib/money.ts` | `formatPrice` (AC-2), plus `parseShekels` from spec 0004 (now accepting comma thousands, AC-9) | Shekels and agorot split by integer division and remainder; thousands from `formatNumber` |
| `src/lib/arabic.ts` | `ARABIC_MARKS_SOURCE` (the character class as a string), `stripArabicMarks`, `toWesternDigits`, `tidyText(text, { multiline })`, `hasArabicLetter`, `normalizeForSearch` | No exported regex carries the `g` flag (a shared `/g` regex keeps `lastIndex` between `.test()` calls); each function builds or holds its own. `src/features/catalog/slug.ts` uses `stripArabicMarks`, and its tests prove slugs are unchanged |
| `src/lib/text-schemas.ts` | `tidiedText`, `arabicText`, `digitsField` | Error codes `too_short`, `too_long`, `arabic_required` |
| `src/lib/phone.ts` | `normalizePhone` (existing) | Calls `toWesternDigits` first, so it is safe when used outside a schema |
| `src/lib/quantity.ts` | `commitQuantity` (existing) | Calls `toWesternDigits` first; the stepper input stays `type="text" inputMode="numeric"` with no keystroke filter |
| `src/language-rules.test.ts` | rule test (AC-15, AC-13) | Same shape as `src/design-rules.test.ts` |

**Function surface**:

| Function | Input | Output | Errors |
|---|---|---|---|
| `formatPrice(agorot)` | safe integer agorot (`number`) | `₪1,250`, `₪19.90`, `-₪50` | `RangeError` (a bug, not user input) |
| `formatNumber(n)` | safe integer | `1,250` | `RangeError` |
| `formatDate(date)` | `Date` | `20/10/2026` | `RangeError` on an invalid date |
| `formatTime(date)` | `Date` | `4:45 م` | `RangeError` on an invalid date |
| `formatDateTime(date)` | `Date` | `20/10/2026 · 4:45 م` | `RangeError` on an invalid date |
| `formatPhone(e164)` | stored phone string | `059 912 3456`, or the input unchanged | none |
| `shopYear(date)` | `Date` | `2026` (calendar year on the shop's clock) | `RangeError` on an invalid date |
| `toWesternDigits(text)` | string | string | none |
| `tidyText(text, { multiline })` | string | string | none |
| `hasArabicLetter(text)` | string | boolean | none |
| `normalizeForSearch(text)` | string | string | none |

Callers always pass a `Date` and a `number`: Drizzle maps `timestamptz` to `Date` and `integer` to `number`, and a value that crossed a Server Action or a cookie as an ISO string or text is turned back with `new Date(iso)` or `Number` at that edge, not inside the format functions.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Any price shown or sent | the amount | integer agorot column (`price`, totals, fees) through `formatPrice` |
| Any date or time shown | the instant | a `timestamptz` column (UTC), as a `Date`, shown in `SHOP_TIME_ZONE` |
| Which day, which `ص`/`م` | the shop's local clock | `SHOP_TIME_ZONE = "Asia/Hebron"` (engineer's pick: the shop and owner are in the West Bank), never the browser or server zone |
| `ص` / `م` strings | the day period | computed from the 24 hour part: hours 0 to 11 give `ص`, 12 to 23 give `م` |
| Digit shapes | `0` to `9` | string grouping in code and the `en-US` numeric parts; never the request locale |
| Phone on a page | local grouped form | `customers.phone_e164` / `orders.customer_phone_e164` through `formatPhone` |
| Phone in W5 and `customer_phone` | the typed phone, cleaned | the checkout input after `digitsField` (tidy, Western digits) |
| Count in a message | the number text | `formatNumber(count)` passed as a string argument; the ICU plural picks the words from `count` |
| Field errors | message text | `ar.json`: `Validation.arabicRequired` ("اكتب هذا الحقل بالعربية"), `Validation.tooShort` ("النص قصير جدًا، الحد الأدنى {min} أحرف"), `Validation.tooLong` ("النص طويل جدًا، الحد الأقصى {max} حرفًا"), with `min` and `max` passed through `formatNumber` |
| Search key | the folded text | `normalizeForSearch` of the query and of the product text (feature 11) |

**Key invariants**:
- No display string anywhere comes from a formatter other than the functions above (AC-15).
- Money is never a float on the way to the screen; `formatPrice` works on integers end to end.
- Every displayed instant is in `Asia/Hebron`, whatever runtime renders it (Workers run in UTC; browsers in any zone).
- Text in the database is already tidied, and number field text already has Western digits; reading it never needs cleaning again.
- `tidyText` and `normalizeForSearch` are idempotent (running them twice gives the same text).

**Security model**: no new data or permissions. Removing invisible direction characters from all typed text (AC-10) also blocks text that reorders itself to mislead the owner (for example a spoofed phone or amount in a note). The shop never logs customer phones or addresses, formatted or not.

**Configuration required**: none. The time zone is a constant, not an env var (one shop, one location).

**Copy and tone** (for every new string in `ar.json`): short Modern Standard Arabic, singular imperative as on the approved boards (`أضف إلى السلة`, `تحقق من الاتصال`), no dialect, Arabic punctuation (`،` `؟` `؛`), Western digits, and English only for the brand `S.K.F lighting` and product codes.

**Critical test scenarios**:
- Happy path: unit tests give every example and fixture in AC-2 to AC-5, AC-7, AC-8 exactly; the gallery on a phone sized RTL screen shows `₪1,250` and `20/10/2026 · 4:45 م`, verifies **AC-1**, **AC-16**.
- Foreign browser: Playwright with `locale: "ar-PS"`, `timezoneId: "America/New_York"` sees Western digits and the shop's date for the gallery's fixed instant and on the storefront, verifies **AC-1**, **AC-3**.
- Time edges: the AC-4 fixtures, including both 2026 West Bank clock changes and the day where Hebron and Jerusalem differ, plus an invalid `Date`, verifies **AC-3**, **AC-4**.
- Money edges: `0`, `-0`, `1`, `99`, `100`, `1905`, negatives, `Number.MAX_SAFE_INTEGER`, and `1.5` (throws), verifies **AC-2**, **AC-7**.
- Hidden marks: every format output and a W5 message built from them contain none of the AC-6 code points, verifies **AC-6**.
- Typed digits: `٠٥٩٩١٢٣٤٥٦`, `۰۵۹۹۱۲۳۴۵۶`, and a phone with a pasted RLM pass checkout and land Western in `customer_phone` and W5; `١٬٢٥٠` parses as 125000 agorot; `١٢` commits 12 in the stepper (a component test); a name with `٣` keeps it, verifies **AC-8**, **AC-9**.
- Tidy: tatweel, double spaces, NBSP, RLM, BOM, NUL, `\r\n`, three empty lines, an emoji with ZWJ (kept), and `ا` + U+0654 (becomes `أ`) all give the stated output; tidying twice changes nothing, verifies **AC-10**.
- Arabic rule: the AC-11 examples, a blank optional description passing, `S.K.F lighting للإنارة` passing, plus a product form submit with `Philips 60W` showing the field error with focus on it, verifies **AC-11**.
- Search: each fold on its own, a presentation form, U+FC5E (a shadda presentation form that NFKC turns into a space plus a mark) leaving no stray space, idempotency, and the AC-12 pair, verifies **AC-12**.
- Rule test: planted `toLocaleString(`, `Intl.DateTimeFormat`, `useFormatter`, `.toFixed(`, `getHours(`, `"Asia/Jerusalem"`, a `٣` in a component, a `#` plural, a five category plural, and a `?` in `ar.json` each fail; the same words in a comment pass; the tree passes, verifies **AC-13**, **AC-15**.
- Direction: a negative price and an order number sit in `bdi[dir=ltr]`; a time sits in `<time>` with no `bdi`, on the gallery and spec 0004's pages, verifies **AC-14**.

## Build plan

Tracer Bullet: one formatter proven on a real screen first, then the text rules, then the guard.

1. **Thin thread: formats to a real screen.** `src/lib/format.ts` (`SHOP_TIME_ZONE`, `formatDate`, `formatTime`, `formatDateTime`, `formatNumber`, `formatPhone`, `shopYear`) and `formatPrice` in `src/lib/money.ts` (if spec 0004 has not created the file yet, create it with `formatPrice` only; 0004 adds `parseShekels`), each with Vitest tests for every example and fixture. Point `src/i18n/request.ts` (and its test) and `orderYear` at `SHOP_TIME_ZONE` / `shopYear`, and pass the zone into any SQL that names one. Switch the gallery's sample prices, KPI, and totals to the functions and add the fixed date and time row. Playwright on the gallery at phone size with a foreign locale and time zone. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-16**
2. **Arabic text rules.** `src/lib/arabic.ts` (move the mark class out of `slug.ts`; slug tests stay green), `src/lib/text-schemas.ts`, the `Validation` messages in `ar.json`; `normalizePhone` and `commitQuantity` call `toWesternDigits`. Unit tests for every example, and a component test for the stepper. Satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**
3. **Wire into the forms that exist.** Spec 0004's product schema uses `arabicText` for the name and the new category name and `digitsField` for code and price (`parseShekels` accepting comma thousands); the checkout schema uses `tidiedText` for name, city, address, and notes and `digitsField` for the phone. Prices and phones on 0004's pages and dashboard render in `<Ltr>`; order times use `formatDateTime` in `<time>`. If 0004 is not built yet, these are inputs to its build and land with it. Playwright: checkout with Arabic digits in the phone, and the product form rejecting `Philips 60W`. Satisfies **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-14**
4. **The guard.** `src/language-rules.test.ts` with the source scan (comments stripped), the `ar.json` parse and walk, planted fixtures, and a pass on the tree. Satisfies **AC-13**, **AC-15**

## Consequences

**Positive**:
- One answer for every format question; no feature reinvents a price, date, or digit style, and the rule test catches an agent that tries.
- The same text in pages, Server Actions, and WhatsApp, rendered on Workers (UTC) or in any browser, and independent of the ICU version a runtime ships.
- The owner sees order times on the West Bank clock all year, including the days when it differs from Israel's.
- Customers with Arabic keyboards are never blocked on phone or quantity.
- Search (feature 11) starts with tested Arabic matching instead of designing it under pressure.

**Negative / tradeoffs**:
- Messages cannot format their own numbers; every count needs a preformatted `shown` argument beside `count`, a little more code per call.
- Some shoppers prefer Arabic Indic digits; the shop will not show them anywhere.
- `formatDate` is numeric only: no month names, even on a single order page.
- Customers in the 1948 areas follow Israel's clock; on the few days a year the clocks differ, a time shown to them is one hour off from their own.
- `Asia/Hebron` follows Palestinian cabinet decisions on clock changes, which are sometimes announced late; a late change reaches the shop only when the runtime's time zone data updates.
- The folding in `normalizeForSearch` (`ة` as `ه`, `ى` as `ي`, hamza seats) will sometimes match a word the shopper did not mean; that is the price of forgiving spelling.
- The rule test is a text scan, so a format call hidden behind an alias import slips past it; reviews still matter.

**Neutral**:
- The interim rule in `docs/design/design.md` section 3 becomes the final rule, so no screen built so far changes its look.
- `<html lang="ar">` and next-intl's locale `ar` stay as they are; only display formatting is pinned.
- Spec 0001's display zone changes from `Asia/Jerusalem` to `Asia/Hebron` (amended there); order number years do not change, since both zones are UTC+2 at New Year.
- Spec 0004 AC-12, AC-13, AC-14 and its value sourcing now point here for the phone cleaning, the time zone, and the price format (amended there).

## Follow-up

- [ ] Root `AGENTS.md` `## Rules` should change "shown in `Asia/Jerusalem`" to `Asia/Hebron` and gain one line each for the format and Arabic text rules, pointing at this spec; `/sync` owns that edit.
- [ ] Spec 0002 (AC-7, the `orderYear` row, value sourcing) and the comments in `src/features/orders/server/order-number.ts` and `orders.db.test.ts` still name `Asia/Jerusalem`; reword to the shop's time zone when step 1 lands (behaviour is unchanged).
- [ ] Close open item O-2 in `docs/design/handoff.md` and the numerals and dates line in `docs/design/design.md` section 3 with this spec's rules (`DD/MM/YYYY`, `4:45 م`, `20/10/2026 · 4:45 م`).
- [ ] `docs/scope/catalog.md` features still say "in both languages" in three "Done when" lines; the shop is Arabic only, so `/scope` should reword them.
- [ ] The info strip copy (`Shell.infoStrip`) holds the fees `₪20` and `₪70` as text; feature 26 (shop settings) should build it from `delivery_zones` with `formatPrice`.
- [ ] Decide in feature 11 whether to also fold the Persian `ی` and `ک` (from Persian keyboards) into `ي` and `ك`; not included here.
- [ ] Order number lookup (feature 16) decides whether it accepts the number without its `26-` prefix or with a typed dash other than `-`; this spec only cleans its digits.
