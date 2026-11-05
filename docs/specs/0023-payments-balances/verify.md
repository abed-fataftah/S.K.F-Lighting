# Verify: Payments & balances · spec 0023 · updated 2026-11-05
_Steps derived from spec 0023 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Open `/admin/orders/[number]` for a new unpaid order → card "الدفعات" under the totals reads "لا توجد دفعات بعد.", الإجمالي, المدفوع ₪0, المتبقي = total → AC-1
- [ ] Same page → form "تسجيل دفعة", amount prefilled with the total, method "نقداً", date = shop's today with `max` today and `min` the order's shop day → AC-2, AC-3
- [ ] Order with total 0 → no form, no settled line → AC-2
- [ ] Record ₪10 cash with a note → notice "سُجّلت الدفعة." has focus, row shows day · نقداً · ₪10 with the note muted below, المتبقي drops by ₪10, a fresh empty form appears → AC-1, AC-4
- [ ] History shows "المتجر سجّل دفعة ₪10 (نقداً)" and the order is not flagged unseen → AC-10
- [ ] Choose "شيك" → رقم الشيك, البنك, تاريخ الشيك appear; leave the bank empty and submit → "أدخل اسم البنك." under it, field focused, `aria-invalid`, nothing sent → AC-3
- [ ] Switch back to "نقداً" → cheque fields hide and are not sent → AC-3
- [ ] Amount "0", "abc", above the remaining amount, date after today, date before the order day → each shows its message from AC-3; all problems marked at once, first focused → AC-3
- [ ] Type the amount and cheque number in Arabic digits (١٠٠) → accepted → AC-3
- [ ] Pay the rest by cheque → row reads "شيك رقم … · البنك · تاريخه …" (number left to right), "الطلب مدفوع بالكامل." replaces the form → AC-1, AC-2
- [ ] Press "عكس" on the cheque, confirm with no reason → "اكتب سبب العكس."; with a reason → dialog closes, "عُكست الدفعة." takes focus, the amount is struck with "عُكست في {date}: {reason}", the form is back → AC-6
- [ ] History shows "المتجر عكس دفعة …" → AC-10
- [ ] Two tabs on one order, record in both with the page amounts → one succeeds, the other shows "تغيّرت الدفعات في مكان آخر…" and refreshes → AC-7, AC-8
- [ ] Cancel the order in one tab while the payment form is open in another, submit → "تغيّرت حالة الطلب…", refresh shows refund mode → AC-2, AC-7
- [ ] Cancel a paid order → dialog warns "على هذا الطلب دفعات بقيمة …" → cancel still works, card shows "مستحق للعميل" and "تسجيل استرجاع" prefilled with what was paid → AC-5, AC-9
- [ ] Refund half, then the rest → rows read "استرجاع · نقداً" with minus amounts, form disappears at 0 → AC-5
- [ ] Reverse a payment a refund already paid back → "لا يمكن عكس هذه الدفعة: سيصبح المدفوع أقل من صفر." inside the dialog → AC-7
- [ ] `/admin/orders` → column "الدفع" between الحالة and الإجمالي with لم يُدفع / دفعة جزئية / مدفوع / استرجاع مستحق / empty; the select "الدفع" filters each and writes `payment=` after `method=` → AC-11
- [ ] Phone search results show the الدفع column too → AC-11
- [ ] As the customer on `/orders/[number]` with a partial payment → "المدفوع" and "المتبقي" under the badge, no note, no cheque detail; cancelled with money → "مبلغ يُعاد إليك" → AC-12
- [ ] `/account/orders` → same remaining amount as the order page; a cancelled order with money shows "مبلغ يُعاد إليك …", without money no line → AC-13
- [ ] At 390 wide the card stacks with no sideways scroll; at 1280 it sits under the totals → AC-16
- [ ] Keyboard only: fill and submit the form, switch the method, open, fill, confirm, and Escape out of the reversal dialog → AC-16

## Value sourcing
- [ ] Record a payment at 23:30 Asia/Hebron (21:30 or 20:30 UTC) → the date default and `max` are the shop's day, not UTC's; the server accepts that day and refuses the next → AC-3, AC-4
- [ ] An order placed at 00:30 Asia/Hebron → date `min` is that shop day; a payment dated the day before answers before_order even if the browser check is bypassed → AC-4
- [ ] Change `orders.total` in another tab (price cut) between page load and submit → `too_much` names the limit read under the lock, not the page's → AC-4, AC-7
- [ ] A reversal copies amount, method, and cheque fields from its target and gets `received_on` = shop's today → AC-6
- [ ] `recorded_by` and the event actor are the signed in admin's id → AC-4
- [ ] Storefront and My Orders amounts change only with `orders.amount_paid` and `orders.total` → AC-12, AC-13

## Commands
- [ ] `pnpm exec vitest run src/features/payments src/features/orders` → all pass → AC-17
- [ ] `pnpm exec vitest run src/features/payments/server/record.db.test.ts` (local db) → success, duplicates, every refusal, check order, netPaid, append only, every check, the two tab race → AC-8, AC-14, AC-17
- [ ] `pnpm db:check-rls` → passes with `payments` → AC-14
- [ ] `update payments set amount = 1` / `delete from payments` / `truncate payments` in psql → each refused (23001) → AC-14
- [ ] Watch the server log while recording → `payment_recorded` / `payment_refused` lines with ids, kinds, methods, amounts, codes, never a note, reason, cheque number, bank, name, phone, or address → AC-15
- [ ] `pnpm exec playwright test e2e/payments.spec.ts` → passes at 390 and 1280 with axe clean → AC-16, AC-17

## Acceptance-criteria coverage
- AC-1 to AC-3: UI steps 1 to 10 · AC-4: steps 4, value sourcing 1 to 3, 5 · AC-5: steps 15, 16 · AC-6: step 11, value sourcing 4 · AC-7: steps 13, 14, 17 · AC-8: step 13, db tests · AC-9: step 15 · AC-10: steps 5, 12 · AC-11: steps 18, 19 · AC-12: step 20 · AC-13: step 21 · AC-14: commands 2 to 4 · AC-15: command 5 · AC-16: steps 22, 23 · AC-17: commands 1, 2, 6
