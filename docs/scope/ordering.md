# Ordering

Part of the [S.K.F Lighting scope](index.md). From cart to a saved order you can manage, including cancellations.

## Slice 3: Cart & checkout

### 12. Cart · done
Review chosen products with their options, change quantities, remove items, and see the total.
**Done when:** the cart keeps its items between visits, the total updates as quantities change, and items that went out of stock are flagged before ordering.
spec [0004](../specs/0004-first-order-end-to-end/index.md) (cart behavior, AC-4, AC-5) · code in `src/features/cart/`, `src/app/[locale]/cart/`
- [x] Build it: `/develop cart`

### 13. Checkout & delivery · in-progress
The order form: full name, phone, area and city or town, a detailed address when delivery is chosen, and optional notes. Choose shop pickup or delivery; the delivery fee (West Bank ₪20, ’48 areas ₪70) is added to the total.
**Done when:** invalid or unrealistic entries are rejected with clear messages in the customer's language, the address is required only for delivery, and the total shows the correct fee for the chosen area.
spec [0012](../specs/0012-checkout-delivery/index.md) · code in `src/features/checkout/`, `src/lib/text-schemas.ts`
- [x] Design it (spec): `/architect checkout & delivery`
- [x] Build it: `/develop checkout & delivery`
  - [x] Realism rules end to end: name, city, and address helpers, Arabic messages, the stricter checkout schema, phone rules pinned (AC-1 to AC-5, AC-9)
  - [x] Form behaviour and bot trap: live recheck after the first send, hidden honeypot field and its server check (AC-7, AC-8, AC-10, AC-11)
  - [x] Phone flows: pickup, delivery to each zone with ₪20 and ₪70, rejections and live clearing, honeypot, axe (AC-6, AC-10, AC-12)
- [ ] Verify it: `/check verify checkout & delivery`
- [ ] Test it: `/test checkout & delivery`

### 14. Order confirmation & WhatsApp · done
After sending, a confirmation page with the order number and summary, WhatsApp opened with the full order message, and a WhatsApp contact button that includes the order number.
**Done when:** every order gets a unique, easy to read order number, the WhatsApp message lists items, options, quantities, fee, and total, and the contact button works on phones and computers.
spec [0013](../specs/0013-order-confirmation-whatsapp/index.md) · code in `src/features/orders/`, `src/features/checkout/`, `src/features/shell/`, `src/app/[locale]/checkout/done/`
- [x] Design it (spec): `/architect order confirmation & whatsapp`
- [x] Build it: `/develop order confirmation & whatsapp`
  - [x] Summary from the saved order: shared photo fragment, `getPlacedOrder` extended, `OrderSummary` card, phone line and keep note (AC-1, AC-2, AC-3, AC-5 to AC-8)
  - [x] Copy button and the W7 float: `CopyOrderNumber`, `orderNumberInPath`, thin client `FabLink` (AC-4, AC-9, AC-11, AC-12)
  - [x] Phone and computer flows: Playwright on 390 and 1280, links, copy, console spy, axe (AC-10, AC-13)
  - [x] Not found hardening: guarded decode on the confirmation page, unknown number and broken segment flows (AC-2, AC-9, AC-13)
- [x] Verify it: `/check verify order confirmation & whatsapp`
- [x] Test it: `/test order confirmation & whatsapp`

## Slice 4: Managing orders

### 15. Order management · in-progress
The dashboard order list and order details: customer details, items, totals, delivery choice, and status changes, with new orders flagged so none is missed.
**Done when:** you can filter orders by status and date, open one to see everything about it, move it through its statuses, and new or cancelled orders stand out until you open them.
spec [0014](../specs/0014-order-management/index.md) · code in `src/features/orders/`, `src/app/admin/(dashboard)/orders/`, `src/features/shell/`
- [x] Design it (spec): `/architect order management`
- [x] Build it: `/develop order management`
  - [x] Status lifecycle and cancel: pure move rules, the delivered check migration, guarded status and cancel actions, the status card and dialog, status badges (AC-1 to AC-5, AC-18)
  - [x] History and contact: the order timeline and the "مراسلة العميل" WhatsApp button (AC-6, AC-7)
  - [x] Unseen flags: dot and "ألغاه العميل", sidebar count behind a time limit, 60 second live refresh (AC-8, AC-14 to AC-16)
  - [x] Filters and search: URL filters for status, unseen, date, type, and pickup or delivery; number and phone search by POST (AC-9 to AC-13, AC-17)
  - [x] Phone and computer flows: Playwright on 390 and 1280, stale tab, live refresh, console spy, axe (AC-19)
