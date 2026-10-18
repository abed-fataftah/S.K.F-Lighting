# Returns

Part of the [S.K.F Lighting scope](index.md). Return requests after delivery and recording returns and exchanges, right after launch.

## Slice 10: Returns

### 33. Return requests · needs a decision
After delivery, a customer asks to return items from their order page. The request is saved in the dashboard and opens WhatsApp with the request and order number.
**Done when:** the request option appears only on delivered orders, the customer picks items and a reason, you see the request flagged in the dashboard, and nothing changes until you approve it.
- [ ] Design it (spec): `/architect return requests`

### 34. Returns & exchanges · needs a decision · GA
Approve or reject requests, and record returns and exchanges in the dashboard, updating the order total, remaining balance, and coins.
**Done when:** an approved return or exchange updates the order total and balance correctly, adjusts coins if any were earned, keeps a record of what changed and why, and the customer sees the result.
- [ ] Design it (spec): `/architect returns & exchanges`
