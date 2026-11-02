# 0015. Order page and guest lookup

**Date**: 2026-10-28
**Status**: In Progress

## Summary

Customers get a page for each order at `/orders/<number>`. It shows the status as a step by step timeline, the items, the totals, and the payment state, plus a WhatsApp button that carries the order number. A guest unlocks the page by typing the order number and the phone they ordered with at `/orders/track`. On a match, the browser keeps a small cookie (a note the browser stores) listing the orders it unlocked, so returning later just works. The browser that placed the order gets in through its existing `skf_placed` cookie. Wrong pairs all get the same answer, and repeated tries are slowed by two Cloudflare rate limits (one per visitor, one per order number). No database change is needed.

## Requirements

**User stories**:
- As a guest who ordered, I want to see where my order is with just my order number and phone, so I don't have to message the shop to ask.
- As a customer who just ordered, I want one tap from the confirmation page to my order page.
- As the owner, I want the "رابط الطلب" link in a W5 message to take me to the order in the dashboard.
- As the owner, I want nobody to read someone else's order by guessing, and no home address visible to anyone who only knows a phone.

**Acceptance criteria**:
- **AC-1**: Lookup page. `/orders/track` shows h1 "تتبّع طلبك", the line "أدخل رقم الطلب ورقم الهاتف الذي استخدمته عند الطلب.", then a card with two labelled fields, "رقم الطلب" (`dir="ltr"`, `inputMode="numeric"`, placeholder `26-00123`, `autoComplete="off"`) and "رقم الهاتف" (`type="tel"`, `dir="ltr"`, `autoComplete="tel"`), a yellow large button "تتبّع الطلب", and the note "عدد المحاولات محدود لحماية بيانات الطلبات.". There is no sign in link (feature 18 adds it). A `?number=` param fills the number field when `parseOrderNumberInput` accepts it, else the field starts empty. The form posts through a Server Action and works without JavaScript. The page is `noindex`.
- **AC-2**: Tolerant number. A new pure `parseOrderNumberInput(raw)` in `src/features/orders/order-number.ts`: `tidyText`, Arabic digits made Western (`src/lib/arabic.ts`), then every match of `/[\p{Pd}−\s]/gu` (dash punctuation, the minus sign, white space) removed. What remains must be 7 to 12 digits and nothing else; it becomes `YY-NNNNN…` (first two digits, a dash, the rest) and must pass `isOrderNumber`, else `null`. `26-00042`, `2600042`, `٢٦-٠٠٠٤٢`, `26 00042`, and `26–00042` all give `26-00042`. `2600`, `abc`, `26/00042`, `#26-00042`, a 13 digit string, and an empty string give `null`.
- **AC-3**: Phone match. The phone goes through the checkout `phoneField` (`normalizePhone`, spec 0005 AC-9) and is compared with `orders.customer_phone_e164`. `0599123456`, `+970599123456`, `٠٥٩٩١٢٣٤٥٦`, and `059 912 3456` all match the same order. A phone that `normalizePhone` refuses is a field error.
- **AC-4**: Success. When the number and phone match one order, its `id` is put first in the new `skf_tracked` cookie (order uuids, newest 10, max age 30 days, through `shopCookieOptions`: httpOnly, SameSite Lax, Secure in production, path `/`), and then the action redirects to `routes.order(parsedNumber)` (the parsed `YY-NNNNN` form, never the raw input). The cookie is written before `redirect()`, and `redirect()` sits outside any try/catch (as in `placeOrder`).
- **AC-5**: Miss. A wrong number, a wrong phone, and an unknown number all return the same result `{ ok: false, error: "not_found" }`. They show the same danger box above the fields, with an icon and `role="alert"`: "لم نجد طلباً بهذه البيانات. تأكد من الرقمين وحاول مرة أخرى.". The typed values stay in the fields: every failure result carries `values: { number, phone }` (the raw strings as typed), and the fields use them as `defaultValue`, because React 19 resets a form after its action. No cookie is written. Each one runs the same single query (`order_number = $1 and customer_phone_e164 = $2`). Format errors (no number, a number `parseOrderNumberInput` refuses, a bad phone) show under their field, and they never reach the limiter or the database.
- **AC-6**: Slowing repeated tries. Each attempt that passes the format check takes one from `ORDER_LOOKUP_IP_LIMITER` (key `cf-connecting-ip`, through `rateKey`), then one from `ORDER_LOOKUP_NUMBER_LIMITER` (key the parsed number). Each allows 5 per 60 seconds. If either is over, the result is `{ ok: false, error: "limited" }`, the box says "تجاوزت عدد المحاولات المسموح. حاول لاحقاً أو تواصل معنا عبر واتساب.", and no query runs. A missing or throwing binding counts as `unchecked`, and the lookup goes on (`checkOrderRate`). Outside production that is logged once as `{"event":"order_lookup_unchecked"}`. A limit hit logs `{"event":"order_lookup_limited","by":"ip"|"number"}` with no number, phone, or IP. A successful lookup also uses up one try from each limiter. Under `next dev` there is no binding, so every request is `unchecked` (and `rateKey` would put them all in one `"local"` bucket anyway); the limited path is tested only on preview.
- **AC-7**: Who opens `/orders/[number]`. The page renders when the order's `id` is in `skf_placed` or in `skf_tracked`. Otherwise (no cookie, a cookie without that order, an unknown number), two things can happen. A visitor whose `getAdminAccess()` is `admin` or `needs_mfa` is redirected to `routes.admin.order(number)`, and the dashboard guards take over from there. Anyone else is redirected to `routes.orderTrackWith(number)` (`/orders/track?number=<n>`), with `number` only when `parseOrderNumberInput` accepts the decoded segment, else to `routes.orderTrack`. A segment that cannot be decoded counts as not accepted. The page never answers 404 or 500 for any of these. `getAdminAccess()` is called only when `getClaims()` holds a `sub`, so guests cost no Auth call. The cookie check comes first on purpose: an admin who holds the cookie for an order (a test order, for example) sees the customer page. Every redirect is a real HTTP 307 sent before streaming starts. So there is no `loading.tsx` and no Suspense boundary over `/orders/*`, and both pages send `Cache-Control: private, no-store`, so OpenNext never serves one visitor's page or redirect to another.
- **AC-8**: Header. h1 "طلب <number>" with the number in `Ltr`, the status badge (AC-9), and a muted line `<formatDate(placed_at)> · <receive>`, where `<receive>` is "استلام من المعرض" for pickup or "توصيل إلى <delivery_zone_name>" for delivery.
- **AC-9**: Timeline. A card "حالة الطلب" holds an ordered list (`<ol>`) of the path for the order's fulfilment, from the same `PATHS` as the dashboard. Pickup: "تم استلام الطلب", "قيد التجهيز", "جاهز للاستلام", "تم التسليم". Delivery: "تم استلام الطلب", "قيد التجهيز", "جاهز للتوصيل", "خرج للتوصيل", "تم التسليم". Steps before the current one show as done, and the current step has the tag "الحالة الحالية" and `aria-current="step"`. The `ready` step's label is `steps.readyPickup` or `steps.readyDelivery` by fulfilment; every other step uses `steps.<status>`. `confirmed` counts as `new`. A status off the path (a pickup order at `out_for_delivery`) shows `ready` as current, the steps before it as done, and `delivered` as upcoming. The badge shows the current step's label with the variant from `statusBadgeVariant`. For a cancelled order, the badge is "ملغي" (variant `off`), and the timeline becomes one line, "تم إلغاء هذا الطلب".
- **AC-10**: Items and totals. The shared `OrderSummary` card (spec 0013) gets the lines, the totals, and `pickupAddress` as on the confirmation page, but `city`, `address`, and `notes` are always `null`. `orderSummaryView` changes in one way: for delivery, `receive.where` is `null` when both `city` and `address` are `null`. Delivery then shows only "توصيل إلى <zone>", and pickup still shows the shop address. Every amount comes from a saved column.
- **AC-11**: Payment. A card "الدفع" shows "الدفع عند الاستلام" and a badge from a pure `paymentState(amountPaid, total)`. `amount_paid = 0` gives "لم يُسجَّل دفع" (`off`), `0 < amount_paid < total` gives "دفعة جزئية" (`proc`), and `amount_paid >= total` gives "مدفوع" (`ok`). On a cancelled order the card shows only "الدفع عند الاستلام", with no badge; refunds belong to the payments and returns features.
- **AC-12**: Contact. A green large button "تواصل معنا عبر واتساب" opens `whatsappUrl(NEXT_PUBLIC_WHATSAPP_NUMBER, W7)` with the plain order number, `target="_blank"` and `rel="noopener"`. `orderNumberInPath` also accepts `/orders/<number>`, so the float sends W7 there. On `/orders/track` it sends W1, because `track` fails `isOrderNumber`. There is no cancel button (feature 17).
- **AC-13**: Privacy. The order page query never selects `customer_name`, `customer_phone`, `customer_phone_e164`, `city`, `address`, `area`, or `notes`, so none can reach the HTML or the RSC payload. The phone travels only in the POST body, never in a URL. Neither page logs any order value. Both pages are `noindex`.
- **AC-14**: Confirmation button. The confirmation page shows a yellow large "متابعة الطلب" (`Confirmation.continueOrder`) linking to `routes.order(number)`, between the green button and "العودة للتسوق" (`docs/design/pages/confirmation.md`). This replaces "hidden until feature 16" in spec 0013 AC-2.
- **AC-15**: Entry. The shared site footer (`site-footer.tsx`, so on every page inside the shop layout, `/orders/*` included) shows "تتبّع طلبك" linking to `routes.orderTrack`, before the policy links.
- **AC-16**: Freshness. `/orders/[number]` renders on every request with no cache, so a status the owner sets shows on the next load. There is no auto refresh.
- **AC-17**: Playwright flows on a phone sized RTL screen (390) and a computer sized one (1280). Place a delivery order and a pickup order. Look each up from a fresh browser context with a different way of writing the number and the phone, and land on the order page: the timeline shows the right steps, the delivery header shows the zone, and no city, address, name, or phone appears. Move the order in the dashboard, then reload and see the new current step. Cancel an order and see "ملغي" and "تم إلغاء هذا الطلب". A wrong phone, a wrong number, and an unknown number show the same box. Six quick tries show the limited box (preview on workerd only). Opening `/orders/<n>` cold answers HTTP 307 with `Location: /orders/track?number=<n>` (asserted on the response, not only the final URL), and the field is filled. A failed lookup keeps both typed values. A signed in admin is sent to `/admin/orders/<n>`. Check "متابعة الطلب" on the confirmation page, the footer link, the green button and float links holding W7, and a `page.on("console")` spy that sees no phone, name, city, or address. Run axe on the lookup page, the lookup error state, and the order page for pickup, delivery, and cancelled.

