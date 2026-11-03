# Verify: Customers & roles · spec 0019 · updated 2026-11-03
_Steps derived from spec 0019 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

Sign in as the owner at `aal2` unless a step says otherwise. Try each step on a 390 wide screen and a 1280 wide one.

- [ ] Signed out, open `/admin/customers` → you land on the owner sign in → AC-1
- [ ] Signed in as a customer, open `/admin/customers` → you land on the owner sign in → AC-1
- [ ] Open `/admin/customers/<the owner's own profile id>` → not found page; the owner never appears in the list or in search → AC-1
- [ ] Open the sidebar's العملاء link → h1 "العملاء", newest account first, columns الاسم, الهاتف, الدور, الطلبات; the link stays active on a customer page → AC-2
- [ ] Give one account a cancelled order and one open order → its الطلبات column reads ١, not ٢ → AC-2
- [ ] With more than 50 accounts, open `?page=2`, then `?page=abc` → page 2 lists the next accounts; `abc` reads as page 1 → AC-2
- [ ] Search a full phone typed in Arabic digits, with and without +970 or the leading 0 → the same single account each time; the URL never holds the text → AC-3
- [ ] Search the account's email in upper case → found → AC-3
- [ ] Search `0599` (a partial number) → "اكتب اسماً أو بريداً أو رقم هاتف كاملاً." → AC-3
- [ ] Search a name typed with أ where the account has ا, or ه where it has ة → found → AC-3
- [ ] Search something that matches nobody → "لا يوجد عميل مطابق."; "مسح البحث" returns to the paged list → AC-3
- [ ] Open a customer → name h1, role badge, details card with الاسم, الهاتف, البريد الإلكتروني, تاريخ التسجيل; "مراسلة العميل" links to `wa.me/<phone_e164>` with the greeting → AC-4
- [ ] Open `/admin/customers/not-a-uuid` and a random uuid → not found → AC-4
- [ ] Give a customer one delivered order (partly paid), one open order, and one cancelled one → الطلبات ٢; المشتريات is the delivered order's total; المتبقي is only what is left on the delivered order → AC-5
- [ ] Customer with more than 20 orders → 20 rows, "تم عرض ٢٠ من N طلب", "عرض المزيد" jumps to row 21; cancelled orders are listed too → AC-6
- [ ] Promote a customer → dialog text, confirm, toast "تم تحويل الحساب إلى كهربائي.", the role badge changes, a history line "تحويل من عميل إلى كهربائي" → AC-7, AC-13
- [ ] Open the same customer in two tabs, promote in one, then promote in the other → "تغيّر دور هذا الحساب في مكان آخر. حدّث الصفحة."; the dialog stays open; no second event row → AC-7
- [ ] As the promoted user, reload `/account` → the "حساب كهربائي" badge shows; place an order → the dashboard order list types it كهربائي, while their earlier order stays عميل → AC-8, AC-9
- [ ] Demote back → the badge goes away on the user's next load of `/account` → AC-8, AC-9
- [ ] Edit details with a bad phone → the field error, and focus moves to the phone field → AC-10
- [ ] Edit only the phone → "تم حفظ البيانات.", a history line "تعديل الهاتف"; save again with no change → no new history line → AC-10, AC-13
- [ ] On an order page whose customer is registered → "عرض العميل" opens that customer; a guest order and the owner's own order show no link → AC-14
- [ ] Remove a customer with an open order → "لا يمكن الحذف: لدى العميل طلبات لم تُسلَّم أو تُلغَ بعد." → AC-11
- [ ] Remove a customer whose delivered order is not fully paid → "لا يمكن الحذف: على العميل مبلغ متبقٍ." → AC-11
- [ ] Remove a customer whose orders are all delivered and paid → you land on the list with "تم حذف الحساب."; their order page still exists, with no "عرض العميل" link → AC-11, AC-14
- [ ] Make the login delete fail (for example, stop Supabase Auth after step 1) → the page shows "لم يكتمل حذف هذا الحساب."; the list marks the row "حذف غير مكتمل"; the role, edit, and remove cards are hidden → AC-12
- [ ] While the removal is pending, the user saves their profile → "هذا الحساب قيد الحذف."; their next order is a guest order → AC-12
- [ ] Press "إكمال الحذف" once Auth is back, then press it again in a second tab → both end on the list with the notice → AC-12
- [ ] Throttle the network and open the list and a customer page → skeletons with a hidden "جارٍ التحميل..." → AC-16
- [ ] Run axe on the list, the customer page, and each dialog → no violations; every control at least 44 by 44; no sideways scroll at 390 → AC-18

## Value sourcing

- [ ] The registered date in the details card → the shop's local date (Asia/Hebron), not UTC: register an account at 23:30 UTC and check that the date shown is the next day → Value sourcing: registered date
- [ ] The email in details and in search → `auth.users.email` (change it in Supabase and reload) → Value sourcing: email
- [ ] The phone in the list → as the user typed it (`profiles.phone`), not E.164 → Value sourcing: name, phone
- [ ] Owed → only delivered orders with `amount_paid < total`; an open unpaid order adds nothing → Value sourcing: owed
- [ ] The role change actor → `account_events.actor_user_id` is the owner's id → Value sourcing: actor
- [ ] An `account_events` row after edits and a removal → no name, phone, or email in any column → Key invariants

## Commands

- [ ] `pnpm db:check-rls` → passes, `account_events` included → AC-17
- [ ] `pnpm exec vitest run src/features/customers src/features/accounts src/lib/phone.test.ts src/lib/routes.test.ts src/features/checkout/server/placed-by.test.ts` → all pass, none skipped with the local database up → AC-18
- [ ] `pnpm exec playwright test e2e/admin-customers.spec.ts` → passes on phone and desktop → AC-18
- [ ] Server logs during the e2e run → only event names and codes (`admin_customer_*`), never a name, phone, email, or search text → AC-15

## Acceptance-criteria coverage

- AC-1 steps 1 to 3 · AC-2 steps 4 to 6 · AC-3 steps 7 to 11 · AC-4 steps 12, 13 · AC-5 step 14 · AC-6 step 15 · AC-7 steps 16, 17, 19 · AC-8 and AC-9 steps 18, 19 · AC-10 steps 20, 21 · AC-11 steps 23 to 25 · AC-12 steps 26 to 28 · AC-13 steps 16, 21 · AC-14 steps 22, 25 · AC-15 log command · AC-16 step 29 · AC-17 RLS command · AC-18 step 30 and the test commands
