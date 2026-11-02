# 0012. Checkout and delivery

**Date**: 2026-10-27
**Status**: In Progress

## Summary

The checkout form already works end to end from spec 0004; this spec makes its rules strict and final. A name must be a real full name, a city and an address must read like words, the phone stays a Palestinian or Israeli mobile, and pickup asks only for a name and phone. Delivery keeps the two zones and their fixed fees with no free delivery or minimum. Errors show after the first send and then clear as you fix them, and a hidden trap field quietly turns away simple bots. No database change.

## Requirements

**User stories**:
- As a customer, I want the form to tell me exactly what is wrong in Arabic, so I can fix it and send my order.
- As a customer, I want to pick pickup or delivery and see the right fee for my area before I send.
- As the owner, I want orders with real names, mobiles, and addresses, so my driver can find the customer and I can reach them on WhatsApp.

**Acceptance criteria** (these build on spec 0004 AC-6 to AC-10, which stay in force except where a line below changes them):
- **AC-1**: Full name. After tidying (spec 0005), the name is 2 to 80 characters, holds only letters (`\p{L}`, any script), combining marks (`\p{M}`, tashkeel), spaces, hyphens (`-`), and an apostrophe (`'`, `’`, `ʼ`), and has at least two words with at least 2 letters each. Words are split on the single space `tidyText` leaves; only `\p{L}` counts as a letter (marks, hyphens, and apostrophes do not), so a lone `'` or `اً` is not a word. Checks run in this order and only the first failure is shown: length (`tooShort`, `tooLong`), then characters (`lettersOnly`: a digit, emoji, or other symbol), then words (`nameFull`). `أحمد يوسف`, `Ahmad Yousef`, `أحمد O'Neil`, and `Abu-Bakr Saleh` pass; `أحمد`, `أحمد 2`, `ا ب`, `أحمد '`, and `أحمد 😊` fail.
- **AC-2**: Phone. The rules of `normalizePhone` (`src/lib/phone.ts`) are confirmed as final: Palestinian and Israeli mobiles only, typed as `05…`, `+970…`, `+972…`, `00970…`, or `00972…`, with spaces, dashes, dots, or brackets, and Arabic digits (spec 0005 AC-9). A landline or a foreign number shows `phoneMobile`. Unchanged code; this criterion is checked so it cannot drift.
- **AC-3**: City or town (delivery only). After tidying, 2 to 60 characters, holding only letters (`\p{L}`), marks (`\p{M}`), spaces, hyphens, dots, round brackets, and an apostrophe. Checks: length, then characters (`lettersOnly` for a digit or any other symbol). There is deliberately no word count and no repeat rule for the city. `رام الله - البيرة`, `القدس (الشرقية)`, and `Kafr Qasim` pass; `رام الله 2` and `@@` fail. Free text: no town list.
- **AC-4**: Detailed address (delivery only). After tidying, 5 to 300 characters, at least 3 letters (`\p{L}` only; digits and punctuation allowed, for building numbers and `،`), and no single letter or punctuation character repeated 5 or more times in a row (digits are exempt, so `00000` is fine). Checks run in this order, first failure only: length, then letters (`addressLetters`), then repeat (`repeated`). `رام الله، شارع الإرسال، بناية 12` and `قطعة 00000 قرب المسجد` pass; `12345` and `....!` fail with `addressLetters`, and `شارع ههههههه` fails with `repeated`.
- **AC-5**: Pickup asks only for name, phone, and optional notes. A pickup submit drops any sent zone, city, or address (spec 0004 AC-6). The zone choice is the "area" of the scope: no separate area field, and `orders.area` stays null for every order.
- **AC-6**: Delivery fee. Delivery shows every active zone from `delivery_zones` by `sort`, each with its fee, the first preselected (at launch: الضفة الغربية ₪20 and الداخل (مناطق 48) ₪70). The summary's delivery row and total follow the chosen zone; pickup shows "بدون رسوم". The saved `delivery_fee` and `total` equal what the summary showed (spec 0004 AC-8 still refuses a stale total). There is no free delivery threshold, no minimum order, and no delivery time promise on the form.
- **AC-7**: When errors show. Before the first `invalid` answer, no field shows an error while typing. A send with errors shows each error inline under its field (from the server's answer) and moves focus to the first one. From then on (live mode stays on for the page's life, through later `price_changed` or other answers), the text fields (name, phone, city, address, notes) recheck in the browser with the same Zod schema: on input, a field's shown error clears as soon as its value passes; on leaving the field (blur), its error is set from the check, so a new error appears only after the customer leaves the field, never mid typing. Switching between pickup and delivery clears the city, address, and zone errors. Focus never moves during these live checks, and live results are not announced as alerts (only the errors from a send are). The server still validates every send.
- **AC-8**: Bot trap. The form holds one text field named `company_fax_2` inside a wrapper that is `inert`, `aria-hidden="true"`, and placed off screen (not `display: none`); the input has `tabIndex={-1}` and `autoComplete="off"`. People and screen readers never reach it. It is not part of `checkoutSchema`. When `form.get("company_fax_2")` is a string that is not blank after trimming, `placeOrder` saves nothing, skips validation and the rate limit, logs `{"event":"order_honeypot"}`, and answers `save_failed` (the existing "تعذّر حفظ الطلب" notice). The 5 per minute rate limit (spec 0004 AC-10) stays.
- **AC-9**: Messages. Every new error code maps to an Arabic message in `Validation` in `src/i18n/messages/ar.json`, with no parameters: `lettersOnly` "استخدم الحروف فقط، بدون أرقام أو رموز", `nameFull` "اكتب الاسم الكامل: الاسم الأول واسم العائلة", `addressLetters` "اكتب العنوان بالكلمات، مثل اسم الشارع وأقرب معلم", `repeated` "في النص حرف مكرر كثيرًا، راجعه من فضلك". `tooShort` and `tooLong` keep their `{min}` and `{max}`. Each error is linked to its field with `aria-describedby` and the field has `aria-invalid`.
- **AC-10**: Autofill. The fields keep the hints that let the phone's own autofill fill them: name `autocomplete="name"`, phone `type="tel"` and `autocomplete="tel"`, city `address-level2`, address `street-address`. The site stores no customer details in the browser: after an order, `localStorage` and `sessionStorage` hold no name, phone, city, or address, and the cookies hold only ids and quantities (spec 0004).
- **AC-11**: Logs never hold what the customer typed (spec 0004 AC-15). A refused send logs the error code and field names only.
- **AC-12**: On a phone sized right to left screen, Playwright flows pass: a pickup order; a delivery order to each active zone with the summary showing ₪20 and ₪70 and the saved order matching; a send with a one word name, a city with a digit, and the address `12345`, showing the three messages, focus on the name, then each error clearing as it is fixed and the order going through; a filled `company_fax_2` field saving nothing. The checkout page passes the axe check in these states: initial (pickup), delivery chosen, with errors from a send, with live errors after a blur, and with the save failed notice.

