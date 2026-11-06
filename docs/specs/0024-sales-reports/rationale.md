# 0024. Sales reports: rationale

Decision record for [index.md](index.md). `/develop` builds from `index.md`; this file holds the why.

## Context

The owner needs to know how the website sells: how many orders came through it and what they add up to over a period, sales and not profit (scope feature 27). The scope makes this feature's real work explicit: the spec must say exactly how cancellations, returns, partial payments, and delivery fees are counted. Without that rule written down, every page that shows a sales number (this one, and the dashboard home's "مبيعات هذا الشهر" in feature 35) would invent its own, and the owner would see two numbers for one month.

The data already exists. Each order keeps its current `total` (goods after discount plus delivery, enforced by `orders_total_check`), its `delivery_fee`, its `status` (seven values, `cancelled` among them), and since spec 0023 a cached `amount_paid` kept equal to an append only payments ledger. Totals can change after placement: electrician price cuts (spec 0022) lower them today, and returns (feature 34, after launch) will. Payments arrive over days or weeks, by cash or by cheque that may be post dated. Order lines keep a snapshot of the product name and their `line_total`.

Forces: the shop is small (one owner, low order volume), runs on Cloudflare Workers through OpenNext with every route rendered per request (spec 0001), and the project's rules forbid stored derived values without a measured need, raw time zone strings outside `src/lib/format.ts`, and any styling outside the design tokens. Shop days follow Asia/Hebron, summer time included, and the orders list already counts days that way (spec 0014). The design board (`docs/design/pages/admin-reports.md`) fixes the page's parts: range chips, four KPI cards, a per day bar chart, a top products table, and an export button, leaving the custom range form (O-13) and the export format (O-20) open.

## Options considered

### Option 1: Live aggregate queries over existing orders

On each request, three small SQL aggregates (summary, per day series, top products) read `orders` and `order_lines` for the period through the existing `placed_at` index, by one shared condition. Nothing is stored.

**Pros**:
- No migration, no trigger, no job; nothing can drift out of step with the orders.
- Price cuts, payments, reversals, and future returns show up on the next load.
- The rule lives in one function that the dashboard home can call too.

**Cons**:
- Past periods change when an old order's total changes.
- Cost grows with the order count; fine at this shop's volume, not at a large store's.

### Option 2: Daily summary table

A `daily_sales` table holds per shop day count, sales, delivery fees, and collected, kept current by triggers on `orders` (or a nightly job), and the page sums its rows.

**Pros**:
- Reads stay constant time for any range.
- A frozen snapshot per day becomes possible if wanted.

**Cons**:
- Every write that changes `total`, `status`, or `amount_paid` must also fix the right day's row, inside the same transaction; a missed path silently corrupts the report.
- New migration, triggers, backfill, and tests, for a performance problem nobody has measured.
- Top products would need its own summary too, or stay live anyway.

### Option 3: Sales ledger with returns on the day they happen

Record each sale on its placement day and each later reduction (price cut, return, cancellation) as a negative entry on the day it happens, accounting style; reports sum the entries per day.

**Pros**:
- Past periods are frozen; last month's number never changes.
- Matches how an accountant reads sales and returns.

**Cons**:
- Needs a ledger of total changes that does not exist; price cuts (spec 0022) and cancellations would have to write to it, and returns (feature 34) designed around it.
- Two sales numbers for one order (placed day vs change day) are harder for the owner to read than one current total.
- Far more build for a shop owner who asked for "orders and total sales by date range".

## Rationale

Option 1 wins because the forces point at simplicity: the volume is small, every route already renders per request, and the project rules forbid stored derived values without a measured need. A summary table (Option 2) would add a second copy of the order money that every price cut, payment, cancel, and future return must keep in step, which is exactly the drift spec 0023 guarded against with `amount_paid`; it buys speed the shop does not need. The engineer chose to show returns in the order's own period, which removes the main reason for Option 3, and Option 3's ledger would reach into specs 0014, 0016, and 0022 for no visible gain at launch.

The counting rule follows the owner's answers and the existing data: placed day (always known, indexed, and the same basis as the orders list), every status except cancelled (the number is live from the day an order arrives; cancelled orders are noted, not counted), the full current total (delivery included and shown apart), and collected as the paid amount of those same orders, so sales minus collected is what those orders still owe. Writing it once in `salesSummaryInDb` and requiring feature 35 to call it is the cheapest way to keep two screens from disagreeing.

Smaller calls made here: plain server bars over a chart library (no client JavaScript, no new dependency, no fight with `design-rules.test.ts`; runner up the shadcn chart on Recharts); chips as links with the period in the address (refresh safe and like the orders filters; runner up a client toggle group); months above 62 days and a 366 day cap (a year reads as 12 bars and the query stays bounded; runner up always per day); a CSV per order with names but no phones (reconciles with the cards and leaks less; runner up per line); the average rounded half up to the agora in integer arithmetic (no floats on money; runner up whole shekels); the export taking explicit days, never a preset, so a download near midnight cannot change what it covers; an unauthorised export redirected to the page rather than a bare 403, so the owner lands on sign in.
