# 0018. My Orders page for signed in customers

**Date**: 2026-11-02
**Status**: In Progress

## Summary

A signed in customer gets a page at `/account/orders` listing every order placed from their account, newest first. Each card shows the order number, its status, the date, how many items it has, the total, and, once a payment is recorded, what is still owed (or "مدفوع"). It loads 20 orders at a time with the same "عرض المزيد" link the category pages use. Nothing new is stored: the page reads the orders table that spec 0017 already ties to the account. The account tab and the default after sign in move here, and the page links both ways with `/account`.

## Requirements

**User stories**:
- As a registered customer, I want to see all my orders in one place, so I can follow them without typing an order number and phone.
- As a customer who pays in parts, I want each order to say what is still owed, so I know what to bring to the shop.
- As an electrician with many orders, I want the list to load in steps, so the page stays fast on a phone.

**Acceptance criteria** (these build on spec 0015 for the order page, spec 0017 for accounts and order ownership, and `docs/design/pages/my-orders.md` for layout and copy):

- **AC-1**: Access. `/account/orders` reads the session with `getClaims()`. Signed out (or an expired session) redirects to `routes.signInWith({ next: routes.accountOrders })`, so sign in lands back here. Any signed in role (customer, electrician, and the owner shopping as themself, spec 0017 AC-4) gets the same page under the same rule. The page is `noindex` (`robots: { index: false }`) with the browser title `PageTitles.myOrders` ("طلباتي | S.K.F للإنارة"), and the bottom bar's account tab is active (already true for any `/account` path).
- **AC-2**: Which orders. The list holds exactly the orders whose `placed_by_user_id` equals the session's `sub`, every status, cancelled included, sorted by `placed_at` newest first, then `order_number` descending on a tie. Guest orders (including ones placed before registering, spec 0017) and other accounts' orders never appear.
- **AC-3**: Order card. One `Card` per order, per `my-orders.md` layout item 2: the order number (16/800, `dir="ltr"`) at the inline start and the existing `OrderStatusBadge` at the inline end; a row with "{date} · {items}" (13, muted) and the total (`formatPrice(total)`, weight 800); an outline small full width "عرض الطلب" link to `routes.order(number)` with `aria-label="عرض الطلب {number}"`. The date is `formatDate(placed_at)`. The count is the number of order lines (distinct items, not the sum of quantities), as an ICU plural in Arabic: `{count, plural, one {منتج واحد} two {منتجان} few {{shown} منتجات} many {{shown} منتجًا} other {{shown} منتج}}`, called as `t("count", { count, shown: formatNumber(count) })`; its result fills `{items}`. A line count is always at least 1, so no `zero` branch is needed.
- **AC-4**: What is still owed. Under the total, one muted 13px line from `paymentState(amount_paid, total)` (the pure function from spec 0015): on a cancelled order, no line at all; `none`, no line (the card looks exactly like the design board); `partial`, "المتبقي {formatPrice(total − amount_paid)}"; `paid`, "مدفوع". Until Payments (feature 24) records money, `amount_paid` is 0 and no card shows the line.
- **AC-5**: Load more. Up to 20 orders show per step (`MY_ORDERS_PAGE_SIZE = 20`). `?page=N` (read with `parsePage`, then held to at most `MY_ORDERS_MAX_PAGE = 1000` by the pure `myOrdersLimit(page)`, which returns `min(page, 1000) × 20`) shows the first that many orders. When more orders exist than are shown, a line "تم عرض {shown} من {total} طلب" sits above an outline 48px "عرض المزيد" link to `routes.accountOrdersMore(N + 1, shown + 1)`, which opens the next step and jumps to the first new card (each card has `id="o-<index + 1>"` over the shown list, so positions count from 1). When everything is shown, neither the line nor the link appears. A `page` that is not a whole number, or is below 1, reads as 1; a page past the end shows every order with no link. At the cap (20,000 orders, beyond any real customer) the link also stops. The page never 404s on `page`, and a huge `page` never builds a huge query.
- **AC-6**: Empty. With no orders, the page shows the empty card from `my-orders.md` layout item 3, built with the shared `src/components/empty-state.tsx` (`EmptyState`) and its default `PackageOpen` icon: a 72px disc with the icon, h2 "لا توجد طلبات بعد", the line "عند إرسال أول طلب سيظهر هنا.", and a yellow large "تصفّح الأقسام" link to `routes.categories`.
- **AC-7**: Links both ways. Under the h1 "طلباتي", an outline link "بياناتي وكلمة المرور" goes to `routes.account`. On `/account`, a link "طلباتي" under its h1 goes to `routes.accountOrders`. Both are at least 44px tall and keyboard reachable with a visible focus style.
- **AC-8**: The account tab and the default landing. The bottom bar's account tab links to `routes.accountOrders`. `safeStorefrontNext` returns `routes.accountOrders` wherever it returned `routes.account` (spec 0017 AC-6 default), so register and sign in with no safe `next` land on My Orders. `/account` keeps its own uses: its signed out redirect (`next: routes.account`), the reset password page's redirect, and `/account?notice=password_set` stay as they are.
- **AC-9**: Loading and errors. A `loading.tsx` beside the page shows three skeleton cards shaped like AC-3 with `role="status"` and a visually hidden "جارٍ التحميل..." sentence (`design.md` section 7). A database failure throws to the shared `src/app/[locale]/error.tsx` (retry plus WhatsApp); no customer data is logged.
- **AC-10**: Layout on wider screens. Tablet and computer render the phone layout in one centered column at `max-width: var(--page-max)` (480px), page background on both sides (`my-orders.md`, interim for open item O-1). Header, footer, bottom bar, and the WhatsApp float are the shared parts.
- **AC-11**: Tests. Vitest beside the source for the money line function, the count plural keys, the load more math (`myOrdersStep`), and the new routes. Database tests for `readMyOrders`: only the user's orders, the sort with a tie, the line count, the window total, and a page past the end. Playwright on a phone sized RTL screen (390) and a computer sized one (1280): signed out lands on sign in and comes back; register, place two orders, see both newest first with status, count, and total, open one; set `amount_paid` to part of a total, then to the total, then cancel another order, and see "المتبقي ₪…", "مدفوع", and no line; a second account sees only its own orders; with 21 orders, see "تم عرض 20 من 21 طلب", tap "عرض المزيد", land on card 21, and the button is gone; a new account sees the empty card; the account tab and sign in land on `/account/orders`; the links both ways work. axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) finds nothing on the list and the empty state; every control is at least 44 by 44; no sideways scroll.