## Decision

**Chosen option**: Option 1: A server rendered order page, unlocked by a cookie of order ids.

`/orders/[number]` is a dynamic server page that checks the order's id against `skf_placed` and a new `skf_tracked` cookie. `/orders/track` is a Server Action form that matches the number and E.164 phone in one query, behind two Workers rate limit bindings, then adds the id to `skf_tracked` and redirects.

**Implementation skills**: `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) · `wrangler` (`cloudflare/skills`, `.agents/skills/wrangler/`, for the two rate limit bindings) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`, reusing `OrderSummary`)

## Feature design

**Data model sketch**: no schema change, no migration.

| Thing | Kind | Fields used | Notes |
|---|---|---|---|
| `orders` | table, read only | `id`, `order_number` (unique), `customer_phone_e164` (indexed, lookup match only), `status`, `fulfilment`, `delivery_zone_name`, `placed_at`, `subtotal`, `delivery_fee`, `total`, `amount_paid` | Name, phone, city, area, address, notes never selected for the page |
| `order_lines` | table, read only, N:1 `orders` | `product_id`, `product_name`, `size_label`, `colour_name`, `quantity`, `line_total`, `sort` | Photo through the shared `firstProductImageKey` |
| `shop_settings` | table, read only | `address` | Pickup only, through `readPickupAddress` |
| `skf_placed` | existing cookie | order uuids, newest 5, 7 days | Read only here |
| `skf_tracked` | **new** cookie | JSON array of order uuids, newest 10, 30 days | Written only by a successful lookup |

