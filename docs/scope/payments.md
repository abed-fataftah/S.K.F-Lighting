# Payments & reports

Part of the [S.K.F Lighting scope](index.md). Cash and cheque balances per website order, and the sales numbers.

## Slice 7: Payments

### 24. Payments & balances · in-progress · GA
Record cash and cheque payments with notes on each website order. A cheque reduces the balance when you record receiving it. The order is marked paid once fully settled.
**Done when:** each order shows total, paid, and remaining; every payment keeps its date, method, amount, and note; a fully settled order is marked paid; and the customer's My Orders shows the same balance.
Spec: [0023](../specs/0023-payments-balances/index.md) · code in `src/features/payments/`
- [x] Design it (spec): `/architect payments & balances`
- [x] Build it: `/develop payments & balances`
  - [x] Thin thread: ledger table and triggers, record a cash payment, balances on the dashboard, order page, and My Orders (AC-1, AC-2, AC-4, AC-12, AC-13)
  - [x] Cheques and form rules: cheque fields, dates, every refusal, duplicate and two tab safety (AC-3, AC-4, AC-7, AC-8)
  - [x] Refunds and corrections: refunds on cancelled orders, reversals with a reason, cancel warning, history lines (AC-5, AC-6, AC-9, AC-10, AC-14)
  - [x] Orders list: الدفع column and payment filter (AC-11)
  - [x] Finish: integrity and RLS tests, logs, layout, keyboard, axe, remaining flows (AC-14, AC-15, AC-16, AC-17)
- [ ] Verify it: `/check verify payments & balances`
- [ ] Test it: `/test payments & balances`
- [ ] Review it (fresh model): `/check review payments & balances`
- [ ] Document it: `/document payments & balances`

## Slice 8: Reports

### 27. Sales reports · needs a decision
How many orders came through the website and the total sales from them (sales, not profit), by date range.
**Done when:** the dashboard shows order count and total sales for a chosen period, and the spec states exactly how cancellations, returns, partial payments, and delivery fees are counted.
- [ ] Design it (spec): `/architect sales reports`
