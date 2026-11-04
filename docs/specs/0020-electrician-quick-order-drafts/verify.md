# Verify: electrician quick order & drafts · spec 0020 · updated 2026-11-04
_Steps derived from spec 0020 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Signed out, open `/account/quick-order` → sign in page with `next=/account/quick-order` → AC-1
- [ ] As a customer, open `/account/drafts` → lands on `/account`; no "أدوات الكهربائي" card → AC-1, AC-2
- [ ] As an electrician, `/account` shows "أدوات الكهربائي" with "طلب سريع" and "مسوداتي" → AC-2
- [ ] `/account/drafts` with no drafts → empty card "لا توجد مسودات" and "+ مسودة جديدة" → AC-3
- [ ] On `/account/quick-order`, type "a" and Enter → "اكتب اسماً من حرفين على الأقل."; type "ali / mo" and Enter → address becomes `?draft=<id>` with one empty line → AC-4
- [ ] Create a second draft named "ALI / MO" → "لديك مسودة بهذا الاسم." → AC-4
- [ ] Rename the draft from its page, leave the field → "تم الحفظ"; the list shows the new name → AC-5
- [ ] Type a product code in a line → after a short pause, suggestions with photo, name, code, price; choose one with a single option → the line settles, unit price shows → AC-6, AC-7
- [ ] Choose a product with sizes → "اللون" stays disabled until a size is chosen; an unavailable option shows "(غير متوفر)" and is disabled → AC-6
- [ ] Type a second code quickly in the same line and press Enter before results arrive → nothing old is chosen (only the searching line shows) → AC-7
- [ ] Choose on line 2 the same option as line 1 → "هذا الخيار موجود في السطر 1"; "انتقل إلى السطر 1" focuses line 1's quantity → AC-8
- [ ] Type "٣" in a quantity and Enter → shows 3; type "1500" → 999 → AC-8
- [ ] Add lines to 30 → counter "30 / 30", "+ إضافة سطر" disabled → AC-9
- [ ] Remove line 1 → "تم حذف السطر 1" with "تراجع"; tap it within 5 seconds → the line is back in place → AC-9
- [ ] Customer card: "الطلب لي" fills your name and phone; choose delivery, a zone, city, address → totals show "التوصيل" with the zone fee → AC-10, AC-11
- [ ] Clear one quantity → "سطر واحد لا تدخل في الإجمالي" under the total → AC-11
- [ ] Go offline, change a quantity → "تعذّر الحفظ" with "إعادة المحاولة"; send → "احفظ التغييرات أولاً."; back online → "تم الحفظ" → AC-12
- [ ] With unsaved text, try to close the tab → the browser asks first → AC-12
- [ ] Send with an empty quantity → "أدخل الكمية لهذا السطر." on that line, focus moves there, no order written → AC-13
- [ ] Make a product unavailable in the dashboard → its line shows "غير متوفر", no price, out of the total; send → "بعض الأسطر غير متوفرة…" → AC-13, AC-14
- [ ] Change an option price after loading the draft, then send → "تغيّرت بعض الأسعار…" and the new price shows; send again → succeeds → AC-11, AC-13
- [ ] Send a complete draft → W5 page, WhatsApp text has "الكهربائي: {your name}" on line 2; the draft is gone from the list; the order is in My Orders and typed كهربائي in the dashboard → AC-13, AC-16
- [ ] Delete a draft from the list and from its page → dialog "حذف المسودة «{name}»؟"; confirm → "تم حذف المسودة." → AC-15
- [ ] Delete a product that sits only on a draft (dashboard) → it is archived, the draft line shows "غير متوفر" → AC-17
- [ ] Switch the electrician to customer → drafts unreachable; switch back → drafts are back → AC-18
- [ ] At 390 and 1280 both pages fit one centered 480 px column with no sideways scroll → AC-20

## Commands
- [ ] `pnpm exec vitest run src/features/drafts src/features/checkout/server/placed.test.ts src/lib/routes.test.ts src/server/db/schema/schema.db.test.ts` → all pass → AC-4 to AC-15, AC-21
- [ ] `pnpm db:check-rls` → no finding for `drafts` or `draft_lines` → AC-1
- [ ] `pnpm exec playwright test e2e/quick-order.spec.ts` → all pass (add `--workers=1` on a dev server: the 30 line build times out when tests run side by side); with the combobox open, axe checks only the input and the list → AC-21
- [ ] Watch the server log while using the pages → only `draft_*` and `quick_order_search_failed` events, never a name, phone, address, search text, or person id → AC-19

## Value sourcing
- [ ] Role read fresh: demote in the database, reload the draft page → `/account` without signing out → electrician check
- [ ] Draft list date: edit a draft just after midnight UTC (before midnight Asia/Hebron the day before is wrong) → date shown in shop time → `updated_at` through `formatDate`
- [ ] Another electrician's draft id in the address → redirected to their own list → which draft
- [ ] Live price: change an option price, reload → line and totals show the new price → line price
- [ ] "من {lowest}": product with options at different prices, no option chosen → lowest non archived price → line from price
- [ ] Duplicate position after a removal → the message names the renumbered position → position
- [ ] Search order: an exact option code ranks first and preselects that option → search, `exactOptionId`
- [ ] "الطلب لي" with a profile with no phone → button disabled → customer values
- [ ] Zone deactivated after it was chosen → shows "(غير متاحة)", send refused with `zone_invalid` → zone choices and fee
- [ ] `expectedTotal` differs from server → `price_changed`, nothing written → totals and send
- [ ] Customer name typed with extra spaces → order row stores the tidied name → order customer fields
- [ ] Send twice (double tap, two tabs) → one order, `idempotency_key` = draft id → key and replay
- [ ] Storefront cart has items before sending → still there after → cookies
- [ ] Two sends in a minute past the limit → checkout's rate limit message → rate limit
- [ ] Electrician account deleted after sending → W5 page leaves the electrician line out → W5 line

## Acceptance-criteria coverage
- AC-1 to AC-3, AC-15: UI steps 1 to 4, 23 · AC-4, AC-5: steps 5 to 7 · AC-6 to AC-9: steps 8 to 15 · AC-10, AC-11: steps 15, 16, 21 · AC-12: steps 17, 18 · AC-13, AC-14: steps 19 to 22 · AC-16 to AC-18: steps 22, 24, 25 · AC-19: commands · AC-20, AC-21: step 26 and commands
