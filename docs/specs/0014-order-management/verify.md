# Verify: Order management · spec 0014 · updated 2026-10-28
_Steps derived from spec 0014 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Sign in at `/admin/login` as an admin with a code (`aal2`). Check each step at 390 and at 1280 wide.

- [ ] Open a new pickup order → header and status card show the badge جديد (yellow `new` variant); primary button reads قيد التجهيز → AC-1, AC-5
- [ ] Tap the primary button three times → badge goes قيد التجهيز, جاهز, تم التسليم; focus lands on the badge after each move; "قيد التوصيل" is never offered → AC-2, AC-3, AC-5
- [ ] On the delivered order → "اكتمل الطلب في <date · time>", no button or menu left in the card → AC-5
- [ ] Open a new delivery order, "خيارات أخرى" → "انقل إلى جاهز" → badge جاهز; menu now offers "رجوع إلى قيد التجهيز"; take it → badge قيد التجهيز (back follows the path, not the history) → AC-2, AC-5
- [ ] Keep going on that order → قيد التوصيل then تم التسليم → AC-2
- [ ] Open the same order in two tabs, move it in tab B, then tap the primary button in tab A → tab A shows "تغيّرت حالة الطلب من مكان آخر. حدّثنا الصفحة لتظهر الحالة الحالية." and the status from tab B; only one new history line → AC-3, AC-5
- [ ] "إلغاء الطلب" → dialog title "إلغاء الطلب <number>؟" with the number left to right; "تراجع" closes it and nothing changes → AC-4
- [ ] Cancel with a reason that has extra spaces → badge ملغي; "أُلغي في … بواسطة المتجر"; "السبب: <tidied reason>"; no controls left → AC-4, AC-5
- [ ] Cancel with a blank reason → no "السبب" line → AC-4
- [ ] "سجل الطلب" lists استلمنا الطلب, then "المتجر نقل الطلب إلى …" per move, then "أُلغي الطلب بواسطة المتجر", oldest first, each with a shop clock time → AC-6
- [ ] "مراسلة العميل" opens wa.me with the customer's number and exactly "مرحباً <name>، معك S.K.F للإنارة بخصوص طلبك رقم <number>. حالة الطلب الآن: <status>." with no price and no address → AC-7
- [ ] `/admin/orders` columns read رقم الطلب, العميل, الهاتف, النوع, الاستلام, الحالة, الإجمالي, التاريخ; no payment column; note "الطلبات التي لم تفتحها بعد مميّزة بنقطة صفراء." under the table → AC-8
- [ ] An order you have not opened has the yellow dot with hidden text "لم يُفتح"; opening it and coming back by the "العودة للطلبات" link clears the dot at once → AC-8, AC-14, AC-16
- [ ] An order cancelled by its customer (insert the event with `cancelAsCustomer` in `e2e/orders.ts`) shows the dot and "ألغاه العميل"; after opening it, the dot goes and the badge stays → AC-8, AC-14
- [ ] Status chips: الكل plus the six statuses; each narrows the list; جديد also shows a `confirmed` row → AC-1, AC-9
- [ ] "لم تُفتح" toggle combines with a status chip → AC-9, AC-12
- [ ] Date chips كل الأيام, اليوم, آخر 7 أيام, هذا الشهر; each narrows the list and the line under the filters reads "من <from> إلى <to>" → AC-10
- [ ] Only "من" filled and applied → line "من <from>"; only "إلى" → "حتى <to>"; من after إلى → swapped → AC-10
- [ ] النوع كهربائي shows only electrician orders; عميل shows guests, customers, and shop placed orders → AC-11
- [ ] الاستلام توصيل / استلام من المعرض narrow by method → AC-11
- [ ] Every filter survives a reload and the back button; changing a filter returns to page 1; previous and next keep the filters → AC-12
- [ ] `/admin/orders?status=confirmed&range=year&from=2026-02-30` shows the plain list (bad values ignored) → AC-1, AC-12
- [ ] `/admin/orders?type=electrician&page=999` redirects to `/admin/orders?type=electrician` → AC-12
- [ ] Filters that match nothing → "لا توجد طلبات تطابق هذه الفلاتر." with "مسح الفلاتر" → AC-12
- [ ] Search a full number → opens the order; a short number (`42`) → opens `26-00042`; an unknown number → "لا يوجد طلب بهذا الرقم." → AC-13
- [ ] Search a phone (`059 …`, `+970…`, or nine digits without the 0) → "نتائج البحث عن هذا الرقم" with that phone's orders, any status; the address bar never shows the phone; "مسح البحث" brings the list back → AC-13
- [ ] Search text → "اكتب رقم طلب أو رقم هاتف صحيحاً." → AC-13
- [ ] On `E2E_TARGET=preview`: the الطلبات sidebar link shows the count badge (+99 above 99) and is named "الطلبات، <N> لم تُفتح" → AC-15
- [ ] Leave a list tab idle: a new order appears with its dot within about a minute, no reload; typing in a field or an open dialog delays the refresh → AC-16
- [ ] Signed out or as a customer: every dashboard page sends you to sign in; the actions return `forbidden` and write nothing → AC-17

## Value sourcing checks
- [ ] Type label: an order with `placed_by_role` null and one with `admin` both show عميل; `electrician` shows كهربائي → AC-11
- [ ] Date filter "today": place an order between 00:00 and 03:00 Hebron time (still yesterday in UTC) → it is in اليوم → AC-10
- [ ] This month across the summer time change (24 October): هذا الشهر on 28 October includes an order placed 1 October 00:30 Hebron time (UTC+3 then) → AC-10
- [ ] Status card controls come from `orderMoves(fulfilment, status)`: a pickup order at جاهز offers only تم التسليم and the step back → AC-2
- [ ] `delivered_at` is set by the database clock on delivered, and the check refuses it on any other status → AC-3, AC-18
- [ ] `cancelled_by = 'admin'` and the event's `actor_user_id` are the signed in admin's → AC-4
- [ ] Short form year: the search uses the shop year on the server (`shopYear`), so `42` on 1 January 00:30 Hebron time means `27-00042` in 2027 → AC-13
- [ ] Sidebar count is one per order however many unseen events it has → AC-15

## Commands
- [ ] `pnpm db:migrate` then the check is live: `select conname from pg_constraint where conname = 'orders_delivered_check'` returns one row → AC-18
- [ ] `pnpm exec vitest run src/features/orders src/lib/format.test.ts src/lib/routes.test.ts src/server/db/schema/schema.db.test.ts` → all pass (local Supabase running) → AC-1 to AC-18
- [ ] `pnpm exec playwright test e2e/order-management.spec.ts` → 18 passed on phone and desktop → AC-19
- [ ] `E2E_TARGET=preview pnpm exec playwright test e2e/order-management.spec.ts` → the sidebar count checks run and pass on workerd → AC-15, AC-19
- [ ] Server logs during the flows hold only ids, statuses, and the search kind: no name, phone, address, notes, reason, or search text → AC-17

## Acceptance-criteria coverage
- AC-1 status label and badge steps, status chips, bad params · AC-2 pickup, delivery, skip and back · AC-3 moves, stale tab, delivered_at · AC-4 cancel steps · AC-5 status card steps · AC-6 history · AC-7 contact link · AC-8 columns, dot, ألغاه العميل · AC-9 status and unseen chips · AC-10 date chips, custom range, value checks · AC-11 type and method · AC-12 URL, paging, empty state, redirect · AC-13 search steps · AC-14 unseen dot · AC-15 preview badge, count per order · AC-16 idle refresh · AC-17 access and logs · AC-18 migration check · AC-19 Playwright commands