## Decision

**Chosen option**: a server rendered list with the remaining balance shown only once money is recorded, 20 orders per step through a `?page=` link, and line counts.

`/account/orders` is a Server Component that reads one windowed query from `getDb()`, filtered by the session's `sub`, and renders the design's cards. A pure function decides the money line from `paymentState`, and load more reuses the catalog's address based paging.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no new table, column, index, or migration. Read only:

| Table | Columns read | Used for |
|---|---|---|
| `orders` | `id`, `order_number`, `status`, `placed_at`, `total`, `amount_paid`; filter `placed_by_user_id` (`orders_placed_by_user_id_idx`) | AC-2 to AC-5 |
| `order_lines` | `count(*)` per `order_id` (`order_lines_order_id_idx`) | AC-3 count |

Name, phone, address, city, area, and notes are never selected.

**State transitions**: none written. The page only displays `orders.status` (spec 0014 owns the moves).

**API surface**:

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/account/orders` | page (Server Component) | `page` (opt, search param) | AC-3 to AC-7 | signed in (`getClaims()`), else redirect to sign in with `next` | none (bad `page` reads as 1; DB failure throws to `error.tsx`) |
| `readMyOrders(db, userId, page)` in `src/features/orders/server/my-orders.ts` | query | user id from the session, page | `{ rows: MyOrderRow[], total }`, rows `{ position, number, status, placedAt, total, amountPaid, lineCount }` | called only by the page with the session `sub` | throws on DB error |

`readMyOrders` is one select: the order columns, `(select count(*) from order_lines where order_id = orders.id)::int` as `line_count`, and `count(*) over ()` as `total`, where `placed_by_user_id = userId`, ordered `placed_at desc, order_number desc`, `limit myOrdersLimit(page)`. There is no `offset`: the window count runs before the limit, so `total` survives on every page, and a page past the end simply returns every row (never an empty result while orders exist). With zero rows there is no row to carry `total`, so it reads as 0. Types: `placedAt` comes back as a `Date` (Drizzle `timestamp` with time zone), `status` as `OrderStatus`, and both `line_count` and `total` are cast `::int` so the driver returns numbers, not bigint strings. `order_number` is fixed width (`yy-NNNNN`), so text ordering matches number ordering within the shop's volume; the tie test inserts two orders with the same explicit `placed_at`.

New files:
- `src/features/orders/my-orders.ts` (+ test): `MY_ORDERS_PAGE_SIZE = 20`, `MY_ORDERS_MAX_PAGE = 1000`; `myOrdersLimit(page)` = `min(page, MY_ORDERS_MAX_PAGE) × MY_ORDERS_PAGE_SIZE`; `orderMoneyLine(status, amountPaid, total)` returning `{ kind: "none" } | { kind: "remaining", amount } | { kind: "paid" }` (cancelled or `paymentState` `none` gives `none`); `myOrdersStep(page, shown, total)` returning `{ hasMore, nextPage, nextPosition }` with `hasMore = shown < total && page < MY_ORDERS_MAX_PAGE`, `nextPage = page + 1`, `nextPosition = shown + 1` (the last two are ignored when `hasMore` is false). Vitest cases: 20 of 21 (more, page 2, position 21), 21 of 21 (no more), page 9 with 21 orders (no more), 0 of 0 (no more), page 1000 (no more); `myOrdersLimit` for 1, 2, 1000, and 999999999.
- `src/features/orders/server/my-orders.ts` (+ db test): `readMyOrders`, with `server-only`.
- `src/features/orders/components/my-order-card.tsx`, `my-orders-empty.tsx`.
- `src/app/[locale]/account/orders/page.tsx` and `loading.tsx`.

Changed:
- `src/lib/routes.ts`: reuse the existing `accountOrders: "/account/orders"` (no second key for the same path) and add `accountOrdersMore(page, position)` (`/account/orders?page=N#o-<position>`; page 1 leaves out the query), with `routes.test.ts` cases.
- `src/features/shell/nav.ts` (+ `nav.test.ts`): the account tab to `routes.accountOrders`, its comment updated (spec 0017 AC-12 follow up done). `tabRules` already cover `/account/orders`.
- `src/features/accounts/next-path.ts` (+ test): every fallback return (all three sites) becomes `routes.accountOrders`.
- `src/app/[locale]/account/page.tsx`: the "طلباتي" link.
- `src/i18n/messages/ar.json`: `PageTitles.myOrders` "طلباتي | S.K.F للإنارة", and a `MyOrders` namespace (`title` "طلباتي", `profileLink` "بياناتي وكلمة المرور", `meta` "{date} · {items}", `count` the AC-3 plural, `view` "عرض الطلب", `viewLabel` "عرض الطلب {number}", `remaining` "المتبقي {amount}", `paid` "مدفوع", `shownOf` "تم عرض {shown} من {total} طلب", `more` "عرض المزيد", `emptyTitle` "لا توجد طلبات بعد", `emptyText` "عند إرسال أول طلب سيظهر هنا.", `emptyCta` "تصفّح الأقسام", `loading` "جارٍ التحميل..."), plus `Account.ordersLink` "طلباتي". Status words come from the existing `AdminOrders.status` through `OrderStatusBadge`.
- Tests: `e2e/my-orders.spec.ts`; `e2e/shell.spec.ts` and `e2e/customer-accounts.spec.ts` where they expect `/account` after the tab, register, or sign in.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Page | who is signed in | `getClaims().sub` |
| Page | which orders | `orders.placed_by_user_id = sub` |
| Page | order and tie break | `orders.placed_at desc`, then `orders.order_number desc` |
| Card | order number | `orders.order_number` |
| Card | status word and badge colour | `orders.status` → `AdminOrders.status.*` and `statusBadgeVariant` (spec 0014) |
| Card | date | `formatDate(orders.placed_at)`, shop time zone (spec 0005) |
| Card | item count | `count(order_lines)` for the order (lines, decided here) |
| Card | total | `formatPrice(orders.total)` |
| Card | money line | `orderMoneyLine(orders.status, orders.amount_paid, orders.total)` over `paymentState` (spec 0015) |
| Card | remaining amount | `orders.total − orders.amount_paid` (shown only when `partial`, so always above 0) |
| Card | link | `routes.order(orders.order_number)` (owner access, spec 0017 AC-14) |
| Card | anchor id | position in the sorted list, from 1 |
| List | how many to show | `myOrdersLimit(parsePage(searchParams.page))`: 20 per step, capped at page 1000 (decided here) |
| Page | browser title | `PageTitles.myOrders` |
| Empty | icon | `EmptyState` default `PackageOpen` |
| List | total orders | `count(*) over ()` in the same query |
| List | more link, next page, jump target | `myOrdersStep(page, rows.length, total)` |
| Nav | account tab target | `routes.accountOrders`, static (decided here) |
| Sign in | default landing | `safeStorefrontNext` default `routes.accountOrders` (decided here) |