The cookie helpers are pure. `parsePlaced` and `addPlaced` become wrappers over a shared `parseOrderIds(raw, max)` and `addOrderId(ids, id, max)` in `src/features/orders/order-ids-cookie.ts`. `src/features/orders/tracked-cookie.ts` holds `TRACKED_COOKIE = "skf_tracked"`, `MAX_TRACKED = 10`, and `TRACKED_COOKIE_MAX_AGE = 60 * 60 * 24 * 30`. Anything malformed is dropped, as with `skf_placed`.

**State transitions**: none written here. The page reads the statuses of spec 0014. The customer timeline is a pure `customerTimeline(fulfilment, status)` in `src/features/orders/customer-timeline.ts`. It returns `{ kind: "cancelled" }` or `{ kind: "path", steps: { status, state: "done" | "current" | "upcoming" }[] }`, built from the exported `PATHS` (now exported from `status.ts`).

**API surface**:
| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `lookupOrder(prev, formData)` (`src/features/orders/server/lookup-actions.ts`) | Server Action | `number`: string (req), `phone`: string (req) | redirect to `routes.order(parsedNumber)`, or `{ ok: false, error: "invalid", fieldErrors, values }` · `{ ok: false, error: "not_found", values }` · `{ ok: false, error: "limited", values }` (`values` = the raw `{ number, phone }`) | public, rate limited | `invalid`, `not_found`, `limited` |
| `orderLookupSchema` (`src/features/orders/schemas.ts`) | Zod | `number`, `phone` | `{ number: string, phone: { typed, e164 } }` | none | field errors `number_required`, `number_format`, and from `phoneField` `required`, `phone_mobile` |
| `findLookupOrderId(number, phoneE164)` (`src/features/orders/server/customer-order.ts`) | query | parsed number, E.164 phone | `id` or `null` | server only | none |
| `getCustomerOrder(number)` (same file) | query | decoded number | `CustomerOrder` (`id`, `orderNumber`, `status`, `fulfilment`, `deliveryZoneName`, `placedAt`, `subtotal`, `deliveryFee`, `total`, `amountPaid`, `pickupAddress`, `lines[]` with `imageKey`) or `null` | id must be in `skf_placed` ∪ `skf_tracked` | `null` |
| `lookupRateCheck(number)` (`src/features/orders/server/lookup-rate-limit.ts`) | server helper | parsed number, `cf-connecting-ip` header | `"allowed" \| "unchecked"` or `{ limited: "ip" \| "number" }` | none | fails open |
| `readTrackedIds()`, `rememberTrackedOrder(id)` (`src/features/orders/server/tracked.ts`) | server helpers | id | cookie read and write | none | none |
| `/orders/track` (`src/app/[locale]/orders/track/page.tsx`) | page | `?number` | lookup form (`OrderLookupForm`, client, `useActionState`) | public | none |
| `/orders/[number]` (`src/app/[locale]/orders/[number]/page.tsx`) | page, dynamic | `[number]` segment | the order page (AC-8 to AC-12) | cookie, else redirect (AC-7) | never 404 or 500 |
| `routes.orderTrackWith(number)` (`src/lib/routes.ts`) | route builder | number | `/orders/track?number=<encoded>` | none | none |
| `orderNumberInPath` (`src/features/shell/fab-message.ts`) | pure | path | number for `/checkout/done/<n>` and `/orders/<n>`, else `null` | none | none |

