# 0016. Cancel before delivery

**Date**: 2026-10-28
**Status**: In Progress

## Summary

Customers can cancel their own order from its order page until it leaves the shop (new, preparing, or ready) and as long as no payment is recorded on it. They confirm in a dialog, may add an optional reason, and the order becomes cancelled at once. Then WhatsApp opens one time with "مرحباً، ألغيت الطلب رقم <number> من الموقع.", and the dashboard flags the order as "ألغاه العميل" whether or not the message is sent. Once the order is out for delivery or has a payment, the button is replaced by a short note and a WhatsApp request button, and you decide. There's no database change: the cancel reuses the columns, the guarded update, and the unseen flag that spec 0014 already built.

## Requirements

**User stories**:
- As a customer, I want to cancel an order I no longer need from its page, without waiting for the shop to answer.
- As a customer, I want to see clearly that my order is cancelled, and who cancelled it and when.
- As the owner, I want every customer cancel to stand out in the dashboard even if the customer never sends the WhatsApp message.
- As the owner, I want a driver already on the road, or an order with money recorded on it, never to be cancelled without me.

**Acceptance criteria** (these build on spec 0015, whose order page this extends, and spec 0014, whose cancel write and unseen flag this reuses):

- **AC-1**: Cancel rule. A pure `customerCancelState(status, amountPaid)` in `src/features/orders/customer-cancel.ts` returns, checked in this order: `"final"` for `delivered` and `cancelled`; `"shipped"` for `out_for_delivery`; `"paid"` when `amountPaid > 0`; otherwise `"allowed"`. So `new`, `confirmed`, `preparing`, and `ready` with `amount_paid = 0` are `"allowed"`, on both fulfilment paths. A pickup order at `out_for_delivery` (off its path) is `"shipped"`. An order that is out for delivery and also paid is `"shipped"`.
- **AC-2**: Cancel button. When the rule is `"allowed"`, the order page shows an outline large button "إلغاء الطلب" directly below the contact button (design `order.md`, Cancel row). It is a client component that renders the button only after mount (`useSyncExternalStore` with a server snapshot of `false`, as `CopyOrderNumber` does), so the server HTML never shows a button that cannot work. Without JavaScript the customer sees no cancel button and still has the contact button. The button appearing after load shifts nothing above it (it sits last on the page), so no space is reserved for it.
- **AC-3**: Confirm dialog. The button opens an `AlertDialog` titled "إلغاء الطلب <number>؟" (number in `Ltr`), with the line "سيُلغى الطلب فوراً، ولا يمكن التراجع عن الإلغاء.", an optional labelled textarea "سبب الإلغاء (اختياري)" (`maxLength` `CANCEL_REASON_MAX`, 300), and two buttons, "تأكيد الإلغاء" and "تراجع", styled like the dashboard's `CancelOrderDialog`. While the action runs both buttons are disabled and the dialog cannot be closed. The action call and any `router.refresh()` run inside one `startTransition`.
- **AC-4**: The action. The Server Action `cancelOrderByCustomer({ orderId, from, reason? })` in `src/features/orders/server/customer-actions.ts` (`"use server"`) parses its input with the existing `cancelOrderSchema` (`invalid`; blank reason becomes `null`, at most 300 characters after tidying). It then reads `skf_placed` and `skf_tracked` and returns `not_found` without any query when `orderId` is in neither. Otherwise `cancelOrderByCustomerInDb` runs one transaction: it reads the order `for update` (status, fulfilment, number, `amount_paid`) and checks in this order: `not_found` when missing, then `stale` when the stored status is not `from` (compared as stored), then `not_allowed` when `customerCancelState(status, amount_paid)` is not `"allowed"`. Otherwise it updates the order with `where id = orderId and status = from`, setting `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'guest'`, and `cancel_reason` (the reason, or `null`). It inserts one `order_events` row: type `cancelled`, `actor_kind = 'guest'`, `actor_user_id = null`, `from_status = from`, `to_status = 'cancelled'`, `data = {}`, **`seen_at = null`**. After commit it calls `revalidatePath(routes.order(number))`, logs `{ event: "order_cancelled_by_customer", orderId, from }` only, and returns `ok({ status: "cancelled" })`. The action never calls `requireAdmin()`, never reads Supabase Auth, and has no rate limit.
- **AC-5**: After success. The dialog closes, the page shows the cancelled state (AC-7), and the browser calls `window.location.assign(W6)` once, where W6 is `whatsappUrl(NEXT_PUBLIC_WHATSAPP_NUMBER, Shell.whatsappMessages.cancelled)` with the plain order number: "مرحباً، ألغيت الطلب رقم {number} من الموقع.". The page builds this URL on the server and passes it to the client component as the `notifyUrl` prop. The success branch copies `notifyUrl` into a local constant before the `await` and calls `window.location.assign` from that constant, never from component state, because the revalidated page unmounts `CustomerCancel` as soon as the action response is applied. Before the hand off it moves focus to the header status badge (AC-7). The cancelled view is not guaranteed to paint before the hand off. So the order page has a small client `RefreshOnRestore` that calls `router.refresh()` on a `pageshow` event with `persisted` true: coming back from WhatsApp through the browser's back and forward cache always shows the current state. Nothing is written to `localStorage`, `sessionStorage`, or a cookie for this; a second cancel can never succeed, so the hand off cannot repeat. The order is already cancelled whether or not WhatsApp opens or the message is sent. The green "أخبرنا بالإلغاء عبر واتساب" button (AC-7) is the fallback when the hand off does not open the app (iOS Safari may show wa.me's web page, since the call runs after an `await`, outside the tap).
- **AC-6**: Errors. `stale` and `not_allowed` show, in a `role="alert"` line inside the dialog, "تغيّرت حالة الطلب. حدّثنا الصفحة لتظهر الحالة الحالية.", and call `router.refresh()`. If the refreshed page no longer offers the button (the owner moved it out for delivery, cancelled it, or recorded a payment meanwhile), the dialog goes away with it, the page shows the new state (AC-7 or AC-8), and `CustomerCancel` moves focus to the header status badge as it unmounts. If the refreshed page still offers the button (the owner moved `new` to `preparing`), the dialog stays open with the new `from`. Any message clears when the `status` prop changes and when the dialog closes. The typed reason is kept in both cases. `invalid`, `not_found`, and a thrown error (caught in the client) show "تعذّر إلغاء الطلب. حدّث الصفحة وحاول مرة أخرى." and the dialog stays open. Nothing is written in any of these cases.
- **AC-7**: Cancelled view. `readCustomerOrder` also selects `cancelled_at` and `cancelled_by` (never `cancel_reason`). The header status badge gets `id="order-status"` and `tabIndex={-1}` on every order page, so the cancel component can move focus to it (AC-5, AC-6). For a cancelled order the badge stays "ملغي" (`off`), and the timeline card's one line becomes "ألغيت هذا الطلب في <at>" when `cancelled_by` is `guest`, `customer`, or `electrician`, and "ألغى المتجر هذا الطلب في <at>" when it is `admin`, `system`, or `null`. `<at>` is `formatDateTime(cancelled_at)` inside `<time dateTime={cancelled_at ISO}>`, the same format as spec 0014's "أُلغي في". If `cancelled_at` is somehow null, the line falls back to today's "تم إلغاء هذا الطلب". A pure `cancelledLine(cancelledBy)` returns `"byYou"` or `"byShop"`. The green button always follows `cancelledLine(cancelled_by)`, whether or not the date line fell back. With `byYou` it becomes "أخبرنا بالإلغاء عبر واتساب" with W6 (AC-5), in place of "تواصل معنا عبر واتساب". With `byShop` the green W7 contact button stays. The payment card stays as spec 0015 AC-11 (method only, no badge). There's no cancel button and no note. The reason is never shown to the customer.
- **AC-8**: Blocked view. When the rule is `"shipped"` or `"paid"`, in place of the button the page shows a muted note and an outline large button "طلب الإلغاء عبر واتساب" opening `whatsappUrl(NEXT_PUBLIC_WHATSAPP_NUMBER, Shell.whatsappMessages.cancelRequest)`: "مرحباً، أريد إلغاء الطلب رقم {number}.", with `target="_blank"` and `rel="noopener"`. The note for `"shipped"` reads "طلبك في الطريق إليك. لإلغائه الآن تواصل معنا عبر واتساب.", and for `"paid"` "سجّلنا دفعة على هذا الطلب، لذا يتم إلغاؤه عبر واتساب.". Nothing is saved; the status changes only when you change it. A delivered order shows neither the button nor the note. This part is server rendered and works without JavaScript.
- **AC-9**: Dashboard. Built by spec 0014 and checked end to end here, with no dashboard code change: after a customer cancel, `/admin/orders` shows the yellow unseen dot and the "ألغاه العميل" badge on that row, the sidebar count goes up by one (on the next dashboard load, or within the 60 second refresh), the order page's status card reads "أُلغي في <cancelled_at> بواسطة العميل" plus "السبب: <reason>" when one was typed, and the history ends with "أُلغي الطلب بواسطة العميل". Opening the order clears the dot and the count, as spec 0014 AC-14 says.
- **AC-10**: Privacy and logs. The reason travels only in the Server Action's POST body, is stored only in `orders.cancel_reason`, and is never logged, put in a URL, put in the event `data`, or sent to the customer page. The only log line is AC-4's. The customer page select still names none of the columns spec 0015 AC-13 forbids, and now also never names `cancel_reason`.
- **AC-11**: Playwright flows pass on a phone sized RTL screen (390) and a computer sized one (1280). Place a delivery order, open its page, cancel with a reason, and land on the W6 URL: the test fulfils `https://wa.me/**` with `page.route` (an empty 200, so CI needs no network) and asserts the navigated URL holds the W6 text with the number. Go back to the order page and see "ملغي", "ألغيت هذا الطلب في …", the "أخبرنا بالإلغاء عبر واتساب" button whose link holds W6, and no cancel button. Cancel a pickup order at `ready` too. Look up an order from a fresh context (`skf_tracked` only) and cancel it. Move an order to `out_for_delivery` in the dashboard and see the shipped note and the request button with the W6 request text. Record a payment with the database helper and see the paid note. A cancel sent after the owner moved the order in another tab shows the changed message and then the shipped note. Calling the action for an order id the browser does not hold returns `not_found` and writes nothing (action test). In the dashboard, after a fresh `page.goto`, the cancelled order shows the dot, "ألغاه العميل", the reason, the history line, and the sidebar count. A `page.on("console")` spy checks the browser's own output only and sees no reason, name, phone, or address (the server log line is checked by the action test, AC-10). The dialog, the cancelled view, and the blocked view pass the axe check.

