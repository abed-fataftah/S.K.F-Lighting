# Payments & reports

Part of the [S.K.F Lighting scope](index.md). Cash and cheque balances per website order, and the sales numbers.

## Slice 7: Payments

### 24. Payments & balances · needs a decision · GA
Record cash and cheque payments with notes on each website order. A cheque reduces the balance when you record receiving it. The order is marked paid once fully settled.
**Done when:** each order shows total, paid, and remaining; every payment keeps its date, method, amount, and note; a fully settled order is marked paid; and the customer's My Orders shows the same balance.
- [ ] Design it (spec): `/architect payments & balances`

## Slice 8: Reports

### 27. Sales reports · needs a decision
How many orders came through the website and the total sales from them (sales, not profit), by date range.
**Done when:** the dashboard shows order count and total sales for a chosen period, and the spec states exactly how cancellations, returns, partial payments, and delivery fees are counted.
- [ ] Design it (spec): `/architect sales reports`
