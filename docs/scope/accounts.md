# Accounts & electricians

Part of the [S.K.F Lighting scope](index.md). Registered customers, roles, and the electrician tools for large orders.

## Slice 5: Accounts

### 18. Customer accounts · needs a decision · GA
Register, sign in, and reset a password. Everyone registers as a regular user; guests can still order without an account.
**Done when:** a customer can register, sign in, and recover access; their new orders link to their account; and only you have admin access.
- [ ] Design it (spec): `/architect customer accounts`

### 19. My Orders
A page for registered customers and electricians listing their orders with status and remaining balance (and loyalty coins once Slice 9 ships).
**Done when:** a signed in user sees only their own orders, each with status and what is still owed, and can open any one.
- [ ] Build it: `/develop my orders`

### 20. Customers & roles · needs a decision · GA
In the dashboard, view registered customers and their orders, and promote a regular user to electrician (or back).
**Done when:** only you can change roles, the change takes effect on the user's next page load, and each customer's details and order history are visible in one place.
- [ ] Design it (spec): `/architect customers & roles`

## Slice 6: Electricians

### 21. Electrician quick order & drafts · needs a decision
A fast order form: pick catalog products, prices fill in automatically, a quantity is required on every line, and the total updates. Keep several named drafts (for example "ali / mo"), with the end customer's name, phone, and address on the order.
**Done when:** an electrician can build a 30 line order without opening product pages, save it as a named draft, edit it later, and send it; lines without a quantity block sending.
- [ ] Design it (spec): `/architect electrician quick order & drafts`

### 22. Add to draft from the catalog
While browsing products, an electrician adds an item straight into one of their existing drafts.
**Done when:** product pages and lists offer "add to draft" for electricians, they choose which draft, and the item appears there with its price.
- [ ] Build it: `/develop add to draft from the catalog`

### 23. Electrician price adjustments · needs a decision · GA
On an individual electrician order, you change line prices to give a better deal, without touching the public catalog price.
**Done when:** you can adjust any line on that order, the order total and remaining balance update, the original price stays on record, and the electrician sees the adjusted price.
- [ ] Design it (spec): `/architect electrician price adjustments`