## Decision

**Chosen option**: Option 1: Cancel at once through the same guarded write as the dashboard, then tell the shop on WhatsApp.

A pure cutoff rule, one Server Action guarded by the order cookies, and a customer cancel write added next to the owner's cancel write, which reuses its row lock, its guarded update, and its single event row, written unseen so spec 0014 flags it. No migration.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`, the Server Action and the client island) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`, AlertDialog and Textarea on Base UI) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`, the locked guarded update) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Feature design

**Data model sketch**: no new table, column, enum value, or migration. Spec 0002 as built:

| Table | Key | Read | Written by this feature |
|---|---|---|---|
| `orders` | `id` PK, `order_number` unique | `status`, `fulfilment`, `order_number`, `amount_paid` (in the lock); `cancelled_at`, `cancelled_by` (customer page) | `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'guest'`, `cancel_reason` (nullable text, at most 300), `updated_at` through the timestamps helper |
| `order_events` | `id` PK, `order_id` FK `orders` (N:1) | nothing | one row: `type = 'cancelled'`, `actor_kind = 'guest'`, `actor_user_id = null`, `from_status`, `to_status = 'cancelled'`, `data = {}`, `seen_at = null` |
| `skf_placed`, `skf_tracked` | cookies (order uuids) | the allowed ids | nothing |