**`lookupOrder` steps**: (1) `orderLookupSchema.safeParse`, and on failure return `invalid` with field errors. (2) `lookupRateCheck(number)`, and if limited, log and return `limited`. (3) `findLookupOrderId(number, phone.e164)`, and on `null` return `not_found`. (4) `rememberTrackedOrder(id)`, then `redirect(routes.order(number))`. The action writes only the cookie and changes no order data.

**Order page flow**: decode the segment in try/catch. Then `getCustomerOrder(number)` runs one query, `order_number = $1 and id = any($ids)`, where `$ids` is the union of the two cookies; when the union is empty it returns `null` without a query. On `null`, apply AC-7. On a hit, render the header, timeline, `OrderSummary`, payment card, and contact button in one centered column, `max-width: var(--page-max)` (design O-1). Cache Components is off (`next.config.ts`, spec 0001), and reading `cookies()` already makes the page dynamic, so there is no `dynamic` export. The no store header comes from AC-7. The header, timeline, and payment card take `formatDate` (`src/lib/format.ts`), and `OrderSummary` uses `formatPrice` and `formatNumber` as on the confirmation page.

**Strings** (`src/i18n/messages/ar.json`):
- New `OrderLookup`: `title` "تتبّع طلبك", `intro` "أدخل رقم الطلب ورقم الهاتف الذي استخدمته عند الطلب.", `number` "رقم الطلب", `phone` "رقم الهاتف", `submit` "تتبّع الطلب", `limitNote` "عدد المحاولات محدود لحماية بيانات الطلبات.", `notFound` "لم نجد طلباً بهذه البيانات. تأكد من الرقمين وحاول مرة أخرى.", `limited` "تجاوزت عدد المحاولات المسموح. حاول لاحقاً أو تواصل معنا عبر واتساب.", `errors.number_required` "اكتب رقم الطلب.", `errors.number_format` "اكتب رقم الطلب كما وصلك، مثل <ltr>26-00123</ltr>.", plus `errors.required` and `errors.phone_mobile` copied word for word from the matching Checkout phone errors
- New `OrderPage`: `title` "طلب <ltr>{number}</ltr>", `meta` "{date} · {receive}", `pickup` "استلام من المعرض", `delivery` "توصيل إلى {zone}", `statusTitle` "حالة الطلب", `current` "الحالة الحالية", `steps.new` "تم استلام الطلب", `steps.preparing` "قيد التجهيز", `steps.readyPickup` "جاهز للاستلام", `steps.readyDelivery` "جاهز للتوصيل", `steps.out_for_delivery` "خرج للتوصيل", `steps.delivered` "تم التسليم", `cancelled` "ملغي", `cancelledLine` "تم إلغاء هذا الطلب", `paymentTitle` "الدفع", `paymentMethod` "الدفع عند الاستلام", `payment.none` "لم يُسجَّل دفع", `payment.partial` "دفعة جزئية", `payment.paid` "مدفوع", `contact` "تواصل معنا عبر واتساب"
- New `Shell.footerTrack` "تتبّع طلبك". W7 reuses `Shell.whatsappMessages.order`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Lookup | number to match | `number` input through `parseOrderNumberInput` |
| Lookup | phone to match | `phone` input through `phoneField` (E.164), against `orders.customer_phone_e164` |
| Lookup | IP limiter key | `cf-connecting-ip` header through `rateKey` (`"local"` when missing) |
| Lookup | number limiter key | the parsed number |
| Lookup | id put in cookie | `orders.id` from `findLookupOrderId` |
| Lookup page | prefilled number | `?number` search param through `parseOrderNumberInput` |
| Order page | which order, whether it opens | `[number]` segment plus `skf_placed` ∪ `skf_tracked` ids |
| Order page | admin redirect | `getClaims()` then `getAdminAccess()` (spec 0004 AC-1) |
| Header | number, date, receive line | `orders.order_number`; `formatDate(orders.placed_at)` on the shop clock (`SHOP_TIME_ZONE`, spec 0005); `orders.fulfilment` and `delivery_zone_name` |
| Timeline, badge | steps and current step | `customerTimeline(orders.fulfilment, orders.status)` over `PATHS` (spec 0014) |
| Summary | rows, photo, totals, pickup address | as spec 0013 Value sourcing; `city`, `address`, `notes` fixed to `null` |
| Payment | badge | `paymentState(orders.amount_paid, orders.total)` |
| Contact, float | message and WhatsApp number | W7 `Shell.whatsappMessages.order` with `orders.order_number`; `NEXT_PUBLIC_WHATSAPP_NUMBER` |