**Key invariants**:
- The list's filter value comes only from the session's `sub`, never from the address or a form.
- A card never shows a remaining amount on a cancelled order, and never a remaining amount of 0 or less.
- `shown ≤ total`, and the load more link appears exactly when `shown < total`.
- The page selects no personal field (name, phone, address, notes).

**Security model**: The page is a read, so it uses `getClaims()` (spec 0001 rule). The only authorization is the `placed_by_user_id = sub` filter inside `readMyOrders`, in a `server/` module with `server-only`, through `getDb()`; RLS and the revoked grants keep `orders` closed to `anon` and `authenticated` as before. Opening an order goes through the order page's existing owner check (spec 0017 AC-14), so this page grants no new access. No Server Action and no write, so no rate limit is needed beyond Supabase's on sign in. Nothing about the customer is logged. No regulated compliance scope applies.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: register, place two orders, open `/account/orders` from the account tab, see both newest first with badge, date, line count, and total, open one, verifies **AC-2**, **AC-3**, **AC-8**
- Money line: partial payment shows "المتبقي", full shows "مدفوع", cancelled and unpaid show nothing, verifies **AC-4**
- Paging: 21 orders show 20 with the count line, "عرض المزيد" lands on card 21, `?page=abc` and `?page=9` still render, verifies **AC-5**
- Auth/permission: signed out is sent to sign in and comes back; a second account sees only its own orders and never the first account's numbers, verifies **AC-1**, **AC-2**
- Empty and failure: a new account sees the empty card; a database failure shows the shared error card, verifies **AC-6**, **AC-9**

