# 0013. Order confirmation and WhatsApp

**Date**: 2026-10-27 (amended 2026-10-27: AC-2, AC-3, AC-5, AC-9, AC-13 and the strings, to match the build and close the cross check gaps)
**Status**: Accepted

## Summary

The confirmation page and the new order WhatsApp message already work from spec 0004. This spec finishes feature 14. Below the buttons, the page gets an order summary card: product rows with a photo, options, quantity, and line total; the pickup or delivery details; the notes; and subtotal, fee, and total, all read from the saved order. The phone the customer used is shown next to the order number, because guest lookup (feature 16) will need both. The number gets a copy button. On this page the floating WhatsApp button sends W7 (`مرحباً، بخصوص الطلب رقم <number>.`), so a question about the order always carries its number. The one time hand off to W5 stays the same on phones and computers. No database change.

## Requirements

**User stories**:
- As a customer who just ordered, I want to see what I ordered, where it goes, and what I pay, so I can catch a mistake before the shop calls me.
- As a customer, I want to keep my order number and phone handy, so I can follow the order later.
- As a customer with a question, I want the WhatsApp button to mention my order number, so the shop knows which order I mean.
- As the owner, I want every WhatsApp message about an order to carry its number.

**Acceptance criteria** (these build on spec 0004 AC-11 and AC-12, which stay in force except where a line below changes them):
- **AC-1**: Order number. Every order has a unique number `YY-NNNNN` (`formatOrderNumber`, the year on the shop's clock, spec 0002; `orders.order_number` is unique). Unchanged code; this criterion is checked so it cannot drift. A new pure `isOrderNumber(text)` (`/^\d{2}-\d{5,}$/`) lives beside `formatOrderNumber` in `src/features/orders/order-number.ts`.
- **AC-2**: Page order. `/checkout/done/[number]` shows, top to bottom: the number card, the "ما الخطوة التالية؟" card, the buttons (green "لم يفتح واتساب؟ افتحه من هنا" with W5, then "العودة للتسوق"), then the new "ملخص الطلب" card. The "متابعة الطلب" button stays hidden until feature 16 (spec 0004 follow up). Access is unchanged: only the browser whose `skf_placed` cookie holds the order opens it, anyone else gets the not found page (spec 0004 AC-11). The page decodes the `[number]` segment inside try/catch: a segment that cannot be decoded (a broken `%`, such as `%E0%A4%A`) calls `notFound()` (HTTP 404), never a server error.
- **AC-3**: Number card. Under the dashed number box: a copy button (AC-4), then the line `الهاتف: <customer_phone>` with the phone wrapped in the shared `Ltr` component (the same one as the number box). The message is `Confirmation.phoneLine` "الهاتف: <ltr>{phone}</ltr>", rendered through `t.rich("phoneLine", { phone, ltr: (chunks) => <Ltr>{chunks}</Ltr> })`, the repo's rule for left to right text inside an Arabic sentence (the `<ltr>` tag, `messages.test.ts`). The phone is shown as saved (the typed form after spec 0005 AC-9 cleaning), then the note "احتفظ برقم الطلب ورقم الهاتف لمتابعة الطلب." (replaces "احتفظ بالرقم لمتابعة الطلب."). The name, city, and address are not shown in this card.
- **AC-4**: Copy. An outline icon button with `aria-label="نسخ رقم الطلب"` writes the plain order number (no direction marks) with `navigator.clipboard.writeText`. On success a polite live region says "تم نسخ رقم الطلب"; on a rejected write it says "تعذّر النسخ". The icon is lucide `Copy`. The button renders only after mount (`useSyncExternalStore` with a server snapshot of `false`) and only when `navigator.clipboard?.writeText` exists, so the server HTML never shows a button that cannot work. The live region (`aria-live="polite"`) is always in the page, empty at first, so the first announcement is read; its text stays until the next press. Focus stays on the button.
- **AC-5**: Product rows. The summary lists every `order_lines` row of the order in `sort` order. Each row: a photo tile `size-(--size-tile-order)` (52px token) with `rounded-tile`, the product's first image now, read through `product_id` the same way the cart reads it, as `<Image width={52} height={52} sizes="52px" alt="">` (decorative); the shared `ImagePlaceholder` with tone `(index % 4) + 1` when there is none. Then the copied `product_name`, an option line `<size_label> · <colour_name> · الكمية <quantity>` (for example "كبير · أسود · الكمية 1") with empty parts left out and the quantity through `formatNumber`. The quantity part is the word "الكمية", not "×", because `messages.test.ts` refuses a message with no Arabic letter, and it matches the cart's "الكمية {quantity}", and `line_total` through `formatPrice`. Names come from the copy saved on the line, never the live product. An order always has at least one line (spec 0004), so there is no empty state. Rows use logical CSS only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
- **AC-6**: Pickup or delivery. Below the rows, a "الاستلام" block. Pickup: "استلام من المعرض", then `shop_settings.address` on its own line when it is not blank (no line when it is). Delivery: "توصيل إلى <delivery_zone_name>", then `<city>، <address>` on its own line. All values are the ones saved on the order, except the pickup address, which is the shop's current one.
- **AC-7**: Notes. When `orders.notes` is not null (blank notes are already saved as `null`: `tidiedText({ optional: true })` then `input.notes ?? null`), a "ملاحظات" block shows it as saved, line breaks kept (`whitespace-pre-line`). No block when there are no notes.
- **AC-8**: Totals. "المجموع الفرعي" `orders.subtotal`, "التوصيل" `orders.delivery_fee` (or "بدون رسوم" for pickup), and "الإجمالي" `orders.total` in the larger total style, all through `formatPrice`. There is no discount row; `discount_total` is 0 for every order until loyalty (feature 31) adds one.
- **AC-9**: Float sends W7 here. On `/checkout/done/<number>` where `<number>` passes `isOrderNumber`, the floating WhatsApp button opens `whatsappUrl(NEXT_PUBLIC_WHATSAPP_NUMBER, "مرحباً، بخصوص الطلب رقم <number>.")` in a new tab. The number goes in plain, with no direction marks, the same as W5. On every other path, a number that fails `isOrderNumber`, or a segment that cannot be decoded, it opens W1 as today. A `/checkout/done/<number>` this browser does not own (or an unknown number) gets the root not found page (`src/app/not-found.tsx`, HTTP 404, "الصفحة غير موجودة"). There is no `[locale]/not-found.tsx`, so that page sits outside the shop layout and has no float at all, neither W7 nor W1. This is expected for now; when a designed not found page moves inside the shop layout, `orderNumberInPath` will make its float send W7 with the typed number, which is fine (it reveals nothing and goes only to the shop). The gallery's static float stays W1. The float keeps `aria-label="واتساب"`.
- **AC-10**: W5 is unchanged (a regression check, not new behaviour). The green button and the one time hand off keep sending W5 exactly as spec 0004 AC-12 builds it (items, size and colour, quantities, fee for delivery, notes, total, order link, the short form past 1,800 characters). The hand off rule is the same on every device: drop `wa=1`, then `window.location.assign(W5)` once per order per tab.
- **AC-11**: Phones and computers. Every WhatsApp link on the page (green button, float) is `https://wa.me/<digits>?text=<encoded>` with `target="_blank"` and `rel="noopener"`, so a phone opens the app and a computer opens WhatsApp Desktop or Web through wa.me's own page.
- **AC-12**: Logs. The page logs nothing about the order. Nothing new is written to cookies, `localStorage`, or `sessionStorage` (the existing `skf-wa-<orderId>` mark only).
- **AC-13**: Playwright flows pass on a phone sized RTL screen (390) and on a computer sized one (1280): after a delivery order with notes and a sized, coloured product, the summary shows each row, the zone, city, address, notes, subtotal, fee, and total matching the saved order; after a pickup order it shows "استلام من المعرض" and "بدون رسوم"; the phone line shows the typed phone; the copy button puts the number on the clipboard and the live region reads "تم نسخ رقم الطلب"; the float's link holds W7 with the order number, on `/` it holds W1, another browser opening `/checkout/done/<number>`, any browser opening an unknown number (`99-99999`), and any browser opening a segment that cannot be decoded (`%E0%A4%A`) each get HTTP 404, see "الصفحة غير موجودة", and find no float; the green button's link holds W5; a `page.on("console")` spy sees no order value (number aside), no name, phone, city, or address. The confirmation page passes the axe check for pickup and for delivery.

## Decision

**Chosen option**: Option 1: Thicken the existing page in place.

Keep spec 0004's route, access rule, hand off, and W5 builder. Extend `getPlacedOrder` with the summary values, add a reusable `OrderSummary` card for feature 16 to share, add a small copy button, and make the shared float choose its message from the path.

**Implementation skills**: `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`), `vercel-composition-patterns` (`.agents/skills/vercel-composition-patterns/`, for the shared summary card)

