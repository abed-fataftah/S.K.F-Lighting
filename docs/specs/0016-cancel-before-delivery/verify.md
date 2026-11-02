# Verify: Cancel before delivery · spec 0016 · updated 2026-10-28
_Steps derived from spec 0016 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Open a `new` order page you placed (390 wide) → "إلغاء الطلب" outline button sits last, below the green contact button; view source has no cancel button → AC-2
- [ ] Same page with JavaScript off → no cancel button, the contact button still works → AC-2
- [ ] Tap "إلغاء الطلب" → dialog titled "إلغاء الطلب <number>؟" (number left to right), the body line, the reason box (300 max), "تأكيد الإلغاء" and "تراجع"; "تراجع" closes it and nothing changes → AC-3
- [ ] Confirm with a reason → both buttons disabled while it runs, then the browser goes to wa.me with "مرحباً، ألغيت الطلب رقم <number> من الموقع." → AC-4, AC-5
- [ ] Press back → badge "ملغي", line "ألغيت هذا الطلب في <date time>" in `<time>`, green button "أخبرنا بالإلغاء عبر واتساب" with the W6 link, no cancel button, no reason anywhere → AC-5, AC-7, AC-10
- [ ] Cancel an order in the dashboard, open it on the customer page → "ألغى المتجر هذا الطلب في …" and the usual "تواصل معنا عبر واتساب" (W7) → AC-7
- [ ] Order at `out_for_delivery` (also a pickup order moved there) → note "طلبك في الطريق إليك…" and "طلب الإلغاء عبر واتساب" with "مرحباً، أريد إلغاء الطلب رقم <number>.", opens in a new tab; works without JavaScript → AC-1, AC-8
- [ ] Order at `ready` with `amount_paid` above 0 → the paid note and the request button; at `out_for_delivery` and paid → the shipped note → AC-1, AC-8
- [ ] Delivered order → neither button nor note → AC-1, AC-8
- [ ] Open the dialog, move the order `new` → `preparing` in the dashboard, confirm → "تغيّرت حالة الطلب…" in the dialog, badge now "قيد التجهيز", reason kept, dialog still open → AC-6
- [ ] With the dialog still open, move it to out for delivery in the dashboard, confirm again → dialog gone, shipped note shown, focus on the header badge, no wa.me visit → AC-6
- [ ] Look up an order from a fresh browser (only `skf_tracked`), cancel it → works the same → AC-4
- [ ] Dashboard after a customer cancel → yellow dot and "ألغاه العميل" on the row, sidebar count up by one, order shows "أُلغي في … بواسطة العميل", "السبب: …", history ends "أُلغي الطلب بواسطة العميل"; opening it clears the dot → AC-9
- [ ] Back from WhatsApp through the browser's back and forward cache → the page shows the current state (refresh on `pageshow`) → AC-5

## Value sourcing
- [ ] Which cancel UI shows: change `status` and `amount_paid` in the database, reload → button, shipped note, paid note, or nothing per `customerCancelState` → AC-1
- [ ] `from` and `orderId`: cancel from a page that shows an old status → `stale`, nothing written → AC-4
- [ ] Who may cancel: call the action with an order id this browser does not hold → `not_found`, no query, nothing written → AC-4
- [ ] Rule inside the lock: record a payment after the page loaded, then confirm → `not_allowed`, nothing written → AC-4, AC-6
- [ ] `cancelled_at` and event time come from the database clock; the line shows them on the shop clock (Asia/Hebron), check near midnight UTC → AC-7
- [ ] `cancelled_by` and `actor_kind` are `guest`, `actor_user_id` and event `seen_at` are null in the database → AC-4
- [ ] Revalidated path is `/orders/<locked order_number>` → the page shows cancelled on the next load → AC-4
- [ ] W6 text and number use `orders.order_number` and `NEXT_PUBLIC_WHATSAPP_NUMBER` → AC-5
- [ ] Green button after a cancel follows `cancelled_by` (W6 for guest, W7 for admin) → AC-7
- [ ] Focus target after a cancel or a refused one is `#order-status` → AC-5, AC-6
- [ ] Request text uses `Shell.whatsappMessages.cancelRequest` with the order number → AC-8
- [ ] Server log after a cancel holds only `event`, `orderId`, `from`; the reason is only in `orders.cancel_reason` → AC-10

## Commands
- [ ] `pnpm exec vitest run src/features/orders` → all pass, database suites not skipped → AC-1, AC-4, AC-6, AC-7, AC-10
- [ ] `pnpm exec playwright test e2e/cancel-order.spec.ts e2e/order-page.spec.ts e2e/order-management.spec.ts` → all pass on phone and desktop → AC-2 to AC-11
- [ ] `E2E_TARGET=preview pnpm exec playwright test e2e/cancel-order.spec.ts` → passes on workerd, sidebar count checked there → AC-9, AC-11

## Acceptance-criteria coverage
- AC-1 `customer-cancel.test.ts`, `admin-status.db.test.ts`, shipped and paid flow · AC-2 cancel flows, `order-page.spec.ts` · AC-3 first cancel flow (dialog, axe) · AC-4 `customer-actions.test.ts`, `admin-status.db.test.ts` · AC-5 hand off in the first two flows · AC-6 the second tab flow, `cancelProblem` unit test · AC-7 back on the page checks, `customer-order.db.test.ts` · AC-8 shipped and paid flow · AC-9 dashboard part of the first flow · AC-10 action log test, read test, console spy · AC-11 all of `cancel-order.spec.ts`