## Decision

**Chosen option**: Option 1: Tighten the shared schema in place.

Keep spec 0004's checkout, form, action, and data model, and add the realism rules as shared Zod helpers in `src/lib/text-schemas.ts`, a live recheck in the existing form, and a honeypot check at the top of `placeOrder`.

**Implementation skills**: `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Feature design

**Data model sketch**: no change and no migration. Uses spec 0002 as built: `delivery_zones` (`name`, `fee`, `sort`, `is_active`), `orders` (`customer_name`, `customer_phone`, `customer_phone_e164`, `city` null for pickup, `area` always null, `address`, `notes`, `fulfilment`, `delivery_zone_id`, `delivery_zone_name`, `delivery_fee`, `subtotal`, `total`). The existing DB checks (a delivery order has a zone, city, and address; a pickup order has none and a fee of 0) stay.

**State transitions**: none (an order is born `new`, spec 0004; statuses are feature 15).

**API surface** (all existing; changes in bold):
| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getCheckoutOptions` (`src/features/checkout/server/queries.ts`) | query | none | active zones `{ id, name, fee }[]` by `sort`, `pickupAddress` | public | none |
| `placeOrder` (`src/features/checkout/server/actions.ts`) | Server Action (`useActionState`) | `idempotencyKey`, `name`, `phone`, `fulfilment`, `zoneId?`, `city?`, `address?`, `notes?`, `expectedTotal`, **`website` (honeypot, must be empty)**; lines from `skf_cart` | redirect to `checkoutDone(number)?wa=1`, or `{ ok: false, error }` | public, rate limited | **`save_failed` for a filled honeypot**; `invalid` with field errors (**new codes `letters_only`, `name_full`, `address_letters`, `repeated`**), `rate_limited`, `cart_empty`, `not_sellable`, `zone_invalid`, `price_changed` |