- [ ] Verify it: `/check verify order management`
- [ ] Test it: `/test order management`

### 16. Order page & guest lookup · in-progress
A page for each order showing its status and items, with a WhatsApp contact button carrying the order number. Guests reach it with their order number plus phone number.
**Done when:** a guest with the right order number and phone sees their order, wrong pairs show nothing about any order, and repeated wrong attempts are slowed down.
spec [0015](../specs/0015-order-page-guest-lookup/index.md) · code in `src/features/orders/`, `src/app/[locale]/orders/`, `src/features/shell/`, `src/proxy.ts`
- [x] Design it (spec): `/architect order page & guest lookup`
- [x] Build it: `/develop order page & guest lookup`
  - [x] Thin thread: `skf_tracked` cookie, tolerant number and E.164 phone lookup, the track page, the order page with access, redirects, header, and zone only summary (AC-1 to AC-5, AC-7, AC-8, AC-10, AC-13, AC-16)
  - [x] Rate limits: two Workers bindings per IP and per number, the limited box, logs (AC-6)
  - [x] Status, payment, contact: per fulfilment timeline, cancelled state, payment badge, W7 button and float (AC-9, AC-11, AC-12)
  - [x] Entry points: "متابعة الطلب" on the confirmation page, footer "تتبّع طلبك" (AC-14, AC-15)
  - [x] Phone and computer flows: Playwright on 390 and 1280, 307 redirects, admin redirect, console spy, axe (AC-17)
- [ ] Verify it: `/check verify order page & guest lookup`
- [ ] Test it: `/test order page & guest lookup`

### 17. Cancel before delivery · in-progress
Customers cancel an order from its order page at any stage before delivery. The cancellation shows in your dashboard and opens WhatsApp with a cancellation message to you.
**Done when:** the cancel button appears only before delivery, a cancelled order is clearly marked in the dashboard and in the customer's view, and the WhatsApp message includes the order number.
spec [0016](../specs/0016-cancel-before-delivery/index.md) · code in `src/features/orders/`, `src/app/[locale]/orders/[number]/`
- [x] Design it (spec): `/architect cancel before delivery`
- [x] Build it: `/develop cancel before delivery`
  - [x] Thin thread: cutoff rule, the guarded customer cancel write and action with the cookie check, the button and dialog, the dashboard flag end to end (AC-1 to AC-4, AC-9)
  - [x] Tell the shop: W6 hand off once, focus to the badge, refresh on back (AC-5)
  - [x] Cancelled and blocked views: who and when line, green button swap, shipped and paid notes with the request button (AC-7, AC-8)
  - [x] Changes underneath and privacy: stale and failure messages, pending state, the log line (AC-6, AC-10)
  - [x] Phone and computer flows: Playwright on 390 and 1280, wa.me routing, axe (AC-11)
- [ ] Verify it: `/check verify cancel before delivery`
- [ ] Test it: `/test cancel before delivery`

### 35. Dashboard home · needs a decision · from spec 0014
The first dashboard page: a bar saying how many new orders wait, KPI cards (new orders, in preparation, sales this month, unavailable products), the latest orders, and quick actions (`docs/design/pages/admin-home.md`). Until then `/admin` opens the orders.
**Done when:** `/admin` shows the new orders bar only when there are unseen orders, its button opens the list filtered to them, and every KPI matches the orders and products it counts.
- [ ] Design it (spec): `/architect dashboard home`
