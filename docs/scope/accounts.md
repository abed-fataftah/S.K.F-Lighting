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
- [x] Test it: `/test customer accounts`
- [x] Review it (fresh model): `/check review customer accounts`
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
- [x] Build it: `/develop customers & roles`
  - [x] Thin thread: the `account_events` migration, the list, the customer page, and promoting an account, with the role reaching the user's `/account` badge and next order (AC-1, AC-2, AC-4, AC-7, AC-8, AC-9, AC-17)
  - [x] Find and know a customer: search by name, phone, or email; totals; order history with load more; WhatsApp; the link from the order page (AC-3, AC-4, AC-5, AC-6, AC-14)
  - [x] Edit details and account history (AC-10, AC-13)
  - [x] Remove an account: the locked checks, the Supabase login delete, the pending state with retry, and the storefront guard (AC-11, AC-12)
  - [x] Finish: logs, loading states, Playwright on 390 and 1280 with axe (AC-15, AC-16, AC-18)
- [ ] Verify it: `/check verify customers & roles`
- [ ] Test it: `/test customers & roles`
- [ ] Review it (fresh model): `/check review customers & roles`
- [ ] Document it: `/document customers & roles`

## Slice 6: Electricians

### 21. Electrician quick order & drafts · in-progress
A fast order form: pick catalog products, prices fill in automatically, a quantity is required on every line, and the total updates. Keep several named drafts (for example "ali / mo"), with the end customer's name, phone, and address on the order.
**Done when:** an electrician can build a 30 line order without opening product pages, save it as a named draft, edit it later, and send it; lines without a quantity block sending.
spec [0020](../specs/0020-electrician-quick-order-drafts/index.md) · code in `src/features/drafts/`, `src/app/[locale]/account/quick-order/`, `src/app/[locale]/account/drafts/`, `src/app/api/quick-order/`
- [x] Design it (spec): `/architect electrician quick order & drafts`
- [x] Build it: `/develop electrician quick order & drafts`
  - [x] Thin thread: the drafts migration, a named draft, one searched line, pickup, send through the shared order insert to the WhatsApp page (AC-1, AC-4, AC-6, AC-7, AC-8, AC-10, AC-13)
  - [x] Lines and send at full strength: add, remove with undo, 30 line cap, duplicates, unavailable lines, totals, delivery, "الطلب لي", every send refusal (AC-6, AC-8, AC-9, AC-10, AC-11, AC-13, AC-14)
  - [x] Autosave you can trust: the save queue, status line, retry, leave warning, catching up across devices (AC-12)
  - [x] Drafts list and the way in: list, rename, delete, 30 draft limit, the `/account` card (AC-2, AC-3, AC-5, AC-15)
  - [x] Edges and finish: WhatsApp electrician line, product delete archives, role changes, logs, Playwright on 390 and 1280 with axe (AC-16, AC-17, AC-18, AC-19, AC-20, AC-21)
- [ ] Verify it: `/check verify electrician quick order & drafts`
- [ ] Test it: `/test electrician quick order & drafts`

### 22. Add to draft from the catalog · in-progress
While browsing products, an electrician adds an item straight into one of their existing drafts.
**Done when:** product pages and lists offer "add to draft" for electricians, they choose which draft, and the item appears there with its price.
spec [0021](../specs/0021-add-to-draft-catalog/index.md) · code in `src/features/drafts/`, `src/features/catalog/`, `src/app/[locale]/`
- [x] Design it (spec): `/architect add to draft from the catalog`
- [x] Build it: `/develop add to draft from the catalog`
  - [x] Thin thread on the product page: role flag, `readDraftPicker`, `addToDraft` append and merge into an existing draft, the sheet, the success block (AC-1, AC-2, AC-4, AC-5, AC-6, AC-7, AC-8, AC-10)
  - [x] Cards: `CardProduct.productId`, the photo corner button on home, category, and search (AC-1, AC-3)
  - [x] New draft from the sheet: `insertNamedDraft`, zero and 30 draft states, name errors (AC-7, AC-9)
  - [x] Refusals, edges, and finish: every refusal and reload, logs, layout at 390 and 1280, database tests, Playwright with axe (AC-4, AC-11, AC-12, AC-13, AC-14, AC-15)
- [ ] Verify it: `/check verify add to draft from the catalog`
- [ ] Test it: `/test add to draft from the catalog`

### 23. Electrician price adjustments · GA · in-progress
On an individual electrician order, you change line prices to give a better deal, without touching the public catalog price.
**Done when:** you can adjust any line on that order, the order total and remaining balance update, the original price stays on record, and the electrician sees the adjusted price.
spec [0022](../specs/0022-electrician-price-adjustments/index.md) · code in `src/features/orders/`, `src/app/admin/(dashboard)/orders/[number]/`, `src/server/db/schema/orders.ts`
- [x] Design it (spec): `/architect electrician price adjustments`
- [x] Build it: `/develop electrician price adjustments`
  - [x] Thin thread: the change table and triggers, the edit mode, one batch save through `adjustOrderPrices` with lines, totals, event, and change rows (AC-1, AC-2, AC-3, AC-4, AC-5)
  - [x] Every refusal and edit detail: stale, locked, below paid, not electrician, no change, inline price errors, reset link, live preview (AC-1, AC-2, AC-3, AC-6)
  - [x] Showing the deal: struck prices and discount rows in the dashboard and on the electrician's order page, the history line with the note (AC-7, AC-8, AC-9)
  - [x] Finish: append only and RLS tests, the concurrency test, logs, 390 and 1280 layout, Playwright with axe (AC-10, AC-11, AC-12, AC-13)
- [ ] Verify it: `/check verify electrician price adjustments`
- [ ] Test it: `/test electrician price adjustments`
- [ ] Review it (fresh model): `/check review electrician price adjustments`
- [ ] Document it: `/document electrician price adjustments`
