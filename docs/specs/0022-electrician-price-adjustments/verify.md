# Verify: Electrician price adjustments · spec 0022 · updated 2026-11-04
_Steps derived from spec 0022 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] As the owner (aal2), open `/admin/orders/<number>` of an open electrician order → outline "تعديل الأسعار" shows above the lines table → AC-1
- [ ] Open a customer order and a guest order → no button and no locked line → AC-1
- [ ] Open a delivered and a cancelled electrician order → no button, muted "الأسعار مقفلة بعد التسليم أو الإلغاء." → AC-1
- [ ] Promote the customer of a customer order to electrician, reopen that order → still no button (role saved at placement) → AC-1
- [ ] Press "تعديل الأسعار" → each unit price becomes a 40 high field labelled "سعر الوحدة للسطر N", prefilled; the button hides; "حفظ الأسعار" is disabled → AC-2
- [ ] Type a lower price → the catalog price shows struck beside it, "السعر الأصلي" appears, the line total and totals preview live → AC-2
- [ ] Type text that does not parse → that line keeps its saved total in the preview → AC-2
- [ ] Press "السعر الأصلي" → the field holds the catalog price again → AC-2
- [ ] Press "إلغاء" → edit mode closes, typed values are gone, focus is on "تعديل الأسعار" → AC-2, AC-12
- [ ] Type `٠`, `0.00`, `00` → accepted as a free line; type `١٢٫٥` → ₪12.50 → AC-3
- [ ] Clear a field, save → "أدخل السعر." under it, `aria-invalid`, focus on the first bad field, no request sent → AC-3
- [ ] Type above the catalog price, save → "لا يمكن أن يزيد السعر عن سعر الكتالوج (₪…)." → AC-3
- [ ] Cut two lines with a note, save → "حُفظت الأسعار." (role status), totals updated, focus back on "تعديل الأسعار" → AC-4, AC-12
- [ ] Type "5.0" over a saved ₪5, save → "لم يتغيّر أي سعر." → AC-6
- [ ] Open edit mode in two tabs, save in one, then save in the other → "تغيّرت الأسعار في مكان آخر…", page refreshes, edit mode closes, focus on the notice → AC-6
- [ ] With edit mode open, mark the order delivered in another tab, save → locked notice, page refreshes → AC-6
- [ ] Set `amount_paid` above the new total, save → "الإجمالي الجديد أقل من المبلغ المدفوع (₪…)." with edit mode and values kept → AC-6
- [ ] After a cut, out of edit mode → struck catalog unit price (with hidden "قبل الخصم"), and "قبل الخصم" and "خصم الأسعار" rows above المجموع الفرعي, which add up → AC-7
- [ ] "سجل الطلب" shows "المتجر عدّل الأسعار: الإجمالي من … إلى … (الأسطر المعدّلة: N)" and the note muted below; the order is not flagged unseen → AC-8
- [ ] As the electrician, open `/orders/<number>` → struck catalog line total, "قبل الخصم" and "خصم المتجر" rows, no note anywhere → AC-9
- [ ] Open the same order through the guest lookup → same deal rows → AC-9
- [ ] Checkout confirmation of a new order → no deal rows → AC-9
- [ ] My Orders and the payment card show the new total and remaining balance → AC-9
- [ ] At 390 the lines table scrolls inside its box, fields usable, no page sideways scroll; at 1280 it matches the design page → AC-12
- [ ] Keyboard only: enter edit mode, change every field, reset, save, cancel → AC-12

## Value sourcing
- [ ] Button: flip `orders.placed_by_role` and `status` in the database → button follows `canAdjustPrices` → AC-1
- [ ] Prefill equals `toShekelsInput(order_lines.unit_price)` on a line already cut once → AC-2
- [ ] Struck price and reset value equal `order_lines.catalog_unit_price`, not the current `product_variants.price` (change the variant price first) → AC-2, AC-5
- [ ] Preview on a delivery order includes `delivery_fee` → AC-2
- [ ] `expectedTotal` and `expectedUnitPrice` are the values at edit open (change the total in the database while editing → `stale`) → AC-4
- [ ] Upper bound is the stored `catalog_unit_price` read in the transaction (send a forged higher price through the action → `above_catalog`) → AC-3
- [ ] `line_total = unit_price × quantity` on a line with quantity 3 → AC-4, AC-5
- [ ] `subtotal`, `total` come from `recomputeOrderTotals` (delivery order: total = subtotal + fee) → AC-4, AC-5
- [ ] `below_paid` compares against `orders.amount_paid` → AC-6
- [ ] Change row `old_unit_price` is the price before this save (two saves chain) → AC-4
- [ ] Event `data`: `lineCount` counts only changed lines, `fromTotal` is the total before, `toTotal` after, `note` absent when blank → AC-4
- [ ] Event `actor_user_id` is the signed in admin → AC-4
- [ ] Discount rows equal Σ (catalog − unit) × quantity → AC-7, AC-9
- [ ] History line reads from `order_events.data` → AC-8

## Commands
- [ ] `pnpm db:migrate` then `\d public.order_line_price_changes` → table, two indexes, restrict FKs, RLS on, triggers `order_line_price_changes_no_edit` and `_no_truncate` → AC-10
- [ ] `pnpm db:check-rls` → passes → AC-10
- [ ] `update`/`delete`/`truncate` on `order_line_price_changes` as `postgres` → refused (`23001`) → AC-10
- [ ] Server log after a save → `order_prices_adjusted` with `orderId`, `lineCount`, `fromTotal`, `toTotal`; after a refusal `order_prices_refused` with the code; no note, name, or phone → AC-11
- [ ] `pnpm exec vitest run src/features/orders src/lib/money.test.ts` → green → AC-13
- [ ] `pnpm exec playwright test e2e/price-adjustments.spec.ts --project=phone --project=desktop` → 6 passed → AC-12, AC-13

## Acceptance-criteria coverage
- AC-1 … button, customer/guest, locked, role at placement, value sourcing button · AC-2 … edit mode steps, reset, cancel, preview · AC-3 … digits, empty, above catalog, forged price · AC-4 … save, chained saves, event data · AC-5 … catalog untouched, line totals · AC-6 … no change, stale, locked, below paid · AC-7 … dashboard deal · AC-8 … history · AC-9 … electrician page, lookup, confirmation, My Orders · AC-10 … triggers, RLS · AC-11 … logs · AC-12 … layout, keyboard, axe · AC-13 … Vitest and Playwright commands