**Key invariants**:
- An order page renders only for an id the browser holds in `skf_placed` or `skf_tracked`. A number alone opens nothing.
- A lookup reveals one bit, match or no match, and never which half was wrong.
- The order page never reads, renders, or logs the customer's name, phone, city, area, address, or notes.
- Every amount shown is a saved column, never recomputed.
- The lookup never changes order data. Its only write is the `skf_tracked` cookie.

**Security model**: Both routes are public. RLS is unchanged, and all reads go through `getDb()` in `server/` modules with `server-only`. An order uuid in a cookie is a bearer key (holding it is enough to get in): it can't be guessed, it is httpOnly so scripts can't read it, and it is scoped to this browser. Guessing is bounded by 5 tries a minute per IP and per order number. Because both halves must match and the page never shows an address or a name, someone who knows a phone and guesses sequential order numbers learns only items, status, and zone. The admin redirect only sends the visitor along. The dashboard page still runs `requireAdminPage`. Customer personal data falls under the project's no logging rule. No regulated compliance scope applies.

**Configuration required**:
- `ORDER_LOOKUP_IP_LIMITER`: Workers rate limit binding in `wrangler.jsonc`, `namespace_id` `"1015"`, `simple: { limit: 5, period: 60 }`
- `ORDER_LOOKUP_NUMBER_LIMITER`: Workers rate limit binding, `namespace_id` `"1016"`, `simple: { limit: 5, period: 60 }`
- Run `pnpm cf-typegen` after adding them. No new env var or secret.

