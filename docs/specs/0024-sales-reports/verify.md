# Verify: Sales reports · spec 0024 · updated 2026-11-06

_Steps derived from spec 0024 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Signed out, open `/admin/reports` → sent to `/admin/login?next=%2Fadmin%2Freports`, no number shown → AC-1
- [ ] Sign in as the owner (aal2), open `/admin/reports` → one `h1` "التقارير", tab title "التقارير", "هذا الشهر" chip has `aria-current="page"`, range line "من 01/<month>/<year> إلى <today>" → AC-1, AC-2
- [ ] Open `/admin/reports?range=week` → same as no range (this month), no message → AC-2
- [ ] Click each chip (اليوم، آخر 7 أيام، آخر 30 يوماً) → address `?range=today|7d|30d`, range line shows today, today − 6, today − 29 to today → AC-2
- [ ] Click "فترة مخصصة" → form under the chips, both fields prefilled with this month's days, `max` = today, no error → AC-3
- [ ] Submit from after to → "تاريخ البداية بعد تاريخ النهاية." under "من", `aria-invalid` on it, typed days kept, cards and range line show this month → AC-3
- [ ] Submit to after today → "لا يمكن أن تكون النهاية بعد اليوم." under "إلى"; submit 367 days → "أقصى فترة سنة واحدة (366 يوماً)." under "من"; 366 days ending today → accepted → AC-3
- [ ] Submit only "من" → "أدخل تاريخ النهاية." under "إلى" → AC-3
- [ ] Custom range with a partly paid delivery order, a paid pickup order, and a cancelled one → sales = the two totals with "منها رسوم توصيل ₪<fee>", orders 2 with "وأُلغي طلب واحد", average half up to the agora, collected with "المتبقي ₪<sales − collected>" → AC-4, AC-5
- [ ] Same range → one bar per day, the bars with sales on the right days, chart `aria-label` states sales, order count, and days; the hidden table lists every day → AC-6
- [ ] Range longer than 62 days → title "المبيعات حسب الشهر", one bar per month, labels like "11/2026" readable, the chart box scrolls sideways inside its card → AC-6, AC-13
- [ ] Top products → up to 10 rows by quantity, current product names linked to the product editor, code beside each, note "قيمة المنتجات قبل الخصم ورسوم التوصيل." → AC-7
- [ ] Empty period → cards ₪0, 0, —, ₪0, card "لا توجد طلبات في هذه الفترة." replaces chart and table, "تصدير" still works → AC-8
- [ ] Click "تصدير" → file `skf-sales-<from>-to-<to>.csv` opens in Excel with Arabic intact, one row per order (cancelled too, "لا" and empty المتبقي), no phone or address column; a name starting with `=` shows a leading `'` → AC-9
- [ ] In the CSV, filter "يُحتسب في المبيعات" = نعم and sum الإجمالي and المدفوع → equal the sales and collected cards → AC-9, AC-10
- [ ] Slow the database or break it → skeleton cards while loading; on error the alert card "تعذّر تحميل التقارير." with "حاول مرة أخرى" that reloads → AC-11
- [ ] At 390 wide → cards in one column, chips wrap, date fields full width, no page scrolls sideways; at 1280 → four cards in a row, chart and table side by side → AC-13
- [ ] Keyboard only → reach every chip, both date fields, "عرض", each product link, and "تصدير" with visible focus → AC-13

## Value sources

- [ ] An order placed at 23:30 shop time on the period's last day counts; one at 00:10 the next shop day does not (also on a summer time change day) → AC-4
- [ ] Cancel an order in the period after a refund → it leaves sales, orders, collected, and the chart; the cancelled note counts it → AC-4
- [ ] Record a partial payment, then reverse it → sales unchanged, collected goes up then back down → AC-4
- [ ] Cut the price of an order placed last month → last month's sales go down; this month's do not change → AC-4
- [ ] Load the page near midnight, then download → the export link carries the resolved days, never the preset name → AC-9
- [ ] Rename a product that sold → the top products table shows the new name → AC-7

## Commands

- [ ] `curl -i "http://localhost:3000/admin/reports/export?from=2026-11-01&to=2026-11-06"` signed out → `303`, `Location: /admin/reports`, no body → AC-9
- [ ] Signed in, `?from=2026-11-05&to=2026-11-01` → `400`, no body, log `report_export_refused` with `from_after_to` → AC-9, AC-12
- [ ] Signed in, a valid period → `200`, `text/csv; charset=utf-8`, `Cache-Control: private, no-store`, log `report_exported` with `from`, `to`, `rows`, and no name → AC-9, AC-12
- [ ] `pnpm exec vitest run src/features/reports src/lib/format.test.ts src/lib/routes.test.ts` → all pass → AC-14
- [ ] `pnpm exec playwright test e2e/sales-reports.spec.ts` → 10 pass at 390 and 1280, axe clean → AC-13, AC-14
- [ ] `pnpm db:check-rls` → passes (no schema change) → AC-14

## Acceptance-criteria coverage

- AC-1 signed out step, page step · AC-2 chips and default steps · AC-3 custom form and error steps · AC-4 counting steps and value sources · AC-5 cards step · AC-6 chart steps · AC-7 top products and rename steps · AC-8 empty step · AC-9 export steps and commands · AC-10 CSV reconcile step · AC-11 loading and error step · AC-12 log commands · AC-13 layout and keyboard steps · AC-14 test commands
