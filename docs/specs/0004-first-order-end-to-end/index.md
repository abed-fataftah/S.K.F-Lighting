# 0004. First order end to end (Slice 1 tracer bullet)

**Date**: 2026-10-19
**Status**: In Progress

## Summary

This is the thinnest real path through the whole shop. You sign in to the dashboard with your password and an authenticator code, add one simple product (name, code, category, price), and a guest finds it, puts it in a cart, fills a short form, and sends the order. The order is saved in one step, WhatsApp opens with a ready message (W5), and the order shows up in your dashboard. The cart lives in a cookie (a small piece of data the browser keeps and sends back), so every page renders on the server with live prices, and the customer always agrees to the exact total they send.

## Requirements

**User stories**:
- As the owner, I want to sign in safely and add a product in under a minute, so that I can sell it right away.
- As a guest, I want to find a product, add it to a cart, and send my order without making an account, so that buying is quick.
- As a guest, I want WhatsApp to open with my order already written, so that I only press send.
- As the owner, I want every order saved and flagged in the dashboard, so that nothing depends on the customer pressing send.

**Acceptance criteria**:
- **AC-1**: Admin sign in. `/admin/login` takes email and password (no Google). A user whose `profiles.role` is not `admin` is signed out again and sees one generic refusal message. An admin with no verified TOTP factor is sent to `/admin/mfa` to enroll (QR code plus the secret as text, then a 6 digit code); an admin with one is asked for a 6 digit code. Each enroll first removes the user's unverified factors, so a reload never piles them up; the second device spec 0001 asks for is added by scanning the same QR code (or secret) on both devices during that first enrollment. After a correct code the action redirects at once to `next` (only a path that starts with `/admin`, with no `//`, scheme, or backslash, checked by a pure `safeAdminNext(next)`) or `/admin/orders`; `next` travels as a search param on `/admin/login` and `/admin/mfa`. Only after that (`aal2`) do `/admin` pages open. `requireAdmin()` (role `admin` and `aal` claim `aal2`) runs in the dashboard layout **and** inside every admin Server Action; a call without it gets `{ ok: false, error: "forbidden" }` and changes nothing. A sign out button ends the session. `pnpm admin:promote <email>` and `pnpm admin:mfa-reset <email>` exist and work as the runbook says; `admin:promote` fails with a clear message when the user or profile is missing, and `admin:mfa-reset` removes every factor and signs the user out of all sessions. Failed password attempts are limited by Supabase Auth, not by this app.
- **AC-2**: Add a product. `/admin/products/new` takes name (2 to 120 characters), code, category, and price. The code is trimmed and uppercased, must match `^[A-Z0-9][A-Z0-9-]{0,29}$`, and must be unique (a taken code shows "this code is used" on the field). Category is a select of existing categories plus an optional "new category name" (2 to 60 characters); when a new name is typed it wins over the select; a new name that matches an existing category's name (trimmed) reuses that category instead of making a second one; neither gives `category_required`. A new category is top level with `sort = 0` and `is_visible = true`. Price is typed in shekels with up to 2 decimals (Arabic Indic digits and `٫` are turned into Western digits and `.` first), above 0 and at most ₪1,000,000, and stored as integer agorot. Saving creates one `active`, available product with `slug = buildProductSlug(name, code)` and exactly one default variant (no size, no colour, the price), then shows a success notice with a link to its product page and a way to add another. Changed later: spec 0008 AC-17 removed the "new category name" field, so the editor only picks an existing category, and categories are made on `/admin/categories` (spec 0008 AC-2: slug from `nextFreeSlug`, `sort` one above its siblings). The category rules in this AC are the record of what this slice shipped, not the current behaviour.
- **AC-3**: Find the product. `/` shows a temporary grid (until feature 25) of up to 24 active products that have a sellable variant, newest first: placeholder image, name, list price. Each card links to `/p/[slug]`. The product page shows name, code (in `dir="ltr"`), price, a quantity stepper (1 to 99), and an add to cart button. A product that is not `active` returns the not found page; one with no sellable variant shows as out of stock with the add button disabled.
- **AC-4**: Cart. Adding to cart writes the httpOnly cookie `skf_cart`. Adding a variant already in the cart adds to its quantity, capped at 99. The cart holds at most 30 lines; a 31st line is refused with a clear message. `/cart` lists each line with name, code, size and colour when present, live unit price, a quantity stepper, remove, and line total, plus the subtotal and a button to checkout. The header and bottom bar cart count shows the number of lines. An empty cart shows the empty state from `cart-empty.md`.
- **AC-5**: Unsellable lines. A line whose variant is no longer sellable (missing, product not `active` or not available, variant not available or archived) is shown as "غير متوفر" with a remove button on `/cart` and `/checkout`, and checkout cannot be sent while it is there. If it becomes unsellable during submit, the server refuses with the same message and saves nothing.
- **AC-6**: Checkout form. Fields: full name (2 to 80), phone (must pass `normalizePhone`, else the "mobile number" message from spec 0002), method (pickup by default, or delivery), and notes (optional, up to 500). Delivery adds zone (active `delivery_zones`, first by `sort` preselected), city or town (2 to 60), and detailed address (5 to 300). All text is trimmed first; line breaks are removed from name, city, and address (notes may keep them). The schema is a discriminated union on the method: for pickup, any sent zone, city, or address is dropped. With no active zone, the delivery option is disabled and the server answers `zone_invalid`. The "لديك حساب؟ سجّل الدخول" link and signed in prefill from `checkout.md` are not rendered in this slice (feature 18). Errors show inline per field, focus moves to the first invalid field, and the server validates with the same Zod schema. The summary shows each line, subtotal, the delivery fee (or "بدون رسوم"), and the total, and updates when the method or zone changes.
- **AC-7**: Place the order. One transaction reads the variants, writes the `orders` row (number from `allocateOrderNumber`, line copies, totals from `computeOrderTotals`, `placed_by_*` null, `city` null for pickup), the `order_lines` in cart order, and a `created` event with `actor_kind = guest`. Then the cart cookie is cleared, the order id is added to the `skf_placed` cookie, and the browser goes to `/checkout/done/[number]`.
- **AC-8**: Stale price. The form sends the total it showed. If the server's total (from live prices, the cart cookie's quantities, and the chosen zone's live fee) differs, nothing is saved, the action returns the fresh cart and the fresh zone list, the summary refreshes from them, a notice says "الطلب تغيّر" (it also covers quantities changed in another tab), and the customer can press send again with the same idempotency key.
- **AC-9**: No duplicates. The checkout page renders one random `idempotencyKey` per attempt. A second submit with the same key (double tap, or a retry after a lost response) returns the order already saved and goes to its confirmation page, without a second order, even after the cart cookie was cleared or from another tab: the replay ignores the sent fields, adds the order id to `skf_placed`, and clears the cart. The key stays the same after a field error or `price_changed`, and a fresh checkout render (after a successful order) makes a new one. The submit button is disabled and shows "جارٍ إرسال الطلب" while sending.
- **AC-10**: Spam limit. More than 5 order submissions in 60 seconds from one IP address get "try again in a minute" and save nothing. Every call that passes Zod counts, replays included. The binding is present under `next dev` (through `initOpenNextCloudflareForDev()`) and `pnpm preview`; with no `cf-connecting-ip` the key is one shared `local`. If the binding is ever missing or throws, the limit fails open (a broken limiter never stops sales) and logs `{"event":"order_rate_unchecked"}` once per process outside production. The fail open rule is proven by the `checkOrderRate` unit tests (no limiter, a throwing limiter); the limit and the per IP keys are proven on workerd with `E2E_TARGET=preview`.
- **AC-11**: Confirmation page. `/checkout/done/[number]` opens only in a browser whose `skf_placed` cookie holds that order's id; anyone else gets the not found page. It shows the number in the dashed box (`dir="ltr"`), the three next steps, a green "لم يفتح واتساب؟ افتحه من هنا" button with W5, and "العودة للتسوق". On the first arrival right after placing (the `wa=1` flag), a client component first drops the flag with `router.replace`, then sends the tab to the W5 link once with `window.location.assign`; a `sessionStorage` mark (in try/catch) per order guards against a back button or page cache replay. The W5 text is built on the server from `getPlacedOrder` and passed to that component. The "متابعة الطلب" button stays hidden until feature 16 builds the order page. The h1 takes focus on load.
- **AC-12**: W5 message. Built from the saved order (not the cart), opened as `whatsappUrl(NEXT_PUBLIC_WHATSAPP_NUMBER, text)`, with exactly these lines in order: `طلب جديد رقم <number>`; `الاسم: <name>`; `الهاتف: <phone as typed, after the number field cleaning of spec 0005 AC-9>`; `الاستلام: استلام من المعرض` or `الاستلام: توصيل إلى <zone>، <city>، <address>`; one line per product `<name> | <size> | <colour> | الكمية <qty> | <line total>` with the size and colour parts left out when empty; `التوصيل: <fee>` for delivery only; `ملاحظات: <notes>` only when notes exist; `الإجمالي: <total>`; `رابط الطلب: <NEXT_PUBLIC_SITE_URL>/orders/<number>`. Lines are joined with `\n`, no trailing newline; notes go in as saved (tidied per spec 0005 AC-10). If the full encoded wa.me URL would pass 1,800 characters, the message drops the product lines and keeps the number, name, phone, pickup or delivery line, total, and order link (the owner has the full order in the dashboard). This W5 supersedes the handoff proposal (O-25), which showed a per line price.
- **AC-13**: Owner sees the order. `/admin` goes to `/admin/orders`, which lists orders newest first, 50 per page, with number, name, phone, method, total, time (`formatDateTime`, in `Asia/Hebron`, spec 0005), and a "جديد" badge while its `created` event is unseen. A `page` that is missing, not a number, or below 1 reads as 1. Links to an order use `prefetch={false}`, so a prefetch never marks it seen. `/admin/orders/[number]` shows customer details, method, zone, city, address, notes, every line (copied name, code, size, colour, quantity, unit price, line total), subtotal, fee, and total, and opening it sets `seen_at` on that order's events.
- **AC-14**: Prices everywhere (pages, summary, W5, dashboard) come from one pure `formatPrice(agorot)`: Western digits, `₪` before the number with no space, comma thousands, no decimals unless the amount has them (`₪20`, `₪1,250`, `₪19.90`). The full rule and its edge cases are spec 0005 AC-2.
- **AC-15**: Logs never hold a customer name, phone, city, address, or notes. Placing an order logs one JSON line (`{ "event": "order_placed", orderNumber, lineCount, total }`) and nothing else about it. Failures log only the error code and field names, never input values or Zod issue values.
- **AC-16**: On a phone sized right to left screen, one Playwright flow passes end to end: the admin signs in with a TOTP code and adds a product, a guest finds it on `/`, adds it, checks out, lands on the confirmation page, and the WhatsApp link holds the order number; the admin then sees the order flagged "جديد". Every new page passes the axe check.