## Build plan

Tracer Bullet: one real order reaches the new page first, then each part thickens.

1. **Thin thread: my order shows up.** `routes.accountOrders`; `readMyOrders` with its database tests (filter, sort with a tie, line count, window total); the page with the signed out redirect, h1, and plain cards (number, badge, date, line count plural, total, "عرض الطلب" link with its label); the `MyOrders` messages; one Playwright path on 390: register, place an order, open `/account/orders`, see the card, open the order. Satisfies **AC-1**, **AC-2**, **AC-3**
2. **What is still owed.** `orderMoneyLine` with Vitest (cancelled, none, partial, paid, paid above total); the muted line on the card; database driven e2e for partial, paid, and cancelled. Satisfies **AC-4**
3. **Load more and empty.** `MY_ORDERS_PAGE_SIZE`, `MY_ORDERS_MAX_PAGE`, `myOrdersLimit` and `myOrdersStep` with Vitest, `routes.accountOrdersMore`, the count line, the link, the `o-<position>` ids; the empty card. Satisfies **AC-5**, **AC-6**
4. **Getting here.** The profile link under the h1, the "طلباتي" link on `/account`, the account tab to `routes.accountOrders`, the `safeStorefrontNext` default with its tests updated; fix the shell and customer accounts e2e expectations. Satisfies **AC-7**, **AC-8**
5. **Finish.** `loading.tsx` skeleton; the centered column on 1280; the full Playwright set on 390 and 1280 with a second account, 21 orders, and axe. Satisfies **AC-9**, **AC-10**, **AC-11**

## Consequences

**Positive**:
- Customers and electricians follow every order in one place without the number plus phone lookup.
- No migration and no new write path, so nothing can corrupt order data.
- The money line already works the day Payments (feature 24) starts recording payments, with no change here.

**Negative / tradeoffs**:
- Until feature 24 ships, no card says anything about money, so the "what is still owed" part of the scope is met in form but shows nothing yet.
- Counting lines means a 200 bulb order reads "منتج واحد"; the quantities are only on the order page.
- `?page=N` re renders the first `N × 20` orders each step, so a customer with hundreds of orders loads more rows each tap (fine at a shop's volume; a cursor would fix it).
- Guest orders placed before registering stay invisible here (spec 0017), which may confuse a customer who ordered as a guest first.
- The default after sign in and the account tab change from spec 0017, so existing e2e expectations (`e2e/shell.spec.ts`, `e2e/customer-accounts.spec.ts`) and `nav.test.ts` and `next-path.test.ts` move with this feature.
- The page is a read on `getClaims()` (the signed token), so an account that is revoked or deleted keeps seeing its own list until its token expires. Accepted: it shows only that account's own orders.
- Orders past the 20,000th for one account are unreachable through load more (the cap that keeps the query bounded).

**Neutral**:
- `/account` becomes a second level page reached from My Orders.
- The status words are shared with the dashboard (`AdminOrders.status`); renaming one renames both.

## Follow-up

- [ ] Feature 24 (Payments): when it records refunds, revisit whether a cancelled order with money paid should show a refund line here and on the order page.
- [ ] Feature 31 (Loyalty coins): add the coin balance to this page, per the scope row.
- [ ] Design open items O-1 (desktop layout) and O-15 (account menu, electrician drafts link) stay open; this spec uses the interim column and plain links.
- [ ] Spec 0017's follow up for feature 19 is done by AC-8 once this ships.