**Critical test scenarios**:
- `parseOrderNumberInput`: the AC-2 examples, including Arabic digits, no dash, an en dash, spaces, a slash, a leading `#`, too short, 13 digits, and letters (unit), verifies **AC-2**
- `orderLookupSchema`: field errors for an empty number, a bad number, and a bad phone; the four phone forms give one E.164 (unit), verifies **AC-3**, **AC-5**
- `lookupOrder`: match writes the cookie and redirects; wrong phone, wrong number, and unknown number return the same `not_found`; limited returns `limited` with no query; an `invalid` result calls neither the limiter nor the database (action test with stand ins), verifies **AC-4**, **AC-5**, **AC-6**
- `lookupRateCheck`: IP over, number over, both allowed, a missing binding, a throwing binding (unit over `checkOrderRate`), verifies **AC-6**
- `findLookupOrderId` and `getCustomerOrder`: match only on both columns; `null` for an id outside the cookies; the select has no personal columns (database test), verifies **AC-5**, **AC-7**, **AC-13**
- `customerTimeline`: each status on both paths, `confirmed` as `new`, pickup at `out_for_delivery`, cancelled (unit), verifies **AC-9**
- `paymentState`: 0, partial, equal, over (unit); the cancelled page shows no payment badge (component or Playwright), verifies **AC-11**
- `orderSummaryView`: delivery with null city and address gives `where: null`; the confirmation case is unchanged (unit), verifies **AC-10**
- Cookie helpers: newest first, no repeats, cap 10, malformed dropped; `skf_placed` behaviour unchanged (unit), verifies **AC-4**
- `orderNumberInPath` (now two prefixes, `routes.checkoutDone("")` and `routes.order("")`): `/orders/26-00042` gives the number; `/orders/track` (fails `isOrderNumber`) and `/orders/` give `null`; the confirmation cases are unchanged (unit), verifies **AC-12**
- Order page access: cold open redirects to track with the number, a broken segment redirects to plain track, an admin is sent to the dashboard (Playwright), verifies **AC-7**
- Full flows on 390 and 1280 as AC-17, verifies **AC-1**, **AC-8** to **AC-17**

## Build plan

