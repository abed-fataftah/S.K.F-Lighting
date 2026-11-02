# Accounts & electricians

Part of the [S.K.F Lighting scope](index.md). Registered customers, roles, and the electrician tools for large orders.

## Slice 5: Accounts

### 18. Customer accounts · GA · in-progress
Register, sign in, and reset a password. Everyone registers as a regular user; guests can still order without an account.
**Done when:** a customer can register, sign in, and recover access; their new orders link to their account; and only you have admin access.
spec [0017](../specs/0017-customer-accounts/index.md) · code in `src/features/accounts/`, `src/app/[locale]/account/`, `src/app/auth/confirm/`
- [x] Design it (spec): `/architect customer accounts`
- [x] Build it: `/develop customer accounts`
  - [x] Thin thread: register, signed in at once, an order linked to the account and shown as a customer order in the dashboard (AC-2, AC-4, AC-6, AC-11, AC-12, AC-13)
  - [x] Sign in page and password reset: tabs, guest card, the confirm page with its button, new password, runbooks (AC-1, AC-5, AC-7, AC-8, AC-16)
  - [x] Account page and orders follow the account: profile, change password, checkout prefill, owner opens and cancels own order (AC-9, AC-10, AC-13, AC-14, AC-15)
  - [x] Refusals and logs: every message, honeypot, focus, no personal data logged (AC-3, AC-17)
  - [x] Phone and computer flows: Playwright on 390 and 1280, the mail catcher, two accounts, axe (AC-18)
  - [x] Hardening from the cross check: new password only within 10 minutes of a reset link, owner change password refused early, outage not shown as a wrong password, verified user on owner cancel, no referrer on the confirm page, sign out failure logged (AC-4, AC-5, AC-8, AC-15, AC-17)
  - [x] End the reset window when you leave: clear `skf_recovery` on sign out and after a password change (AC-8, AC-11)
- [ ] Verify it: `/check verify customer accounts`
- [ ] Test it: `/test customer accounts`
- [ ] Review it (fresh model): `/check review customer accounts`
- [ ] Document it: `/document customer accounts`

### 19. My Orders · in-progress
A page for registered customers and electricians listing their orders with status and remaining balance (and loyalty coins once Slice 9 ships).
**Done when:** a signed in user sees only their own orders, each with status and what is still owed, and can open any one.
spec [0018](../specs/0018-my-orders/index.md) · code in `src/app/[locale]/account/orders/`, `src/features/orders/` (`my-orders.ts`, `server/my-orders.ts`, `components/my-order*.tsx`)
- [x] Design it (spec): `/architect my orders`
- [ ] Build it: `/develop my orders`
  - [x] Thin thread: a signed in order shows on `/account/orders` with number, status, date, line count, and total, and opens (AC-1, AC-2, AC-3)
  - [x] What is still owed: the remaining or paid line, nothing on cancelled or unpaid (AC-4)
  - [x] Load more and empty: 20 per step with the count line, the page cap, the empty card (AC-5, AC-6)
  - [x] Getting here: links both ways with `/account`, the account tab and the default after sign in move to My Orders (AC-7, AC-8)
  - [ ] Finish: loading skeleton, the centered column on computers, Playwright on 390 and 1280 with axe (AC-9, AC-10, AC-11)
- [ ] Verify it: `/check verify my orders`
- [ ] Test it: `/test my orders`

### 20. Customers & roles · GA · in-progress
In the dashboard, view registered customers and their orders, and promote a regular user to electrician (or back).
**Done when:** only you can change roles, the change takes effect on the user's next page load, and each customer's details and order history are visible in one place.
spec [0019](../specs/0019-customers-roles/index.md) · code in `src/features/customers/`, `src/app/admin/(dashboard)/customers/`
- [x] Design it (spec): `/architect customers & roles`
- [ ] Build it: `/develop customers & roles`
  - [ ] Thin thread: the `account_events` migration, the list, the customer page, and promoting an account, with the role reaching the user's `/account` badge and next order (AC-1, AC-2, AC-4, AC-7, AC-8, AC-9, AC-17)
  - [ ] Find and know a customer: search by name, phone, or email; totals; order history with load more; WhatsApp; the link from the order page (AC-3, AC-4, AC-5, AC-6, AC-14)
  - [ ] Edit details and account history (AC-10, AC-13)
  - [ ] Remove an account: the locked checks, the Supabase login delete, the pending state with retry, and the storefront guard (AC-11, AC-12)
  - [ ] Finish: logs, loading states, Playwright on 390 and 1280 with axe (AC-15, AC-16, AC-18)
- [ ] Verify it: `/check verify customers & roles`
- [ ] Test it: `/test customers & roles`
- [ ] Review it (fresh model): `/check review customers & roles`
- [ ] Document it: `/document customers & roles`

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