## Decision

**Chosen option**: Option 1: server rendered slice with a cookie cart and Server Actions

Every slice 1 page renders on the server; the cart is an httpOnly cookie that only Server Actions write; placing an order is one Server Action and one database transaction that refuses a changed total and returns the same order for a repeated idempotency key; the admin path is the full spec 0001 sign in with TOTP.

**Implementation skills**: `supabase`, `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/`) · `wrangler`, `workers-best-practices` (`cloudflare/skills`, `.agents/skills/`) · `vercel-react-best-practices`, `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

Pages build to `docs/design/pages/` (`home.md` only for the shell around the temporary grid, `product.md`, `cart.md`, `cart-empty.md`, `checkout.md`, `confirmation.md`, `admin-orders.md`, `admin-order-details.md`, `admin-product-editor.md` for the four fields it keeps, `sign-in.md` for the login form look) and `docs/design/design.md`, with the shell from spec 0003. Anything those pages draw that this slice leaves out (photos, options, filters, statuses, payments) is simply not rendered.

**Data model sketch**:

One additive migration (`drizzle/`, generated, plus hand written checks):

| Table | Change | Rules |
|---|---|---|
| `orders` | `city` drops `not null` | New check: `fulfilment <> 'delivery' or btrim(coalesce(city, '')) <> ''`. Pickup orders store `null`. Old code always wrote a city, so nothing running breaks. |
| `orders` | add `idempotency_key uuid` | Nullable, unique. Written once at placement; never updated. |

No new tables. Everything else uses spec 0002 as it is: `products`, `product_variants` (one default variant), `categories` (top level, `parent_id` null, slug from `slugify(name)` with `-2`, `-3` on a clash), `delivery_zones`, `shop_settings`, `orders`, `order_lines`, `order_events`, `order_number_counters`, `profiles`.

Cookies (not tables):

| Cookie | Holds | Flags | Written by |
|---|---|---|---|
| `skf_cart` | JSON `[{ "v": "<variant uuid>", "q": <1..99> }]`, at most 30 entries, in cart order | httpOnly, `SameSite=Lax`, `Secure` outside localhost, `Path=/`, 30 days | cart Server Actions; cleared by `placeOrder` |
| `skf_placed` | JSON array of the last 5 order uuids this browser placed | httpOnly, `SameSite=Lax`, `Secure` outside localhost, `Path=/` (so `placeOrder` on `/checkout` can read the list it adds to), 7 days | `placeOrder` |

`Secure` is set when `NODE_ENV === "production"`. Both are parsed by pure codecs that drop anything malformed (bad JSON, a non uuid, a quantity outside 1 to 99, duplicates merged, extra entries cut) instead of throwing, so a tampered cookie can only empty a cart. Reading never writes: `readCart` and the layout only parse (Next throws on a cookie write during render); the cleaned cookie is written by the next cart action, which always rewrites it whole.

**State transitions**: an order is created in `new` (spec 0002). No transitions in this slice; statuses are feature 15.

**API surface** (Server Actions return `{ ok: true, data } | { ok: false, error }`; inputs validated with the shared Zod schemas in each feature's `schemas.ts`):

| Action / route | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `signInAdmin` (`src/features/admin-auth/server/actions.ts`) | Server Action | `email`, `password` | redirect to `/admin/mfa` | public | `invalid_credentials`, `not_admin` (both shown as one generic message) |
| `enrollTotp` | Server Action | none | `{ factorId, qrSvg, secret }` | signed in, role admin, `aal1` | `already_enrolled` |
| `verifyTotp` | Server Action | `factorId`, `code` (6 digits) | redirect to `next` (an `/admin` path only) or `/admin/orders` | signed in, role admin | `invalid_code` |
| `signOut` | Server Action | none | redirect to `/admin/login` | signed in | none |
| `requireAdmin()` (`src/server/auth/admin.ts`) | server helper | none | `{ userId }` | role `admin` and `aal2`; actions call `getVerifiedUser()` first | layout: redirect to `/admin/login` or `/admin/mfa`; action: `forbidden` |
| `listCategoriesForForm` (`src/features/catalog/server/queries.ts`) | query | none | `{ id, name }[]` by `sort`, `name` | `requireAdmin()` | none |
| `createProduct` (`src/features/catalog/server/actions.ts`) | Server Action | `name`, `code`, `categoryId?`, `newCategoryName?` (removed by spec 0008 AC-17), `price` (string) | `{ productId, slug }` | `requireAdmin()` | `code_taken`, `category_required`, field errors |
| `listHomeProducts` | query | none | up to 24 `{ slug, name, listPrice }` | public | none |
| `getProductBySlug` | query | `slug` | product, its sellable default variant or null | public | not found |
| `addToCart` (`src/features/cart/server/actions.ts`) | Server Action | `variantId`, `quantity` | `{ lineCount }` | public | `not_sellable`, `cart_full` |
| `setCartQuantity` | Server Action | `variantId`, `quantity` | `{ lineCount }` | public | none (unknown id ignored) |
| `removeFromCart` | Server Action | `variantId` | `{ lineCount }` | public | none |
| `readCart` (`src/features/cart/server/queries.ts`) | query | the cookie | `{ lines: { variantId, productName, productCode, slug, sizeLabel, colourName, unitPrice, quantity, lineTotal, sellable }[], subtotal, hasUnsellable }` | public | none |
| `getCheckoutOptions` (`src/features/checkout/server/queries.ts`) | query | none | active zones `{ id, name, fee }[]`, `pickupAddress` | public | none |
| `placeOrder` (`src/features/checkout/server/actions.ts`) | Server Action (`useActionState` form) | `idempotencyKey` (uuid), `name`, `phone`, `fulfilment`, `zoneId?`, `city?`, `address?`, `notes?`, `expectedTotal` (agorot); lines and quantities come from the `skf_cart` cookie, not the form | on success no result: `redirect(checkoutDone(number) + "?wa=1")`; on failure `{ ok: false, error }` | public, rate limited | `rate_limited`, `cart_empty`, `not_sellable`, `price_changed` (with the fresh cart), `zone_invalid`, field errors |
| `getPlacedOrder` (`src/features/checkout/server/queries.ts`) | query | `number`, the `skf_placed` cookie | the order with lines, or null | cookie must hold its id | not found |
| `listAdminOrders` (`src/features/orders/server/admin-queries.ts`) | query | `page` (1 based) | 50 rows `{ number, name, phone, fulfilment, total, placedAt, isNew }`, `hasNext` | `requireAdmin()` | none |
| `getAdminOrder` | query, then marks seen | `number` | order, lines, events | `requireAdmin()` | not found |
| `scripts/admin-promote.ts` | `pnpm admin:promote <email>` | email | sets `profiles.role = 'admin'` | `DATABASE_URL_DIRECT` | user not found |
| `scripts/admin-mfa-reset.ts` | `pnpm admin:mfa-reset <email>` | email | deletes that user's MFA factors, then signs them out of every session | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | user not found |

Admin pages read with `getClaims()`; every admin write calls `getVerifiedUser()` then `requireAdmin()`. Admin queries above also call `requireAdmin()` themselves, so a page that forgets the layout guard still leaks nothing. `getClaims()` is cached per request, so `verifyTotp` checks nothing after `mfa.verify()`; it redirects, and the next request sees `aal2`. A factor removed by `admin:mfa-reset` is cut off by the sign out it does, not by waiting for the token to expire.

**`placeOrder` steps, in this order**:
1. Parse the input with the checkout schema (field errors return here).
2. Rate limit by `cf-connecting-ip` (`rate_limited`).
3. Look up an order by `idempotency_key`. Found: add its id to `skf_placed`, clear `skf_cart`, redirect to its confirmation. This runs before any cart check, so a replay works with an empty cart.
4. Parse `skf_cart` (`cart_empty` when no lines).
5. Open the transaction. Read the variants with their products and colours, and the chosen zone. Any unsellable line → `not_sellable`; a missing or inactive zone → `zone_invalid`; server total `!==` `expectedTotal` → `price_changed` with the fresh cart and zones. Nothing is written before these pass.
6. `insert into orders (...) values (...) on conflict (idempotency_key) do nothing returning id`, with the number from `allocateOrderNumber` taken just before it. No row back means a concurrent submit with the same key won: roll back and treat it as step 3. The number lock is held only for the inserts, which stay last.
7. Insert the lines (in cart order) and the `created` event, then commit.
8. After commit: set `skf_placed`, clear `skf_cart`, log `order_placed`, and call `redirect(routes.checkoutDone(number) + "?wa=1")` last, outside any `try/catch` and outside the transaction callback (the cookies set before it travel with the redirect).

Pure modules (no database, unit tested without mocks):
- `src/lib/money.ts`: `formatPrice(agorot)` (AC-14) and `parseShekels(text)` (string to agorot by string arithmetic, never floats; `null` for anything invalid, more than 2 decimals, 0 or below, or above 100,000,000 agorot).
- `src/features/cart/cart-cookie.ts`: `parseCart(raw)`, `serializeCart(lines)`, `addLine(lines, variantId, qty)` (merge, cap 99, refuse a 31st line), `setQuantity`, `removeLine`.
- `src/features/checkout/schemas.ts`: the checkout Zod schema (AC-6), with `normalizePhone` as the phone refinement.
- `src/features/checkout/placed-cookie.ts`: `parsePlaced`, `addPlaced(ids, id)` (newest first, keep 5).
- `src/features/orders/whatsapp-message.ts`: `buildNewOrderMessage(order, siteUrl)` returns the W5 text (AC-12).
- `src/features/catalog/schemas.ts`: the product form schema (AC-2), using `parseShekels`.
- `src/features/catalog/sellable.ts`: `isSellable(product, variant)`, the one sellable rule (spec 0002).
- `src/features/admin-auth/next-path.ts`: `safeAdminNext(next)` (AC-1).

**Value sourcing** (spec 0002's *Place order* rows still apply; this adds what slice 1 needs):

| Action | Value | Source |
|---|---|---|
| Admin sign in | role | `profiles.role` for `getClaims().sub` |
| Admin sign in | assurance level | `aal` claim from `getClaims()`; next step from `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` (`nextLevel`) |
| MFA enroll | QR code, secret | `supabase.auth.mfa.enroll({ factorType: "totp" })` |
| Create product | `code` | input, trimmed, uppercased |
| Create product | `slug` | `buildProductSlug(name, code)` |
| Create product | `category_id` | input `categoryId` (this slice also took `newCategoryName`; spec 0008 AC-17 removed it) |
| Create category | `slug` | moved to spec 0008 AC-2: `nextFreeSlug(slugify(name) or "qism", taken)`, `sort` one above its siblings (this slice used `slugify(name)` plus `-2`, `-3`, and `sort = 0`) |
| Create product | variant `price` | `parseShekels(price input)` |
| Create product | `status`, `is_available`, variant `is_default` | `active`, `true`, `true` (slice 1 rule; feature 7 adds the controls) |
| Home grid | list price | lowest sellable variant `price` (spec 0002) |
| Product page | variant to add | the product's default variant if sellable, else its first sellable variant by `sort`; none → out of stock |
| Cart page | unit price, names, sellable | live `product_variants`, `products`, `colours` rows for the cookie's variant ids |
| Cart count | line count | number of entries in the parsed `skf_cart` cookie |
| Checkout | zone list and fees | `delivery_zones` where `is_active`, by `sort` |
| Checkout | pickup address line | `shop_settings.address`; when null the line shows only "بدون رسوم" |
| Checkout | shown total (and `expectedTotal`) | `readCart().subtotal` + fee of the chosen zone (0 for pickup), computed in the browser from server values |
| Place order | server total | `computeOrderTotals` over live prices plus `delivery_zones.fee` for `zoneId` |
| Place order | stale check | server total `!==` `expectedTotal` → `price_changed` |
| Place order | `idempotency_key` | input `idempotencyKey`, made by the `/checkout` Server Component on render with `crypto.randomUUID()` and sent as a hidden field; the page is dynamic, never cached |
| Place order | `quantity` | the `skf_cart` cookie read by the action (this replaces spec 0002's "form input" source for this slice) |
| Place order | `customer_name`, `city`, `address`, `notes` | inputs after trimming and line break removal (AC-6) |
| Place order | `customer_phone`, `customer_phone_e164` | the input as typed after `digitsField` cleaning (tidy, Western digits; spec 0005 AC-9); `normalizePhone(phone)` |
| Place order | `placed_by_user_id`, `placed_by_role` | `null`, also when someone is signed in, in this slice (customer accounts are feature 18) |
| Place order | `created` event `data` | `{}` |
| Place order | `product_id`, line copies, `catalog_unit_price`, `unit_price`, `line_total`, `sort` | as spec 0002's *Place order* rows: copies from the rows read in the transaction, `unit_price = catalog_unit_price`, `sort` = position in the cookie |
| Checkout | shown total after `price_changed` | the fresh cart and zones returned in the error result, kept in the form component's state; `expectedTotal` is a hidden field derived from that state with the pure `computeOrderTotals` |
| Product page | slug lookup | the route param after `decodeURIComponent` (Arabic slugs arrive percent encoded); links built with `routes.product(slug)` |
| Product page, home grid, cart | sellable | one shared pure predicate `isSellable(product, variant)` (spec 0002's definition), used by every read and by `placeOrder` |
| Product card, product page | image | the `ImagePlaceholder` component from spec 0003 |
| Admin list | page | `page` search param, clamped to 1 or more; page links from `routes` |
| Place order | rate limit key | `cf-connecting-ip` request header; missing (local dev) → `"local"` |
| Place order | `city` | input for delivery; `null` for pickup |
| Place order | `area` | `null` (no field in slice 1) |
| Confirmation | which orders may open | `skf_placed` cookie ids |
| Confirmation | auto open | `wa=1` search param, removed with `router.replace` after the one hand off |
| W5 | every field | the saved `orders` and `order_lines` row values; link base `NEXT_PUBLIC_SITE_URL`; number `NEXT_PUBLIC_WHATSAPP_NUMBER` |
| W5 | line amount | `order_lines.line_total` |
| Admin list | `isNew` | an `order_events` row of type `created` for the order with `seen_at is null` |
| Admin list, detail | shown time | `placed_at` through `formatDateTime` in `SHOP_TIME_ZONE` (`Asia/Hebron`, spec 0005) |
| Admin detail | marks seen | `update order_events set seen_at = now() where order_id = $1 and seen_at is null` |

**Key invariants**:
- Spec 0002's invariants hold (totals, line copies, `created` event in the same transaction, number allocated inside the transaction).
- An order is saved only when the server total equals `expectedTotal`, every line is sellable, and the cart has 1 to 30 lines with quantities 1 to 99.
- One `idempotency_key`, at most one order (unique index). The action never relies on catching a unique violation (that aborts the transaction); it looks the key up first and inserts with `on conflict (idempotency_key) do nothing` (see *`placeOrder` steps*).
- A delivery order has a zone, a city, and an address (DB checks); a pickup order has none of them and a fee of 0.
- The cookies hold only ids and quantities, never a price, a name, or a phone.
- Every admin Server Action and admin query calls `requireAdmin()`; no admin data is read before it passes.

**Security model**:
- Guests: may read active products, write their own cart cookie, place an order (rate limited), and open the confirmation of an order whose id their own `skf_placed` cookie holds. Sequential order numbers alone open nothing.
- Admin: role `admin` plus `aal2`, checked in the layout and inside every admin action and query (spec 0001). Admin login errors never say whether the email exists.
- Personal data (name, phone, city, address, notes) is shown only on the confirmation page to the placing browser and in the dashboard; it is never logged and never stored in `order_events.data` (spec 0002).
- Server Actions get Next's built in origin check (CSRF protection); the cookies are httpOnly and `SameSite=Lax`.
- The database stays locked as spec 0002 sets it; the new column changes no grants, and `pnpm db:check-rls` still passes.

**Configuration required**:
- `ORDER_RATE_LIMITER`: a Workers rate limiting binding in `wrangler.jsonc` (`"ratelimits": [{ "name": "ORDER_RATE_LIMITER", "namespace_id": "<unique number>", "simple": { "limit": 5, "period": 60 } }]`), then `pnpm cf-typegen`. Read through `getCloudflareContext().env`.
- `NEXT_PUBLIC_SITE_URL`: already in `.env.example`; now parsed in `src/lib/public-env.ts` (a valid absolute URL, no trailing slash) and used for the W5 order link.
- `NEXT_PUBLIC_WHATSAPP_NUMBER`: already parsed; used for W5.
- `SUPABASE_SERVICE_ROLE_KEY`: already listed in spec 0001; used by `admin:mfa-reset` only.
- Supabase TOTP enroll and verify are already on in `supabase/config.toml`; production needs the same in the dashboard (add to `docs/runbooks/supabase-production.md`).
- Test only: the `otpauth` dev dependency, so Playwright can make TOTP codes from the enrolled secret. A Playwright global setup creates the test admin on the local Supabase (service role, email confirmed), promotes it, and enrolls a TOTP factor through the API, keeping the secret in memory for the run; codes are made right before each verify, retried once on the next 30 second step. Tests find elements by role or `data-testid`, not by Arabic text, and axe runs with the WCAG 2.1 AA tags.
- Every new path (`/p/[slug]`, `/cart`, `/checkout`, `checkoutDone`, `/admin/*`) is built from `src/lib/routes.ts` (all already listed); the orders list page param is added there.

**Critical test scenarios**:
- Happy path: admin signs in with TOTP, makes a category on `/admin/categories` (spec 0008) and adds a product in it, guest orders it for delivery, lands on the confirmation page, the W5 link holds the number, admin sees it flagged and the flag clears on opening, verifies **AC-1**, **AC-2**, **AC-3**, **AC-7**, **AC-11**, **AC-13**, **AC-16**
- Stale price: change the variant price between rendering checkout and submitting; nothing is saved and the summary shows the new total, verifies **AC-8**
- Retry: submit twice with the same `idempotencyKey`; one order exists and both calls return its number, verifies **AC-9**
- Concurrency: two different carts submit at the same moment; both save with consecutive numbers, verifies **AC-7**
- Unsellable: hide the product while it is in the cart; cart and checkout mark it and submit is refused, verifies **AC-5**
- Validation: each field's limits, a landline phone, delivery without city or address, pickup ignoring a sent city, verifies **AC-6**
- Cart limits: merge to 99, 31st line refused, tampered cookie emptied, verifies **AC-4**
- Rate limit: the 6th submit in a minute is refused, verifies **AC-10**
- Auth/permission: a customer signs in at `/admin/login` and is refused; an admin at `aal1` cannot open `/admin/orders`; calling `createProduct` without `aal2` returns `forbidden` and creates nothing; another browser opening `/checkout/done/<number>` gets not found, verifies **AC-1**, **AC-11**
- W5 text: pickup and delivery, with and without notes, size, and colour; a 30 line cart falls back to the short form under 1,800 characters; a newline typed in the name cannot add a line, verifies **AC-6**, **AC-12**, **AC-14**
- Replay: clear the cart cookie, then resubmit with the used key; the same order comes back, verifies **AC-9**
- MFA: reload `/admin/mfa` three times before enrolling; only one factor exists after verifying; `safeAdminNext` refuses `//evil.com` and `/admin\\x`, verifies **AC-1**
- Logs: placing an order logs no phone or address, verifies **AC-15**

## Build plan

Tracer Bullet: first one guest order travels through every layer on seeded data, then the admin side joins, then each part thickens.

1. **Pure rules and the migration.** `formatPrice`, `parseShekels`, the cart and placed cookie codecs, the checkout and product schemas, `buildNewOrderMessage`, each with Vitest tests; the `orders` migration (`city` nullable with the delivery check, `idempotency_key` unique) plus a database test for the new check; parse `NEXT_PUBLIC_SITE_URL`. Satisfies **AC-6**, **AC-9**, **AC-12**, **AC-14**
2. **Thin thread: one guest order on the dev seed.** Temporary grid on `/`, `/p/[slug]`, cart actions and `/cart`, `/checkout` with `placeOrder` (transaction, stale check, idempotency, cookies), `/checkout/done/[number]` with the one time W5 hand off; database tests for `placeOrder`; a Playwright flow from `/` to the WhatsApp link on a phone screen. Satisfies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-11**, **AC-12**, **AC-15**
3. **Admin sign in.** `/admin/login`, `/admin/mfa` (enroll and verify), `requireAdmin()` in `src/server/auth/admin.ts` and the dashboard layout, sign out, `admin:promote` and `admin:mfa-reset` scripts, runbook updates; unit tests for the guard decisions and Playwright with `otpauth`. Satisfies **AC-1**
4. **Owner adds the product, then sees the order.** `/admin/products/new` with inline category creation (later moved to `/admin/categories`, spec 0008); `/admin` redirect, `/admin/orders` with paging and the "جديد" badge, `/admin/orders/[number]` marking seen; the rate limit binding on `placeOrder`; the full Playwright flow and axe on every new page. Satisfies **AC-2**, **AC-10**, **AC-13**, **AC-16**

## Consequences

**Positive**:
- One real order proves auth, the database, the transaction rules, cookies, and WhatsApp work together on Workers before any part gets wide.
- Server rendered cart and checkout show live prices with no loading flicker, and the customer always agrees to the total they send.
- Every later storefront feature (cart 12, checkout 13, confirmation 14) thickens code that already exists instead of starting fresh.

**Negative / tradeoffs**:
- A cookie cart does not follow a signed in customer to another device; that waits for a later decision if customers ask.
- The cart cookie rides along on every request (at most about 1.6 KB), and reading it in the shell for the cart count keeps every storefront page dynamic (already the rule in spec 0001). After a cart action the page refreshes so the count updates.
- A shared mobile carrier IP may hit the 5 per minute limit for unrelated customers; acceptable at this shop's volume.
- Supabase TOTP has no backup codes; the owner must scan the QR code on two devices at first setup.
- The confirmation page only opens in the browser that placed the order; a customer who switches phones must wait for the order page (feature 16).
- A customer whose price changed must press send a second time.
- The temporary home grid and the four field product form are thrown away or replaced by features 25 and 7.
- The W5 link points at `/orders/[number]`, which shows not found until feature 16 ships.
- On a desktop browser the one time hand off moves the tab to wa.me; the customer uses back to return.

**Neutral**:
- One additive migration on `orders`.
- New Workers binding `ORDER_RATE_LIMITER`; rate limiting is per Cloudflare location and approximate, which is fine for spam, not for exact quotas.
- The limit is live under `next dev` too, on one shared `local` key, so more than 5 local order submits a minute (by hand or by tests) are refused until the 60 second window passes. Today the dev e2e flows submit at most 5 orders in a run (exactly the limit), so one more order submitting flow would start failing locally on the sixth; only the workerd `rate-limit` Playwright project spends six on purpose, and it runs last.
- New feature folders: `src/features/cart/`, `src/features/checkout/`, `src/features/admin-auth/`; additions to `catalog/` and `orders/`.
- New strings for every page go in `src/i18n/messages/ar.json`; the design page copy keys are proposals, not required names.

## Follow-up

- [ ] Feature 5 (Arabic language) may change `formatPrice`; that is a one function change plus snapshot updates.
- [ ] Feature 13 revisits the checkout rules here (area field, Turnstile if spam appears, signed in prefill).
- [ ] Feature 16 builds `/orders/[number]`; then show the "متابعة الطلب" button on the confirmation page.
- [ ] Feature 7 replaces the four field form with the full editor; feature 25 replaces the temporary grid.
- [ ] Add the TOTP setting and the rate limit binding to `docs/runbooks/supabase-production.md` and the deploy notes.
- [ ] Creating the first admin: until feature 18 builds sign up, create the owner's user in the Supabase dashboard (Authentication, Add user, auto confirm), then run `pnpm admin:promote`. Update `docs/runbooks/admin-mfa.md` to say so.