Existing rules carry the safety: `orders_cancelled_check` (`cancelled_at` set exactly when cancelled), the `for update` lock, and `where status = from`.

**State transitions** (customer side only; the owner's moves stay as spec 0014 AC-2):

```
new | confirmed | preparing | ready   (amount_paid = 0)  →  cancelled   (by the customer)
out_for_delivery                                          →  request only (W6 request, no write)
amount_paid > 0 (any status before delivered)             →  request only
delivered, cancelled                                      →  final, nothing offered
```

**API surface**:

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `customerCancelState` (`src/features/orders/customer-cancel.ts`, pure) | function | `status`, `amountPaid` | `"allowed" \| "shipped" \| "paid" \| "final"` | none | none |
| `cancelledLine` (same file, pure) | function | `cancelledBy: ActorKind \| null` | `"byYou" \| "byShop"` | none | none |
| `ActorKind` (`src/features/orders/status.ts`, moved) | type | none | `"guest" \| "customer" \| "electrician" \| "admin" \| "system"` | none | none |
| `cancelOrderByCustomer` (`src/features/orders/server/customer-actions.ts`, `"use server"`) | Server Action | `orderId: uuid` (req), `from: status` (req), `reason: string ≤ 300` (opt) | `Result<{ status: "cancelled" }, "invalid" \| "not_found" \| "stale" \| "not_allowed">` | order id in `skf_placed` ∪ `skf_tracked` | as listed |
| `cancelOrderByCustomerInDb(db, input)` (`src/features/orders/server/admin-status.ts`, beside `cancelOrderInDb`) | transaction | `CancelOrderInput` | `MoveResult<"cancelled">` (with `number`) | server only | `not_found`, `stale`, `not_allowed` |
| `readCustomerOrder` (`customer-order.ts`, changed) | query | as today | `CustomerOrder` plus `cancelledAt: Date \| null`, `cancelledBy: ActorKind \| null` | as today | as today |
| `CustomerCancel` (`src/features/orders/components/customer-cancel.tsx`, client) | component | `orderId`, `number`, `status`, `notifyUrl` (W6) | the button and dialog (AC-2, AC-3, AC-5, AC-6) | none | messages as AC-6 |
| `RefreshOnRestore` (`src/features/orders/components/refresh-on-restore.tsx`, client) | component | none | `router.refresh()` on `pageshow` with `persisted` (AC-5) | none | none |
| `CancelBlocked` (`src/features/orders/components/cancel-blocked.tsx`, server) | component | `reason: "shipped" \| "paid"`, `requestUrl` | note plus request link (AC-8) | none | none |
| `OrderTimeline` (changed) | component | adds `cancelled?: { line: "byYou" \| "byShop"; at: Date } \| null` | AC-7 line | none | none |

**Shared write module**: `cancelOrderByCustomerInDb` sits beside `cancelOrderInDb` in `src/features/orders/server/admin-status.ts` (no rename; its header comment notes it now holds the customer cancel too) and reuses its private `lockOrder` (which now also selects `amountPaid`), `updateWhileAt`, and `staleOnRace`. Its database tests go in `admin-status.db.test.ts`. The owner's actions and their behaviour do not change.

**One `ActorKind`**: the type moves to `src/features/orders/status.ts` (pure, importable by client and server code). `server/admin-queries.ts` re-exports it, and the local copies in `admin-history.ts` and `order-status-card.tsx` import it instead. `customer-cancel.ts` and `CustomerOrder` import it from `status.ts`, never from a server only file.

**Order page wiring** (`src/app/[locale]/orders/[number]/page.tsx`): after the contact button, the page renders by `customerCancelState(order.status, order.amountPaid)`: `"allowed"` gives `CustomerCancel`, `"shipped"` and `"paid"` give `CancelBlocked`, `"final"` gives nothing. For a cancelled order, the green button's label and URL switch per AC-7. The page builds both WhatsApp URLs (W6 cancelled, W6 request) with `getTranslations("Shell")`, as it builds W7 today.

**Strings** (`src/i18n/messages/ar.json`):
- `OrderPage`: `cancel` "إلغاء الطلب", `cancelTitle` "إلغاء الطلب <ltr>{number}</ltr>؟", `cancelBody` "سيُلغى الطلب فوراً، ولا يمكن التراجع عن الإلغاء.", `cancelReason` "سبب الإلغاء (اختياري)", `cancelConfirm` "تأكيد الإلغاء", `cancelKeep` "تراجع", `cancelChanged` "تغيّرت حالة الطلب. حدّثنا الصفحة لتظهر الحالة الحالية.", `cancelFailed` "تعذّر إلغاء الطلب. حدّث الصفحة وحاول مرة أخرى.", `cancelledByYou` "ألغيت هذا الطلب في {date}", `cancelledByShop` "ألغى المتجر هذا الطلب في {date}", `tellCancelled` "أخبرنا بالإلغاء عبر واتساب", `blockedShipped` "طلبك في الطريق إليك. لإلغائه الآن تواصل معنا عبر واتساب.", `blockedPaid` "سجّلنا دفعة على هذا الطلب، لذا يتم إلغاؤه عبر واتساب.", `requestCancel` "طلب الإلغاء عبر واتساب". `cancelledNotice` stays as the fallback.
- `Shell.whatsappMessages`: `cancelled` "مرحباً، ألغيت الطلب رقم {number} من الموقع." (W6, now past tense), `cancelRequest` "مرحباً، أريد إلغاء الطلب رقم {number}." (the design's W6 wording, kept for the request).

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Order page | which cancel UI shows | `customerCancelState(orders.status, orders.amount_paid)` |
| Cancel button | `orderId`, `from` | the page's `order.id` and `order.status` (inputs) |
| Cancel | reason | the dialog textarea, through `cancelOrderSchema` (input) |
| Cancel | who may cancel | `orderId` ∈ `skf_placed` ∪ `skf_tracked` (`readPlacedIds`, `readTrackedIds`) |
| Cancel | the rule inside the lock | locked `orders.status` and `orders.amount_paid` |
| Cancel | `cancelled_at`, event time | `now()` in the transaction |
| Cancel | `cancelled_by`, `actor_kind` | the literal `'guest'` (no customer accounts yet; feature 18 changes this) |
| Cancel | `actor_user_id`, event `seen_at` | `null`, `null` |
| Cancel | path to revalidate | `routes.order(number)` with the locked `orders.order_number` |
| Hand off | W6 text and number | `Shell.whatsappMessages.cancelled` with `orders.order_number`; `NEXT_PUBLIC_WHATSAPP_NUMBER` |
| Cancelled view | who line, date | `cancelledLine(orders.cancelled_by)`; `formatDateTime(orders.cancelled_at)` on the shop clock, in `<time>` |
| Focus after cancel | target | the header badge `#order-status` (`tabIndex={-1}`) |
| Cancelled view | green button | W6 when `cancelledLine` is `byYou`, else W7 (spec 0015 AC-12) |
| Blocked view | note, request text | the rule result; `Shell.whatsappMessages.cancelRequest` with `orders.order_number` |
| Dashboard | dot, badge, count, history, reason | spec 0014 reads of the unseen `cancelled` event, `orders.cancelled_by`, `orders.cancel_reason` |

**Key invariants**:
- A customer cancel happens only for an order whose id the browser holds, only from `new`, `confirmed`, `preparing`, or `ready`, and only with `amount_paid = 0`, all checked inside the row lock.
- One cancel writes exactly one `cancelled` event, and a customer's event is always written unseen, so the dashboard always flags it.
- A cancel applies only when the stored status equals the status the page showed; any change in between gives `stale` or `not_allowed` and writes nothing.
- Cancelled is final for everyone. No action moves an order out of it.
- The reason never reaches a log, a URL, the event data, or the customer's page.

**Security model**: the action is public but needs an order uuid the browser already holds in an httpOnly cookie: `skf_placed` (it placed the order) or `skf_tracked` (it matched number plus phone, behind spec 0015's rate limits). The uuid is unguessable, the check runs on the server before any query, and the write is a single final step with no repeat, so there is nothing to brute force and no separate rate limit. Next.js Server Actions already refuse cross site POSTs (Origin check). All data goes through `getDb()` in `server/` modules with `server-only`; RLS keeps both tables closed to `anon` and `authenticated`. An admin who holds the cookie for an order (a test order) cancels it as `guest` from the customer page, which is accurate for that page. No regulated compliance scope applies; the customer reason is personal text and falls under the project's no logging rule.

**Configuration required**: none. No new env var, binding, or secret.

**Critical test scenarios**:
- `customerCancelState`: each status with `amount_paid` 0 and above 0, `confirmed` as allowed, pickup at `out_for_delivery` as shipped, shipped beating paid, final for delivered and cancelled (unit), verifies **AC-1**
- `cancelledLine`: each `actor_kind` and `null` (unit), verifies **AC-7**
- `cancelOrderByCustomerInDb`: an allowed order gets the four columns and one unseen `cancelled` event with `actor_kind = 'guest'` and `data = {}`; a wrong `from` gives `stale`; `out_for_delivery` and a paid order give `not_allowed`; a delivered order with `from = 'delivered'` gives `not_allowed`, and with any other `from` gives `stale`; an unknown id gives `not_found`; none of the failures write (database test), verifies **AC-1**, **AC-4**, **AC-6**
- `cancelOrderByCustomer`: an id outside both cookies gives `not_found` with no database call; an id in either cookie reaches the write; bad input gives `invalid`; the log line holds only event, id, and from, never the reason (action test with stand ins and a console spy), verifies **AC-4**, **AC-10**
- Owner cancel unchanged after `lockOrder` reads `amountPaid`: the existing spec 0014 database tests pass as they are, verifies **AC-9**
- `CustomerCancel`: the success branch calls `window.location.assign` with the `notifyUrl` captured before the `await`, after the component has unmounted; focus lands on `#order-status`; the message clears on a new `status` prop and on close, and the reason is kept (component test), verifies **AC-5**, **AC-6**
- `readCustomerOrder`: returns `cancelledAt` and `cancelledBy`; the select still names no forbidden column and no `cancel_reason` (database test), verifies **AC-7**, **AC-10**
- `countUnseenOrders` counts the order again after a customer cancel (existing spec 0014 test, extended with a cancel through the new write), verifies **AC-9**
- Full flows on 390 and 1280 as AC-11, verifies **AC-2**, **AC-3**, **AC-5** to **AC-9**, **AC-11**

## Build plan

Tracer Bullet: one real customer cancel goes from the order page button to the dashboard flag first, then each part thickens.

1. [x] **Thin thread: one cancel end to end.** `customerCancelState` with Vitest; move `ActorKind` to `status.ts`; in `admin-status.ts`, `lockOrder` reads `amountPaid` and `cancelOrderByCustomerInDb` joins `cancelOrderInDb`, with its database test; `cancelOrderByCustomer` with the cookie check and its action test; `CustomerCancel` with the button after mount, the dialog, the reason, and success refresh; the page renders it when allowed; the cancel strings; one Playwright path: cancel, see "ملغي", see "ألغاه العميل" in the dashboard. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-9**
2. [x] **Tell the shop.** The two `Shell.whatsappMessages` strings; the page builds W6 and passes `notifyUrl`; the one time `window.location.assign` from the captured constant after success; focus to the focusable header badge; `RefreshOnRestore` on the order page. Satisfies **AC-5**
3. [x] **Cancelled and blocked views.** `readCustomerOrder` selects `cancelled_at` and `cancelled_by` with its test; `cancelledLine` with Vitest; the `OrderTimeline` who and when line through `formatDateTime` in `<time>`; the green button swap; `CancelBlocked` with both notes and the request link. Satisfies **AC-7**, **AC-8**
4. [x] **When things change underneath.** The `stale`, `not_allowed`, `invalid`, `not_found`, and thrown error messages in the dialog, the refresh, clearing on a new status and on close, focus to the badge when the dialog goes away, and pending disabled controls; the log line and its spy. Satisfies **AC-6**, **AC-10**
5. [x] **Phone and computer flows.** Playwright on 390 and 1280 for everything in AC-11, `page.route` for `wa.me`, a database helper that records a payment amount, the second tab race, the dashboard checks, the console spy, and axe on the dialog, the cancelled view, and the blocked view. Satisfies **AC-11**, and checks **AC-2** to **AC-10** end to end

## Consequences

**Positive**:
- Customers cancel in seconds without waiting for a reply, and you never miss one: the flag does not depend on the WhatsApp send.
- One write path for both cancels: the same row lock, guarded update, and single event, so a customer and the owner acting at the same moment can never overwrite each other.
- No migration, no new secret, and no new binding.

**Negative / tradeoffs**:
- A cancel is final. A customer who taps by mistake must place the order again; the confirm dialog is the only guard.
- Anyone holding a browser that unlocked the order (a shared phone, for 30 days through `skf_tracked`) can cancel it, not only view it.
- Every customer cancel is recorded as `guest` until accounts exist, even for an electrician's order; the dashboard shows "العميل" for all of them anyway.
- Without JavaScript there's no cancel button. The request button on blocked orders and the contact button still work.
- On a computer the hand off leaves the order page for wa.me's page; the back button returns to it.
- On iOS Safari the hand off may show wa.me's web page instead of opening the app, because it runs after the action returns, not inside the tap. The green "أخبرنا بالإلغاء عبر واتساب" button is the fallback.
- The cancel button appears after load, so the page grows by one button once JavaScript runs.
- The reason the customer typed is not shown back to them.

**Neutral**:
- The design's W6 ("أريد إلغاء الطلب") now serves only the request on blocked orders; the cancel itself sends a new past tense W6.
- `admin-status.ts` keeps its name although it now holds the customer cancel too; a rename can come with any later change that touches all its importers.
- `ActorKind` moves to `status.ts`, replacing three copies.
- The scope's open question on cancellation rules (feature 17) is answered here: self cancel until the order leaves the shop and only while unpaid.

## Follow-up

- [ ] Feature 18 (customer accounts): when a signed in owner of the order cancels, write `cancelled_by` and `actor_kind` as `customer` or `electrician` (from `placed_by_role`) with `actor_user_id`, instead of `guest`.
- [ ] Feature 27 (sales report): count customer cancelled orders the same way as owner cancelled ones (no sale), as that spec decides.
- [ ] Mark spec 0015's follow up "Feature 17 (cancel before delivery)…" done when this ships.
- [ ] Update `docs/design/pages/order.md` (button label "إلغاء الطلب", the dialog, the blocked note and request button, the who and when line, the cancel rule now decided) and `docs/design/handoff.md` section 9 (the Cancel flow and the two W6 texts) as the design source of truth.
- [ ] Remove the scope's open question "Cancellation rules…(17)" from `docs/scope/index.md` once this spec is accepted.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