Tracer Bullet. The first slice runs one real order from lookup to page through every layer. The later slices thicken that path.

1. [x] **Thin thread: lookup to page.** Shared order id cookie helpers plus `skf_tracked`; `parseOrderNumberInput`; `orderLookupSchema`; `findLookupOrderId` and `getCustomerOrder` with a database test; `lookupOrder` without limits; `routes.orderTrackWith`; the `/orders/track` page and form with the not found box; `/orders/[number]` with access, the redirects, the header, and `OrderSummary` (zone only, with the `orderSummaryView` change); one Playwright happy path. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-7**, **AC-8**, **AC-10**, **AC-13**, **AC-16**
2. [x] **Rate limits.** The two bindings in `wrangler.jsonc`, `pnpm cf-typegen`, `lookupRateCheck` with the logs, the limited box, and a preview only Playwright check. Satisfies **AC-6**
3. [x] **Status, payment, contact.** Export `PATHS`; `customerTimeline` and the timeline card; badges; the cancelled state; `paymentState` and the payment card; the W7 button; `orderNumberInPath` for `/orders/<n>`. Satisfies **AC-9**, **AC-11**, **AC-12**
4. [x] **Entry points.** "متابعة الطلب" on the confirmation page; the footer link "تتبّع طلبك". Satisfies **AC-14**, **AC-15**
5. [x] **Phone and computer flows.** Playwright on 390 and 1280 for everything in AC-17, the admin redirect, the console spy, and axe on all states. Satisfies **AC-17**

## Consequences

**Positive**:
- A guest can follow their order with no account, and the W5 link works for the customer (after a lookup) and for the owner (straight to the dashboard).
- No migration and no new secret. Access reuses the proven `skf_placed` pattern.
- The customer sees exactly the statuses the owner sets, from the same path rules.

**Negative / tradeoffs**:
- Anyone holding the phone that unlocked an order can reopen it for 30 days. On a shared phone, a family member can see items and status (never the address).
- Workers rate limits are counted per Cloudflare location and are approximate, so a spread out attacker gets somewhat more than 5 tries a minute. It is still far too slow to guess a 9 or 10 digit phone.
- The limiter fails open, so an outage of the binding removes the slowing until it recovers.
- Someone who knows a customer's order number can use up that number's 5 tries a minute and block the real customer's lookup for that minute. This is accepted: keying on number plus IP would give up the protection against guesses spread over many IPs. Even at 7,200 tries a day per number, about 10^7 plausible mobiles stays far out of reach.
- A successful lookup also uses up a try, so a household on one IP looking up more than 5 orders in a minute waits briefly.
- The customer can't check the delivery address on this page. The confirmation page (placer only) and WhatsApp remain the places for that.
- Statuses refresh only on reload.

**Neutral**:
- Spec 0013 AC-2 ("متابعة الطلب" hidden) is replaced by AC-14 here, and its follow up for feature 16 is done by this spec.
- `/orders/[number]` will gain a third access path, the signed in owner (`placed_by_user_id`), in feature 18 or 19.

## Follow-up

- [ ] Feature 17 (cancel before delivery): add the cancel button below the contact button, with its rules, W6, and the "ألغاه العميل" flag.
- [ ] Feature 18 (customer accounts): add the "لديك حساب؟ سجّل الدخول لرؤية كل طلباتك" link on `/orders/track`, and let a signed in owner of the order (`placed_by_user_id`) open the page without a lookup.
- [ ] Feature 23 (electrician price adjustments): the order page shows saved `line_total`, so adjusted prices appear once that feature writes them. Check the option line then.
- [ ] Mark spec 0013's follow up "Feature 16: render `OrderSummary` on `/orders/[number]`…" done when this ships.
- [ ] Update `docs/design/pages/order.md` with the per fulfilment timeline, zone only details, hidden cancel and sign in parts, and the O-13 wording now in use (design source of truth).
- [ ] The bottom bar's "حسابي" tab points to `/account/orders`, which does not exist until feature 19. Decide in feature 18 whether a signed out guest lands on sign in or on `/orders/track`.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