## Feature design

**Data model sketch**: no change and no migration. Reads spec 0002 as built: `orders` (`order_number`, `customer_phone`, `fulfilment`, `delivery_zone_name`, `city`, `address`, `notes`, `subtotal`, `delivery_fee`, `total`), `order_lines` (`product_id`, `product_name`, `size_label`, `colour_name`, `quantity`, `line_total`, `sort`), `product_media` (first `image` by `sort, id`), `shop_settings.address`.

**State transitions**: none.

**API surface** (changes in bold):
| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getPlacedOrder` (`src/features/checkout/server/queries.ts`) | query | `orderNumber` | `PlacedOrder` = `MessageOrder` (unchanged) plus `id`, **`subtotal`**, **`pickupAddress`**, and each line **`imageKey`** | `skf_placed` cookie holds the id | `null` (page calls `notFound()`) |
| **`OrderSummary`** (`src/features/orders/components/order-summary.tsx`) | server component | `{ lines, fulfilment, deliveryZoneName, city, address, pickupAddress, notes, subtotal, deliveryFee, total }` | the "ملخص الطلب" card (AC-5 to AC-8) | none (renders what it is given) | none |
| **`CopyOrderNumber`** (`src/features/checkout/components/copy-order-number.tsx`) | client component | `number` | copy button plus polite live region (AC-4) | none | rejected write shows "تعذّر النسخ" |
| **`WhatsAppFab`** (`src/features/shell/components/whatsapp-fab.tsx`) | stays a server component around a thin client **`FabLink`** | `whatsappNumber`, `static?` | wa.me link with W1 or W7 (AC-9) | none | none |
| **`orderNumberInPath(pathname)`** (`src/features/shell/fab-message.ts`, pure) | function | the locale free path from `usePathname()` in `@/i18n/navigation` | the number, or `null` | none | none |

**`getPlacedOrder` changes**: `MessageOrder` and `buildNewOrderMessage` do not change; `PlacedOrder` only extends it (W5 ignores the extra fields). The order select adds `subtotal`; the line select adds `productId` and `imageKey`. The first image subquery now inlined in `cart-rows.ts` moves into one shared SQL fragment, `firstProductImageKey(productIdColumn)` in `src/features/catalog/server/` (next to the other product reads), used by both `cart-rows.ts` and `getPlacedOrder`, never copied. After the order is found, `getPlacedOrder` calls `readPickupAddress(db)` (same handle) only when `fulfilment = 'pickup'`, else `pickupAddress` is `null`. `order_lines.product_id` is `not null` with `on delete restrict`, so a line always has its product; a product with no image gives `imageKey: null` and the placeholder.

**`orderNumberInPath` rule**: strip one trailing slash; the path must start with the prefix `routes.checkoutDone("")` (so the route map stays the single source of the path shape), and the rest must be exactly one segment (not empty, no `/`); `decodeURIComponent(segment)` inside try/catch (a `URIError` from a broken `%` gives `null`, never a crash on every page); then the number counts only when `isOrderNumber(n)`. There is no equality check against `routes.checkoutDone(n)`, since that would refuse the encoded `26%2D00042` form the tests accept.

**`FabLink`** (`src/features/shell/components/fab-link.tsx`, `"use client"`): reads `usePathname()` from `@/i18n/navigation`, calls `orderNumberInPath`, and builds the text with `useTranslations("Shell")`: `t("whatsappMessages.order", { number })` or `t("whatsappMessages.general")`, then `whatsappUrl(whatsappNumber, text)`. `WhatsAppFab` keeps its markup and classes and passes `static` through; with `static` it renders a plain W1 link and no `FabLink` (the gallery sits outside `[locale]`). The client part is only the link, so the added JavaScript stays small.

`OrderSummary` takes plain props (no query inside), so feature 16's order page passes the same shape from its own query. The option line, the pickup or delivery lines, and the totals rows are built by a pure `orderSummaryView(props, { t, formatPrice, formatNumber })` in `src/features/orders/order-summary-view.ts` (Vitest), shaped like `buildNewOrderMessage`: it takes a translator over `OrderSummary.*` and the formatters as arguments and returns display strings (`{ rows: { name, options, total }[], receive: { title, line, where | null }, notes | null, totals: { subtotal, fee, total } }`); the component only renders them.

**Strings** (`src/i18n/messages/ar.json`):
- `Confirmation.keep` becomes "احتفظ برقم الطلب ورقم الهاتف لمتابعة الطلب."; new `Confirmation.phoneLine` "الهاتف: <ltr>{phone}</ltr>", `Confirmation.copy` "نسخ رقم الطلب", `Confirmation.copied` "تم نسخ رقم الطلب", `Confirmation.copyFailed` "تعذّر النسخ".
- New `OrderSummary` namespace: `title` "ملخص الطلب", `receive` "الاستلام", `pickup` "استلام من المعرض", `delivery` "توصيل إلى {zone}", `deliveryWhere` "{city}، {address}", `notes` "ملاحظات", `subtotal` "المجموع الفرعي", `fee` "التوصيل", `free` "بدون رسوم", `total` "الإجمالي", `quantity` "الكمية {quantity}".
- New `Shell.whatsappMessages.order` "مرحباً، بخصوص الطلب رقم {number}." (W7, handoff section 9).

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Confirmation | which order, and whether it opens | `[number]` param plus `skf_placed` cookie ids (spec 0004) |
| Confirmation | order number in the box and in W7 | `orders.order_number` (box); the path segment after `isOrderNumber` (float) |
| Confirmation | phone line | `orders.customer_phone` |
| Summary | row photo | first `product_media` image of `order_lines.product_id`, by `sort, id`; placeholder when none |
| Summary | row name, size, colour, quantity, line total | `order_lines.product_name`, `size_label`, `colour_name`, `quantity`, `line_total` |
| Summary | pickup address | `shop_settings.address`, trimmed, hidden when blank (`readPickupAddress`) |
| Summary | zone, city, address | `orders.delivery_zone_name`, `city`, `address` |
| Summary | notes | `orders.notes` |
| Summary | subtotal, fee, total | `orders.subtotal`, `delivery_fee`, `total` (never recomputed) |
| Copy | clipboard text | `orders.order_number` |
| Float | message | W7 with the path number, else W1 (`Shell.whatsappMessages`) |
| Float, green button | WhatsApp number | `NEXT_PUBLIC_WHATSAPP_NUMBER` (spec 0004) |
| Green button, hand off | W5 text | `buildNewOrderMessage` over the saved order (spec 0004 AC-12) |

**Key invariants**:
- Every amount on the page is a saved column; nothing is recomputed from live prices.
- Personal data shows only to the placing browser; the float's W7 holds only the number.
- One shared summary card renders the same order the same way on the confirmation page now and the order page later.

**Security model**: unchanged from spec 0004. The phone is shown only on a page the `skf_placed` cookie already guards, which already holds the name, phone, and address in W5. A refused or unknown order gets the root not found page, which has no float. The float reads the number from the URL, so if a later not found page inside the shop layout shows the float, it would offer W7 with that typed number; that message reveals nothing and goes only to the shop.

**Configuration required**: none.

**Critical test scenarios**:
- `isOrderNumber`: `26-00042` and `26-123456` pass; `2600042`, `26-0042`, `26-00042x`, an empty string fail (unit), verifies **AC-1**
- `orderNumberInPath`: `/checkout/done/26-00042` and `/checkout/done/26-00042/` give the number; an encoded segment `26%2D00042` is decoded first; `/checkout/done/abc`, `/checkout/done/%E0%A4%A` (broken encoding, no throw), `/checkout/done/26-00042/x`, `/checkout`, `/`, `/cart` give `null` (unit), verifies **AC-9**
- Confirmation page: a segment that cannot be decoded (`/checkout/done/%E0%A4%A`) and an unknown number (`99-99999`) both give HTTP 404 with no float, never a 500 (Playwright), verifies **AC-2**, **AC-9**, **AC-13**
- `FabLink`: on the confirmation path the link holds W7 with the number and no direction marks; elsewhere W1 (component or Playwright), verifies **AC-9**
- `orderSummaryView`: option line with size and colour, only one, and none; pickup with and without a shop address; delivery line; notes present and absent; pickup fee shows "بدون رسوم" (unit), verifies **AC-5** to **AC-8**
- `getPlacedOrder`: returns subtotal, pickup address only for pickup, and the first image per line, and `null` without the cookie (database test), verifies **AC-2**, **AC-5**, **AC-6**
- Copy: success announces "تم نسخ رقم الطلب" and the clipboard holds the number; a rejected write announces "تعذّر النسخ"; no button without the Clipboard API (component or Playwright with clipboard permission), verifies **AC-4**
- Full flows on 390 and 1280 as AC-13, plus the W5 link unchanged, verifies **AC-2**, **AC-3**, **AC-9** to **AC-11**, **AC-13**
- Logs and storage: placing and viewing writes no new storage keys, and a `page.on("console")` spy sees no name, phone, city, or address (Playwright), verifies **AC-12**
- W5 regression: the existing `buildNewOrderMessage` tests and the hand off flow still pass unchanged, verifies **AC-10**

## Build plan

Tracer Bullet: the thread already runs end to end (spec 0004), so each step thickens it through every layer.

1. [x] **Summary from the saved order.** `isOrderNumber`; the shared `firstProductImageKey` fragment (cart switched to it); `getPlacedOrder` gains `subtotal`, `pickupAddress`, and line `imageKey`, with a database test; pure `orderSummaryView` with Vitest; the `OrderSummary` card and its strings; the card placed after the buttons; the phone line and the new keep note. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-6**, **AC-7**, **AC-8**
2. [x] **Copy and the W7 float.** `CopyOrderNumber` with its live region; pure `orderNumberInPath` with Vitest; the thin client `FabLink` inside `WhatsAppFab` choosing W7 or W1; the W7 string. Satisfies **AC-4**, **AC-9**, **AC-11**, **AC-12**
3. [x] **Phone and computer flows.** Playwright on 390 and 1280 for pickup and delivery, the summary values, the copy, the float and the green button links, and axe on both. Satisfies **AC-10**, **AC-13**
4. [ ] **Not found hardening (from the 2026-10-27 amendment).** Guard the page's `decodeURIComponent` with try/catch and `notFound()`; add the unknown number and the broken segment to the Playwright flow (404, no float). Satisfies **AC-2**, **AC-9**, **AC-13**

## Consequences

**Positive**:
- The customer can check the whole order right away, from the same saved numbers the shop sees.
- Every WhatsApp contact from this page names the order, with no second green button to confuse.
- `OrderSummary` and the path based float are ready for the order page (feature 16): it passes the same props and adds its route to `orderNumberInPath`.

**Negative / tradeoffs**:
- On a long order the summary sits far down the page; it is placed last on purpose so the reopen button stays high.
- The photo is the product's current first image, not a copy from order time; if the owner changes or removes photos, an old order shows the new one or the placeholder.
- On a computer the hand off leaves the confirmation page for wa.me's page; the back button returns to it.
- The float's link becomes a small client component (`FabLink`), adding a little JavaScript to every storefront page.

**Neutral**:
- Spec 0004 AC-11 stays the record of what slice 1 shipped; this spec changes its keep note and adds the summary, phone, copy, and W7 float.

## Follow-up

- [ ] Feature 16: render `OrderSummary` on `/orders/[number]`, add that route to `orderNumberInPath`, and show the "متابعة الطلب" button here.
- [ ] Feature 31 (loyalty coins): add a discount row to `OrderSummary` once `discount_total` can be above 0.
- [ ] When the designed not found page (`docs/design/pages/not-found.md`) is built, decide whether it sits inside the shop layout; if it does, its float sends W7 on a `/checkout/done/<number>` path, and the AC-13 flow must change from "no float" to W7.
- [ ] Update `docs/design/pages/confirmation.md` with the summary card, the phone line, and the W7 float (design source of truth).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