The honeypot field `company_fax_2` is a form field only, read before parsing; it is not an input of `checkoutSchema` (Zod's default object parsing drops it, and the schema stays non strict).

**New pure helpers** (`src/lib/text-schemas.ts`, each with Vitest tests beside it; reusable by accounts (18) and drafts (21)). Each runs `tidiedText` first, then its checks in the AC order, and raises only the first failure (the same `if / else if` chain as the existing `checked()`, passing `{ min }`, `{ max }` params for length):
- `personName({ min, max })`: characters must match `/^[\p{L}\p{M} '’ʼ-]+$/u`, else `letters_only`; then `text.split(" ")` must give at least two words with at least 2 `\p{L}` each, else `name_full`.
- `placeName({ min, max })`: characters must match `/^[\p{L}\p{M} '’ʼ.()-]+$/u`, else `letters_only`.
- `addressText({ min, max })`: at least 3 `\p{L}` code points, else `address_letters`; then no run of 5 or more of the same non digit code point (`/(\D)\1{4,}/u`), else `repeated`.
- `textErrors` gains exactly: `letters_only: "lettersOnly"`, `name_full: "nameFull"`, `address_letters: "addressLetters"`, `repeated: "repeated"`. Check `form-errors.ts` and the error text hook for any exhaustive mapping that needs the new codes.

`checkoutSchema` (`src/features/checkout/schemas.ts`) swaps `tidiedText` for `personName(NAME_LIMITS)`, `placeName(CITY_LIMITS)`, and `addressText(ADDRESS_LIMITS)`; limits unchanged.

**Placing an order, changed steps** (spec 0004's order otherwise):
0. **New, before parsing**: `const trap = form.get("company_fax_2")`; if `typeof trap === "string" && trap.trim() !== ""`, log `order_honeypot` and return `{ ok: false, error: "save_failed" }`. No parse, no rate limit call, no database call.
1. Parse with `checkoutSchema` (now stricter), then continue exactly as spec 0004.

**Form, changed behaviour** (`src/features/checkout/components/checkout-form.tsx`): keeps `useActionState` (no react-hook-form) and the existing focus on the first invalid field after a send.
- `liveErrors: Partial<Record<Field, FieldError | null>>` is an override on top of `state.fieldErrors`: a value replaces the server error, `null` means cleared. It is reset to `{}` whenever a new `invalid` state arrives, using the same "adjust state during render" pattern the form already uses for the fresh cart (`seenState`). A `live` flag turns on at the first `invalid` state and never turns off.
- While `live`, text fields (`name`, `phone`, `city`, `address`, `notes`) get handlers. The check builds `formValues(new FormData(formRef.current))` (which includes the hidden `fulfilment`, `zoneId`, `idempotencyKey`, `expectedTotal`), runs `checkoutSchema.safeParse`, and reads the issue for `event.target.name` only. On input: if that field now passes, set its entry to `null`; never add an error. On blur: set its entry to the issue, or `null`.
- Changing `fulfilment` sets `city`, `address`, and `zoneId` to `null`; the zone radios run no live check. The idempotency key and `expectedTotal` are never touched by live checks.
- `FieldError` gets an `announce` prop: errors from `state.fieldErrors` render with `role="alert"`; any error coming from `liveErrors` renders without a role, so a field moving from a server error to a live one is not announced again. No `aria-live` region is added.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Checkout | zone list, fee per zone, preselected zone | `delivery_zones` where `is_active`, by `sort`; the first is preselected |
| Checkout | delivery row and total in the summary | the chosen zone's `fee` (0 for pickup) plus `readCart().subtotal`, computed in the browser from server values (spec 0004) |
| Checkout | pickup line | `shop_settings.address` (spec 0004) |
| Checkout | live field errors | `checkoutSchema.safeParse` over the form's current values in the browser |
| Checkout | send field errors | `placeOrder`'s `invalid` answer (`fieldErrorsOf`) |
| Checkout | error text | `Validation.*` in `ar.json`, via `textErrors` |
| Place order | honeypot verdict | form field `company_fax_2`, trimmed |
| Place order | `customer_name`, `city`, `address` | inputs after `personName`, `placeName`, `addressText` |
| Place order | `customer_phone`, `customer_phone_e164` | `phoneField` (unchanged) |
| Place order | `area` | always null (AC-5) |
| Place order | `delivery_fee`, `delivery_zone_name`, `total` | `delivery_zones.fee`, `.name` for `zoneId`; `computeOrderTotals` (spec 0004) |

**Key invariants**:
- The browser and the server run the same `checkoutSchema`; the server is the authority.
- A refused send (validation, honeypot, rate limit, stale total) writes nothing.
- Fees come only from `delivery_zones`; the code holds no fee amount.
- Nothing the customer typed is logged or stored in the browser.

**Security model**: public, guest only checkout, unchanged. The honeypot and the per IP rate limit are the abuse guards; Cloudflare Turnstile is a follow up if real spam appears. Personal data (name, phone, city, address, notes) is written only to `orders` and shown only on the placing browser's confirmation page and in the dashboard (spec 0004).

**Configuration required**: none.

**Critical test scenarios**:
- Name rules: the passing and failing examples of AC-1, including tashkeel, `اً` as a word, a Latin name, an apostrophe, a hyphen, a lone `'`, a single word, a digit, an emoji, and a one letter word; the order of messages (`أ` gives `tooShort`; `أحمد2` gives `lettersOnly`, not `nameFull`) (unit), verifies **AC-1**, **AC-9**
- Phone: local, `+970`, `+972`, `00` forms, Arabic digits, and a pasted RLM pass; a landline `022123456` and a Jordanian `+962791234567` fail with `phoneMobile` (unit), verifies **AC-2**
- City and address: the AC-3 and AC-4 examples, `00000` passing, `ههههه` and `.....` failing, an address of exactly 3 letters plus digits passing, and the order `....!` gives `addressLetters` not `repeated` (unit), verifies **AC-3**, **AC-4**
- Pickup with stale city and address fields sent: saved with `city`, `address`, `area` null (database test), verifies **AC-5**
- Delivery to each zone: fee and total match the summary and the saved row (Playwright, database test), verifies **AC-6**, **AC-12**
- Live errors: no errors before the first send; after it, fixing a field clears its error on input without moving focus (`document.activeElement` unchanged); typing an incomplete phone shows nothing until blur; switching to pickup and back clears the city and address errors (component or Playwright), verifies **AC-7**
- Honeypot: a filled `company_fax_2` returns `save_failed`, saves nothing, logs only `order_honeypot`, and the rate limit function is never called (mocked and asserted); a whitespace only value counts as empty (action unit test); the wrapper is `inert` and `aria-hidden` and the input has `tabIndex=-1` (Playwright), verifies **AC-8**, **AC-11**
- Autofill hints present on each field; after a placed order, `localStorage` and `sessionStorage` hold no name, phone, city, or address (Playwright), verifies **AC-10**
- Logs: a refused send logs no typed value, verifies **AC-11**

## Build plan

Tracer Bullet: the thread already runs end to end (spec 0004), so each step thickens it through every layer at once (schema shared by browser and server, then form, then flows).

1. **Realism rules end to end.** `personName`, `placeName`, `addressText`, and the four `textErrors` codes in `src/lib/text-schemas.ts` with Vitest tests; the four `Validation` messages in `ar.json`; `checkoutSchema` switched to them; a phone test table that pins today's `normalizePhone` rules; a database test that a pickup order saves `city`, `address`, `area` null. The server now refuses unrealistic input with the new messages. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-9**
2. **Form behaviour and the bot trap.** Live recheck after the first send in `checkout-form.tsx` (clear on input, set on blur, `announce` prop on `FieldError`); the hidden `company_fax_2` field in its `inert` wrapper; the honeypot check as step 0 of `placeOrder` with its log line; unit tests for the action's honeypot path and the no value logging. Satisfies **AC-7**, **AC-8**, **AC-10**, **AC-11**
3. **Phone flows.** Playwright on a phone sized RTL screen: pickup, delivery to each zone with ₪20 and ₪70, the rejection and live clearing flow, the honeypot, autofill hints, and axe in each state. Satisfies **AC-6**, **AC-10**, **AC-12**

## Consequences

**Positive**:
- The owner gets names, cities, and addresses a driver can use, with no extra field for the customer.
- The rules live in shared helpers, so accounts (18) and electrician drafts (21) get the same checks for free.
- No migration and no new service: the change is reversible by reverting the commits.

**Negative / tradeoffs**:
- A real customer who types only a first name (including a joined `عبدالله`), or a town with a digit in it, must correct it; a few genuine but unusual entries (`A. Smith`, a town written with a number) are refused.
- Free text towns stay unvalidated against a list, so spelling varies (`رام الله`, `رامالله`), which weakens any future per town report. Arabic presentation forms pasted from a PDF pass as letters and are stored as typed (`tidyText` applies NFC, not NFKC).
- The honeypot only stops simple bots; a targeted bot needs Turnstile. If some autofill ever filled the hidden field, that customer would keep seeing "تعذّر حفظ الطلب"; the `order_honeypot` log count is how you would notice.
- Live checks run Zod in the browser after a failed send; cheap at this form size, but the schema now ships in the checkout bundle.

**Neutral**:
- `orders.area` stays in the schema, always null, until a feature needs it.
- The policy link line under the send button ("بإرسال الطلب توافق على الشروط وسياسة الخصوصية") belongs to feature 26, once those pages exist.

## Follow-up

- [ ] Feature 26: add the policy link line under the send button (no checkbox), as decided here.
- [ ] Add Cloudflare Turnstile to checkout if `order_honeypot` or rate limit logs show real spam.
- [ ] Feature 18: signed in prefill of name and phone (the design's "لديك حساب؟ سجّل الدخول" link).
- [ ] Feature 21: build draft and quick order customer fields on `personName`, `placeName`, `addressText`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
