# 0024. Sales reports

**Date**: 2026-11-06
**Status**: In Progress

## Summary

The dashboard gets a reports page at `/admin/reports` that shows, for a period you pick, how many website orders came in and their total sales, plus the average order, the money already collected on them, sales by day, and the best selling products, with a CSV download. The counting rule is fixed here so the number never surprises you: an order counts by the shop day it was placed, every status except cancelled counts, its full current total counts (delivery fee included, shown apart) whether it is paid or not, and a later return or price cut lowers the period the order was placed in. Nothing new is stored: every number is worked out live from the orders you already have, so there is no migration.

## Requirements

**User stories**:
- As the shop owner, I want to pick a period and see how many website orders came in and what they add up to, so that I know how the website is selling.
- As the shop owner, I want to see how much of those sales is already paid, so that I know what is still owed.
- As the shop owner, I want to see which products sell most and how sales spread over the days, so that I can restock and plan.
- As the shop owner, I want to download the period's orders as a spreadsheet, so that I can check or share the numbers.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: Page and access. `/admin/reports` (`routes.admin.reports`, already in the sidebar as "التقارير") renders inside the dashboard layout with one `h1` "التقارير" (`AdminReports.title`), the page title `AdminReports.metaTitle` "التقارير", and the dashboard's `noindex, nofollow`. The page runs in this order: `today = shopDateKey(new Date())` once, then the pure `parseReportPeriod` (reads nothing), then `readSalesReport(period)`, which calls `requireAdminPage(routes.admin.reportsFor(period))` as its first line (like `listAdminOrders`) and only then `getDb()` and the reads in `Promise.all`, where `period` is the parsed one (this month after an error); so a signed out visitor or a non admin is sent to sign in and back, and sees no number. Every route renders per request (spec 0001); nothing on this page is cached.
- **AC-2**: Period choice. Under the header, a row of five chips, each a link (`aria-current="page"` on the chosen one) styled as the design's toggle chips: "اليوم" (`today`), "آخر 7 أيام" (`7d`), "آخر 30 يوماً" (`30d`), "هذا الشهر" (`month`), "فترة مخصصة" (`custom`). The period lives in the address: `?range=today|7d|30d|month`, or `?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`. No `range`, or an unknown value, means `month` with no message (like the orders filters). A pure `resolvePeriod(range, today)` turns a preset into shop days, both ends included, where `today = shopDateKey(new Date())` taken once per request: `today` gives `[today, today]`; `7d` gives `[today − 6, today]`; `30d` gives `[today − 29, today]`; `month` gives `[first day of today's month, today]`. Under the chips a muted line states the resolved days: "من {from} إلى {to}" (`AdminReports.periodRange`), or "{day}" alone (`AdminReports.periodDay`) when from equals to, each day through `formatDayKey`. Every number on the page, and the export, uses these resolved days.
- **AC-3**: Custom range. With `range=custom`, a GET form shows under the chips: "من" and "إلى" (`type="date"`, both with `max` the shop's today), and a small yellow submit "عرض" (`AdminReports.show`); it submits `range=custom&from&to` to the same page, so it works without JavaScript. Opening the chip with no `from`/`to` prefills the form with this month's days and shows this month, with no error. A pure `parseReportPeriod(params, today)` returns `{ period, typed, errors }`: `period` is the one used for every number, the range line, and the export link (this month whenever there is an error); `typed` is the raw `from`/`to` strings, echoed unparsed as the inputs' `value` so the owner can fix them. `range=custom` with neither `from` nor `to` is no error; with only one of them present, the missing one is an error. For a custom range it checks, in this order, and on the first failure keeps the typed values in the form, shows the error under its field (`aria-invalid`, `aria-describedby`), and shows this month's numbers with the range line saying so: `from` missing or not a real day (`isDateKey`) "أدخل تاريخ البداية." (`errors.fromInvalid`); `to` missing or not a real day "أدخل تاريخ النهاية." (`errors.toInvalid`); `to` after today "لا يمكن أن تكون النهاية بعد اليوم." (`errors.future`, under "إلى"); `from` after `to` "تاريخ البداية بعد تاريخ النهاية." (`errors.fromAfterTo`, under "من"); more than 366 days from `from` to `to` inclusive "أقصى فترة سنة واحدة (366 يوماً)." (`errors.tooLong`, under "من"). Any past day is allowed for `from`; days with no orders show 0.
- **AC-4**: The counting rule (the contract every number on this page and feature 35 follows). An order is **in the period** when its `placed_at` falls on a shop day from `from` to `to`: `placed_at >= shopDayStart(from) and placed_at < shopDayStart(addDaysToKey(to, 1))` (Asia/Hebron days, summer time included, through `src/lib/format.ts`). Of those, an order is **counted** when `status <> 'cancelled'`, at any status from `new` to `delivered`. For counted orders: **sales** is the sum of `orders.total` as it is now (goods after `discount_total`, plus `delivery_fee`); **delivery fees** is the sum of `delivery_fee`; **collected** is the sum of `amount_paid`. So: (1) a cancelled order adds nothing to any money figure or to the order count, and a refund on it changes nothing here; (2) a partly paid or unpaid order adds its full total to sales, and only what is paid to collected; a cheque counts as collected from the day it is recorded, also when it is post dated (spec 0023 rule), and a reversal is already reflected in `amount_paid`; (3) delivery fees are inside sales and shown apart; (4) a price cut (spec 0022) or a return (feature 34) that lowers an order's total lowers sales for the period the order was placed in, so a past period's number can go down later; nothing is subtracted on the day of the change. Numbers are read live on each request.
- **AC-5**: KPI cards. Four cards in this order, label in muted small text, the number large: "إجمالي المبيعات" `formatPrice(sales)`, with a muted note "منها رسوم توصيل {amount}" (`AdminReports.deliveryNote`) when delivery fees are above 0; "عدد الطلبات" `formatNumber(orders)`, with a muted note for orders in the period that are cancelled, when there is at least one, through the plural string `AdminReports.cancelledNote`: "{count, plural, one {وأُلغي طلب واحد} two {وأُلغي طلبان} few {وأُلغيت {shown} طلبات} many {وأُلغي {shown} طلبًا} other {وأُلغي {shown} طلب}}" (`shown` through `formatNumber`); "متوسط قيمة الطلب" `formatPrice(averageOrderValue(sales, orders))`, where the pure `averageOrderValue` rounds to the nearest agora, half up, in integers only (`Math.floor((2 * sales + orders) / (2 * orders))`), and the card shows "—" when `orders = 0`; "المبلغ المحصّل" `formatPrice(collected)`, with a muted note "المتبقي {amount}" (`AdminReports.outstandingNote`, `sales − collected`) when that is above 0.
- **AC-6**: Sales chart. A card "المبيعات حسب اليوم" (`AdminReports.byDay`) with one bar per shop day in the period, from `from` to `to`, days with no orders included at 0. When the period is longer than 62 days, the bars are months instead and the card title reads "المبيعات حسب الشهر" (`AdminReports.byMonth`); the first and last month hold only the days inside the period. A bar's value is the sales (AC-4) of counted orders placed that day or month. Bars are drawn on the server with plain elements and tokens (no chart library, no client JavaScript): ink fill, heights as a share of the highest bar (all bars empty when every value is 0; a bar above 0 is at least 2px high so it never vanishes next to a large one), the bar area at least `n × 8px` wide, 190 high on desktop, an axis line in `--skf-control-border`. Labels under the bars: day "5/11" (`formatDayShort`), month "11/2026" (`formatMonthKey`), both new in `src/lib/format.ts`; with more than 14 bars only every `ceil(n / 7)`th bar is labelled, from the first (the pure `axisLabelIndexes(n)`). The chart is `role="img"` with `aria-label` from `AdminReports.chartLabel`: "{count, plural, zero {لا طلبات من {from} إلى {to}} one {المبيعات {sales} في طلب واحد، من {from} إلى {to}} two {المبيعات {sales} في طلبين، من {from} إلى {to}} few {المبيعات {sales} في {shown} طلبات، من {from} إلى {to}} many {المبيعات {sales} في {shown} طلبًا، من {from} إلى {to}} other {المبيعات {sales} في {shown} طلب، من {from} إلى {to}}}" (`sales` through `formatPrice`, `shown` through `formatNumber`, days through `formatDayKey`), and a visually hidden table (`sr-only`, `aria-label` the card title, columns "اليوم" or "الشهر" and "المبيعات", `scope="col"`) holds every bar's label and amount. The design's caption "رسم توضيحي…" is not built.
- **AC-7**: Top products. A table card "الأكثر مبيعاً" (`AdminReports.topProducts`, `aria-label` the same, headers with `scope="col"`): "المنتج", "الكمية", "المبيعات". Rows are the order lines of counted orders in the period, grouped by `product_id` (every size and colour of a product together), up to 10, ranked by total quantity descending, then summed `line_total` descending, then product name ascending (the database's default collation), then `product_id` ascending. "المنتج" shows the product's current `products.name` (also for a renamed or archived product), linked to `routes.admin.product(id)`, with its `code` muted beside it inside `<bdi dir="ltr">`; "الكمية" `formatNumber`; "المبيعات" `formatPrice` of the summed `line_total`. A muted line under the table reads "قيمة المنتجات قبل الخصم ورسوم التوصيل." (`AdminReports.topProductsNote`), because line totals leave out order discounts and delivery and so do not add up to total sales.
- **AC-8**: Empty period. When no order is counted, the cards show ₪0, 0, "—", and ₪0 (the cancelled note still shows if there are cancelled orders), and one muted card "لا توجد طلبات في هذه الفترة." (`AdminReports.empty`) replaces both the chart and the top products table. The export button stays enabled.
- **AC-9**: Export. The header holds an outline small link styled as a button "تصدير" (`AdminReports.export`) to `routes.admin.reportsExport({ from, to })`, the resolved days of AC-2 written out (never the preset name, so a download near midnight cannot shift days). The GET route handler `/admin/reports/export` calls `requireAdmin()` before reading any parameter; on `forbidden` it answers `new Response(null, { status: 303, headers: { Location: routes.admin.reports } })` (not `redirect()`, which gives 307 in a route handler), whose page guard sends the browser to sign in and back; the typed days are never echoed into the redirect. Only then it checks `from` and `to` with `checkReportDays`, the same rules as AC-3 (one `today` per request); on a failure it answers `400` with no file. Everything after the auth check sits in a `try`/`catch`: an unexpected error answers `500` with no file and logs `report_export_failed` (the route's `error.tsx` does not cover route handlers). Labels come from `getTranslations("AdminReports")` and `getTranslations("AdminOrders")` inside the handler. Otherwise it answers `200`, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="skf-sales-{from}-to-{to}.csv"`, `Cache-Control: private, no-store`, with a UTF-8 byte order mark first (so Excel reads the Arabic), CRLF line ends, and RFC 4180 quoting (a cell with a comma, quote, or line break is quoted, quotes doubled). One header row, then one row per order **in the period, cancelled included**, oldest `placed_at` first then `order_number`. Columns in this order (headers in `AdminReports.csv.*`): "رقم الطلب" (`order_number`); "التاريخ" (`shopDateKey(placed_at)`, `YYYY-MM-DD`); "الوقت" (`formatTime(placed_at)`, shop time, so two orders on one day can be told apart); "الحالة" (`AdminOrders.status.<status>`, the label the orders list shows, e.g. "ملغي"); "يُحتسب في المبيعات" ("نعم" or "لا", per AC-4, so filtering on نعم and summing الإجمالي gives the sales card); "النوع" (from `placed_by_role` as stored at placement: `customer` "عميل" and `electrician` "كهربائي", reusing `AdminOrders.typeCustomer` and `AdminOrders.typeElectrician`; `admin` "المتجر"; null "زائر"); "الاسم" (`customer_name`); "الاستلام" ("توصيل" or "استلام من المتجر"); "المنتجات" (`subtotal`); "الخصم" (`discount_total`); "التوصيل" (`delivery_fee`); "الإجمالي" (`total`); "المدفوع" (`amount_paid`); "المتبقي" (`total − amount_paid`, empty for a cancelled order). Money cells are plain shekels through `toShekelsInput` (`1250`, `19.90`), with no ₪ sign and no thousands commas, so a spreadsheet can sum them. The phone, address, area, city, notes, and cheque details are never written. Every text cell (never a money cell) whose first character after any leading spaces is `=`, `+`, `-`, `@`, a tab, or a carriage return gets a leading `'` (so a customer name cannot run as a spreadsheet formula). An empty period gives the header row only. The new keys: `AdminReports.csv.orderNumber` "رقم الطلب", `csv.date` "التاريخ", `csv.time` "الوقت", `csv.status` "الحالة", `csv.counted` "يُحتسب في المبيعات", `csv.type` "النوع", `csv.name` "الاسم", `csv.fulfilment` "الاستلام", `csv.subtotal` "المنتجات", `csv.discount` "الخصم", `csv.delivery` "التوصيل", `csv.total` "الإجمالي", `csv.paid` "المدفوع", `csv.remaining` "المتبقي", `csv.yes` "نعم", `csv.no` "لا", `csv.typeAdmin` "المتجر", `csv.typeGuest` "زائر", `csv.delivered` "توصيل", `csv.pickup` "استلام من المتجر". No row cap: 366 days at this shop's volume fits in memory on a Worker.
- **AC-10**: Shared numbers. `salesSummaryInDb(db, days)` in `src/features/reports/server/` returns `{ orders, sales, deliveryFees, collected, cancelled }` for `{ from, to }` shop days by the rule of AC-4, and it is the only place that rule is written in SQL. The reports page uses it, and feature 35's "مبيعات هذا الشهر" card must call it with `resolvePeriod("month", today)`, so the two never disagree.
- **AC-11**: Loading and errors. `loading.tsx` for the route shows `Skeleton` blocks for the four cards and the two cards below (`design.md` section 6). An `error.tsx` boundary for the route shows a card with `role="alert"`, "تعذّر تحميل التقارير." (`AdminReports.loadError`), and a button "حاول مرة أخرى" (`AdminReports.retry`) that calls `router.refresh()` then `reset()`.
- **AC-12**: Logs. Through a local `log` helper in the export route, `console.info(JSON.stringify({ event, ...fields }))`, the same as spec 0023's payment actions. A successful export logs `report_exported` with `from`, `to`, and `rows`. A refused export logs `report_export_refused` with the reason (`forbidden` or the period error code). A crash logs `report_export_failed` with `from` and `to` (only once validated). Customer names, phones, and addresses are never logged.
- **AC-13**: Layout and access. At 1280 the page matches the design board: header with "تصدير", chips, a row of four cards, then the chart card and the top products card side by side, wrapping. Below 780 wide the cards stack in one column, the chips wrap, the custom form fields go full width, the chart keeps its bars inside its card (its own box scrolls sideways if bars would get thinner than 6px), and the top products table scrolls sideways inside its box; no page scrolls sideways at 390. Logical properties only; the bars grow from the block end and run from the inline start, so in RTL the first day is on the right. Keyboard alone reaches every chip, the custom form, submit, every product link, and the export. axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) finds nothing on: the default month, a custom range with an error shown, and an empty period.
- **AC-14**: Tests. Vitest beside the source for: `resolvePeriod` (each preset, a month's first day, a year end, a 31 day month); `parseReportPeriod` (no range, unknown range, every error in the AC-3 order, exactly 366 days passes, 367 fails, `to` today passes); `averageOrderValue` (0 orders, an exact amount, a half agora rounds up, a large total stays a safe integer); `fillDaySeries` (missing days filled with 0) and `rollUpMonths` (partial first and last month, a range across a year end); `bucketsFor` switches to months above 62 days; `axisLabelIndexes`; `barHeights` (all zero, one bar); `formatDayShort` and `formatMonthKey`; the CSV builder (BOM, CRLF, quoting of comma, quote and line break, the formula guard for each lead character, cancelled row has empty المتبقي and "لا", money cells, header only when empty). Database tests through `withRollback` for `salesSummaryInDb`, `salesSeriesInDb`, `topProductsInDb`, and `exportOrdersInDb` with fixture orders: a cancelled order excluded from money and count but in `cancelled` and in the export; a partly paid order counts its full total; delivery fees summed apart; an order placed at 23:30 shop time on the last day is in, one at 00:10 on the next shop day is out, across a summer time change too; a price cut lowers the period's sales; two variants of one product make one top products row; the ranking tie break. Playwright at 390 and 1280: open the page and see this month's numbers match seeded orders; switch to آخر 7 أيام and see the address and numbers change; enter a custom range with from after to and see the error with this month still shown; enter a valid custom range; download the CSV and check its first rows; an empty period shows the empty card; axe on each screen.

## Decision

**Chosen option**: Option 1: Live aggregate queries over the existing orders, with the counting rule in one shared server function and the page rendered on the server.

The reports page reads three small aggregates (summary, per day series, top products) straight from `orders` and `order_lines` on each request, by the counting rule in AC-4, with no new table, no migration, and no chart library.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the aggregate queries and the index use · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for parallel server reads and the route handler · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the cards, table, skeleton, and chips · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for the flows and the download check.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No new table, column, index, or migration. Read only use of:

| Table | Columns read | Used for |
|---|---|---|
| `orders` | `id`, `order_number`, `placed_at`, `status`, `placed_by_role`, `customer_name`, `fulfilment`, `subtotal`, `discount_total`, `delivery_fee`, `total`, `amount_paid` | summary, series, export |
| `order_lines` | `order_id` (FK `orders.id`), `product_id` (FK `products.id`), `quantity`, `line_total` | top products |
| `products` | `id`, `name`, `code` | top products (current name) |

The range filter uses the existing `orders_placed_at_idx`; the top products join uses `order_lines_order_id_idx`. Sums are cast to `bigint` in SQL; the `postgres` driver returns every `sum` and `count(*)` as a string, so each is read with `Number(...)` (they stay below `Number.MAX_SAFE_INTEGER` by many orders of magnitude). The series selects `(placed_at at time zone ${SHOP_TIME_ZONE})::date` with `SHOP_TIME_ZONE` from `src/lib/format.ts` as a bound parameter (never a zone string written in the query, `language-rules.test.ts`) and groups by ordinal (`group by 1`), because the same value bound twice becomes two parameters that Postgres does not treat as one expression; always per day, with month keys (`YYYY-MM` strings) rolled up in TypeScript by `rollUpMonths`. A database test runs it on the real driver.

**State transitions**: none. The report reads `orders.status` and splits only `cancelled` from every other status.

**Modules**:
- `src/features/reports/period.ts` (pure): `REPORT_RANGES = ["today", "7d", "30d", "month", "custom"]`, `ReportRange`, `ReportPeriod` (`{ range, from, to }`), `ReportDays` (`{ from, to }`), `ReportPeriodError` (`from_invalid | to_invalid | future | from_after_to | too_long`), `resolvePeriod`, `parseReportPeriod`, `checkReportDays` (shared by the page and the export), `MAX_REPORT_DAYS = 366`, `MONTH_BUCKETS_AFTER = 62`.
- `src/features/reports/series.ts` (pure): `averageOrderValue`, `fillDaySeries`, `rollUpMonths`, `bucketsFor`, `barHeights`, `axisLabelIndexes`.
- `src/features/reports/csv.ts` (pure): `csvCell` (quoting and formula guard), `toCsv` (BOM, CRLF), `orderCsvRow`, `CSV_COLUMNS`.
- `src/features/reports/server/queries.ts` (`server-only`): `salesSummaryInDb`, `salesSeriesInDb`, `topProductsInDb`, `exportOrdersInDb`, each `(db, days)`; and `readSalesReport(period)` which calls `requireAdminPage(routes.admin.reportsFor(period))`, then `getDb()`, then the first three in `Promise.all`.
- `src/features/reports/components/`: `period-chips.tsx`, `custom-range-form.tsx`, `kpi-cards.tsx`, `sales-chart.tsx`, `top-products-table.tsx` (all server components; none needs client state, and `custom-range-form` is a plain GET form).
- `src/app/admin/(dashboard)/reports/page.tsx`, `loading.tsx`, `error.tsx` (client, per Next), and `src/app/admin/(dashboard)/reports/export/route.ts`.
- `src/lib/routes.ts`: `routes.admin.reportsFor({ range, from?, to? })` (writes `range`, and `from`/`to` only for `custom`; `month` writes no query) and `routes.admin.reportsExport({ from, to })`.
- `src/lib/format.ts`: `formatDayShort(key)` ("5/11") and `formatMonthKey("2026-11")` ("11/2026").
- `src/i18n/messages/ar.json`: a new `AdminReports` namespace with every string in AC-1 to AC-11.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/admin/reports` (page) | GET | `range` (opt, one of `REPORT_RANGES`), `from`, `to` (opt, `YYYY-MM-DD`, only with `custom`) | HTML: range line, four KPI cards, chart, top products, export link | admin at `aal2` via `requireAdminPage` | not admin: redirect to sign in and back; bad custom range: inline field error, this month shown (200) |
| `/admin/reports/export` (route handler) | GET | `from` (req), `to` (req), `YYYY-MM-DD` | `text/csv` attachment, one row per order in the period | admin at `aal2` via `requireAdmin()` | not admin: 303 to the report page; bad days: 400, no body |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| page, export | the shop's today | `shopDateKey(new Date())`, one call per request |
| page | resolved `from`, `to` | `resolvePeriod(range, today)`, or the `from`/`to` params after `checkReportDays` |
| page, export | instant bounds of the period | `shopDayStart(from)`, `shopDayStart(addDaysToKey(to, 1))` |
| page | `orders` (count) | `count(*)` of orders in the period with `status <> 'cancelled'` (`salesSummaryInDb`) |
| page | `sales` | `sum(orders.total)` of the same orders |
| page | delivery note amount | `sum(orders.delivery_fee)` of the same orders |
| page | `collected` | `sum(orders.amount_paid)` of the same orders |
| page | outstanding note | derived: `sales − collected` |
| page | cancelled note count | `count(*)` of orders in the period with `status = 'cancelled'` |
| page | average | derived: `averageOrderValue(sales, orders)`, half up to the agora |
| page | bar values | `sum(orders.total)` of counted orders grouped by shop day (`salesSeriesInDb`), filled with 0 by `fillDaySeries`, months by `rollUpMonths` when `bucketsFor` says so |
| page | bar label | `formatDayShort(dayKey)` or `formatMonthKey(monthKey)` |
| page | bar height | derived: `barHeights(values)`, share of the highest value |
| page | top product name, code | current `products.name`, `products.code` by `order_lines.product_id` |
| page | top product quantity, sales | `sum(order_lines.quantity)`, `sum(order_lines.line_total)` over counted orders in the period |
| page | money text, number text | `formatPrice`, `formatNumber` |
| page | day text | `formatDayKey` |
| export | each column | the `orders` column named in AC-9; status label from the existing `AdminOrders` status strings; role and fulfilment labels from `AdminReports.csv.*`; money through `toShekelsInput` |
| export | file name days | the validated `from`, `to` params |
| export | counted flag | derived: `status <> 'cancelled'` |

**Key invariants**:
- The counting rule of AC-4 is written once in SQL, in `salesSummaryInDb` (and the same `where` in `salesSeriesInDb` and `topProductsInDb`, taken from one shared condition builder `countedInPeriod(days)` in `queries.ts`), never copied into a page or feature 35.
- The sum of the bar values equals `sales`; the export rows marked "نعم" sum to `sales` in الإجمالي and to `collected` in المدفوع.
- Money stays integer agorot from the database to `formatPrice` or `toShekelsInput`; no float division (the average uses integer arithmetic).
- Every shop day is computed through `src/lib/format.ts`; the only zone value in SQL is the bound `SHOP_TIME_ZONE`.
- The report never writes: no Server Action, no insert, no update.

**Security model**:
- Only an admin at `aal2` reads the page (`requireAdminPage` inside the query, besides the layout guard) and the export (`requireAdmin()` first in the route handler, per `AGENTS.md`). Customers, electricians, and guests get nothing.
- All data goes through Drizzle `getDb()` on the server; the browser never queries. RLS on the tables is unchanged (no `anon`/`authenticated` grants).
- The CSV carries customer names (personal data) but never phones, addresses, notes, or cheque details; it is sent `private, no-store`. Text cells are guarded against formula injection.
- Logs carry the period and row count, never names, phones, or addresses.

**Configuration required**: none (no new env var, binding, or dependency).

**Critical test scenarios**:
- Happy path: seeded orders across this month (one partly paid delivery order, one paid pickup order, one cancelled with a refund) show the right count, sales with the delivery note, average, collected with the outstanding note, the cancelled note, bars on the right days, and the top products; the CSV rows match, verifies **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-9**
- Boundary: an order placed at 23:30 shop time on the period's last day counts, one at 00:10 the next shop day does not, also across a summer time change, verifies **AC-4**
- Failure case: a custom range with from after to (and one of 367 days) shows the field error while this month stays shown; an export with a bad `to` answers 400, verifies **AC-3**, **AC-9**
- Formula injection: a customer named `=HYPERLINK(...)` comes out as `'=HYPERLINK(...)` in the CSV, verifies **AC-9**
- Auth/permission: a signed out visitor opening `/admin/reports` is sent to sign in; one opening `/admin/reports/export?from=…&to=…` gets a 303 to the report page and no file; a signed in customer gets neither, verifies **AC-1**, **AC-9**

## Build plan

Tracer Bullet: one real number (this month's order count and sales from real orders) travels from the database to the page first, then each part thickens. No migration in any step.

1. Thin thread: `period.ts` with `resolvePeriod` and `parseReportPeriod` for presets only (no range defaults to `month`); `countedInPeriod` and `salesSummaryInDb`; `readSalesReport`; `routes.admin.reportsFor`; the page with the `h1`, the five chips, the range line, and the four KPI cards with their notes; the `AdminReports` strings used so far; Vitest for `resolvePeriod`, `averageOrderValue`; one database test of `salesSummaryInDb` (cancelled excluded, partly paid counts in full, delivery fees apart); one Playwright run at 1280 opening the page on seeded orders and checking the numbers, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-10**
2. Custom range: `checkReportDays` and the custom branch of `parseReportPeriod` with every error in order; `custom-range-form.tsx`; inline errors with this month shown; unit tests for every branch and the 366 day edge; Playwright for an error and a valid range, satisfies **AC-2**, **AC-3**
3. Chart: `salesSeriesInDb`; `fillDaySeries`, `rollUpMonths`, `bucketsFor`, `barHeights`, `axisLabelIndexes`; `formatDayShort`, `formatMonthKey`; `sales-chart.tsx` with `role="img"`, its label, and the hidden table; database test for the shop day boundary and summer time; unit tests, satisfies **AC-4**, **AC-6**
4. Top products and empty state: `topProductsInDb` with the ranking and current names; `top-products-table.tsx` with links and the note; the empty card; database tests for grouping variants and the tie break, satisfies **AC-7**, **AC-8**
5. Export: `csv.ts` (`csvCell`, `toCsv`, `orderCsvRow`); `exportOrdersInDb`; `routes.admin.reportsExport`; `export/route.ts` with `requireAdmin()`, 303, 400, headers, and logs; the "تصدير" link; unit tests for quoting, BOM, formula guard; database test for row order and cancelled rows; Playwright download check, satisfies **AC-9**, **AC-12**
6. Finish: `loading.tsx`, `error.tsx`; layout at 390 and 1280, sideways scroll inside the chart and table boxes only; keyboard path; axe on the three screens; the remaining Playwright flows and Vitest units; `pnpm db:check-rls` still passes, satisfies **AC-11**, **AC-13**, **AC-14**

## Consequences

**Positive**:
- One written rule (AC-4) answers "what counts as a sale" for this page, the CSV, and the future dashboard home, so the owner never sees two different numbers for the same month.
- No schema, no sync job, no cache: a price cut, payment, reversal, or return shows up on the next page load with nothing to rebuild.
- No new dependency and no client JavaScript for the chart; it renders on workerd like any other server page and passes the design rule test.
- The CSV reconciles with the cards (filter "نعم", sum the columns), so the owner or an accountant can check every figure.

**Negative / tradeoffs**:
- Past periods are not frozen: a return or price cut on an October order later lowers October's sales. Someone comparing a number written down last month will see a different one. The choice is deliberate (simple and matches the order page) and stated on the page through the counting rule; a frozen accounting view would need a ledger of total changes.
- "Collected" for a period moves up as later payments arrive on its orders, and counts post dated cheques from the day they are recorded, so it is not cash in the bank for that period.
- Unconfirmed `new` orders count as sales, so a junk or test order inflates the number until you cancel it.
- Top products use `line_total`, which leaves out order discounts and delivery and, per the `order_lines` comment, keeps the ordered amount after returns, so the table will not reflect returns once feature 34 ships unless that feature changes it.
- Live aggregates grow with the order count; at this shop's volume (well under 50,000 orders a year) a 366 day range is a few indexed scans, but at far higher volume a summary table would be needed.
- The CSV holds customer names; once downloaded it lives outside the system's access control.
- A cancelled order with money still owed back is invisible here (refunds change nothing in AC-4); the orders list's "استرجاع مستحق" filter (spec 0023 AC-11) is where those are found.
- The export has no row cap and builds the file in memory; fine for a year at this shop's volume, but a much busier shop would need streaming.
- Money cells like `19.90` use a dot; a spreadsheet set to a comma decimal locale may read them as text.

**Neutral**:
- New `AdminReports` strings namespace, two new date helpers in `src/lib/format.ts`, two new route builders.
- The design board's "فترة مخصصة" form (O-13) and the export format (O-20) are now decided here.
- The chips are links, not a client `ToggleGroup`, so they work without JavaScript; they borrow the toggle chip styling.

## Follow-up

- [ ] Feature 35 (dashboard home): its "مبيعات هذا الشهر" card calls `salesSummaryInDb` with `resolvePeriod("month", today)` (AC-10); note this in its spec when it is designed.
- [ ] Feature 34 (returns): decide whether a return also lowers the top products figures (today `line_total` keeps the ordered amount), and whether a separate returns line is wanted on this page; its total changes already flow into sales here by AC-4.
- [ ] Spec 0023 follow-up "Feature 27 (sales reports): decide whether reports count sales only or also collected money, and how cheques not yet due are treated" is answered by AC-4 and AC-5; tick it when this ships.
- [ ] [docs/design/pages/admin-reports.md](../../design/pages/admin-reports.md): close O-13 (custom range form: two date fields and "عرض") and O-20 (CSV format, AC-9); add the notes under the cards, the range line, and the month buckets.
- [ ] Later, if wanted: a "placed by" filter (customers, electricians, guests); the CSV already carries the column.
- [ ] `verify.md` for this spec, like 0023, when you run `/check verify`.
