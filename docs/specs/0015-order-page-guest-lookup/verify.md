# Verify: Order page & guest lookup · spec 0015 · updated 2026-10-28
_Steps derived from spec 0015 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Open `/orders/track` on a 390 wide screen → h1 "تتبّع طلبك", the intro line, "رقم الطلب" (`dir="ltr"`, numeric keyboard, placeholder `26-00123`), "رقم الهاتف" (`type="tel"`), yellow "تتبّع الطلب", the limit note, no sign in link, `noindex` → AC-1
- [ ] Open `/orders/track?number=2600042` → the number field reads `26-00042`; `?number=abc` → the field is empty → AC-1
- [ ] Turn JavaScript off, look up a real order → you land on its page; a miss shows the box with both values kept → AC-1, AC-5
- [ ] Look up one order four times: `26-00042`, `2600042`, `٢٦-٠٠٠٤٢`, `26 00042` (use the real number) → each lands on `/orders/<YY-NNNNN>` → AC-2
- [ ] Look it up with `0599123456`, `+970599123456`, `٠٥٩٩١٢٣٤٥٦`, `059 912 3456` (the order's phone) → each matches → AC-3
- [ ] After a match, check the cookies → `skf_tracked` is httpOnly, SameSite Lax, holds that order's id first, 30 days; the address bar shows the parsed number, never what you typed → AC-4
- [ ] Try a wrong phone, a wrong number, and an unknown number → the same red box "لم نجد طلباً بهذه البيانات…" each time, both fields keep what you typed, no `skf_tracked` cookie → AC-5
- [ ] Send `26/00042` and `123` → errors under each field, no box, focus on the number field → AC-5
- [ ] On preview (workerd), send six quick tries from one browser → the sixth shows "تجاوزت عدد المحاولات المسموح…", even with the right pair; the log line is `{"event":"order_lookup_limited","by":"ip"}` with no number, phone, or IP → AC-6
- [ ] Six quick tries on one number from different IPs (`cf-connecting-ip`) → the sixth is limited `by: "number"` → AC-6
- [ ] In a fresh browser, request `/orders/<n>` → HTTP 307 to `/orders/track?number=<n>`; `/orders/abc` and `/orders/%E0%A4%A` → 307 to plain `/orders/track`; never 404 or 500 → AC-7
- [ ] Signed in as the owner (no order cookie), open `/orders/<n>` → you land on `/admin/orders/<n>` → AC-7
- [ ] The order page and its redirects send `Cache-Control` with `private` and `no-store` on preview → AC-7
- [ ] On a delivery order → h1 "طلب <n>" with the number left to right, the status badge, and `<date> · توصيل إلى <zone>` → AC-8
- [ ] Walk a delivery order through every status in the dashboard, reloading the customer page each time → five steps, done ones checked, the current one yellow with "الحالة الحالية" and `aria-current="step"`; "جاهز للتوصيل" on delivery, "جاهز للاستلام" on pickup → AC-9, AC-16
- [ ] Set a pickup order to `out_for_delivery` in the database → "جاهز للاستلام" is current, "تم التسليم" upcoming → AC-9
- [ ] Cancel an order → badge "ملغي", the timeline is one line "تم إلغاء هذا الطلب", the payment card has no badge → AC-9, AC-11
- [ ] The summary on a delivery order shows only "توصيل إلى <zone>"; a pickup order shows the shop address; no city, address, name, phone, or notes anywhere in the page source → AC-10, AC-13
- [ ] Set `amount_paid` to 0, part of the total, and the total → "لم يُسجَّل دفع", "دفعة جزئية", "مدفوع" → AC-11
- [ ] The green "تواصل معنا عبر واتساب" and the float both open `wa.me` with "مرحباً، بخصوص الطلب رقم <n>.", new tab, `rel="noopener"`; on `/orders/track` the float sends W1; no cancel button → AC-12
- [ ] With the console open through a whole lookup and order view → no phone, name, city, or address is logged → AC-13
- [ ] On a confirmation page → yellow "متابعة الطلب" sits between the green button and "العودة للتسوق" and opens the order page → AC-14
- [ ] On any shop page → the footer shows "تتبّع طلبك" before the policy links and opens `/orders/track` → AC-15
- [ ] axe on the lookup page, its error state, and the order page for pickup, delivery, and cancelled, at 390 and 1280 → no violations → AC-17

## Value sourcing
- [ ] Number to match: type it with Arabic digits and no dash → the match still works (from `parseOrderNumberInput`)
- [ ] Phone to match: save an order with `+970…` and look it up with `05…` → match (both through E.164)
- [ ] IP limiter key: two browsers with different `cf-connecting-ip` each get 5 tries; without the header, all share the `"local"` bucket
- [ ] Number limiter key: the parsed number, so `2600042` and `26-00042` spend the same allowance
- [ ] Id put in the cookie: the `orders.id` of the matched order, not the number
- [ ] Prefilled number: `?number=٢٦٠٠٠٤٢` fills `26-00042`
- [ ] Which order opens: holding only `skf_placed` for order A, `/orders/<B>` redirects; holding A in `skf_tracked`, A opens
- [ ] Admin redirect: a signed in non admin customer is sent to the lookup, not the dashboard
- [ ] Header date: an order placed at 23:30 UTC shows the next day's date (shop clock, Asia/Hebron)
- [ ] Timeline and badge: change `status` in the database → the page follows on reload
- [ ] Summary amounts: change a product's catalog price → the order page still shows the saved `line_total` and totals
- [ ] Payment badge: from `amount_paid` against `total` only
- [ ] Contact: the W7 text uses the saved `order_number` and `NEXT_PUBLIC_WHATSAPP_NUMBER`

## Commands
- [ ] `pnpm exec vitest run src/features/orders src/features/shell src/i18n` → all pass → AC-2 to AC-6, AC-9 to AC-12
- [ ] `pnpm exec playwright test e2e/order-page.spec.ts` → 14 pass on `next dev` → AC-1 to AC-17
- [ ] `E2E_TARGET=preview pnpm exec playwright test e2e/order-page.spec.ts` → all pass on workerd, `private` in `Cache-Control` → AC-6, AC-7, AC-17

## Acceptance-criteria coverage
- AC-1 lookup page steps · AC-2 number forms · AC-3 phone forms · AC-4 cookie and redirect · AC-5 misses and format errors · AC-6 six tries, by number · AC-7 cold 307, broken segment, admin, cache header · AC-8 header · AC-9 timeline, off path, cancelled · AC-10 zone only summary · AC-11 payment states · AC-12 W7 and W1 · AC-13 page source and console · AC-14 confirmation button · AC-15 footer · AC-16 reload after a status change · AC-17 axe and the Playwright commands
