# 0022. Electrician price adjustments

**Date**: 2026-11-04
**Status**: In Progress

## Summary

On an electrician's order, you press "تعديل الأسعار" on the dashboard order page, type a lower unit price on any lines, and save once. The save is one transaction: the line totals, subtotal, and total update; each changed line is recorded with its old and new price; and one history entry holds who, when, and your optional private note. The catalog price never changes, and the price copied at ordering stays on the line. The electrician's order page then shows the old price struck through beside the new one and the discount they got. Prices lock once the order is delivered or cancelled, and a cut can never push the total below what was already paid.

## Requirements

**User stories**:
- As the owner, I want to give an electrician a better price on some lines of one order, so I can reward a big job without touching the public catalog.
- As the owner, I want every price change kept with who, when, old and new price, and my reason, so I can always see why an order's total moved.
- As an electrician, I want to see the price I actually pay next to the catalog price, so I know the deal I got.

**Acceptance criteria**:
- **AC-1**: Which orders. `/admin/orders/[number]` shows an outline small button "تعديل الأسعار" above the lines table only when `canAdjustPrices(placedByRole: UserRole | null, status: OrderStatus)` is true: `placed_by_role = 'electrician'` and `status` is `new`, `confirmed`, `preparing`, `ready`, or `out_for_delivery`. A null `placed_by_role` (guest orders) counts as not electrician. An electrician order that is `delivered` or `cancelled` shows no button and a muted line "الأسعار مقفلة بعد التسليم أو الإلغاء.". Any other order (customer, guest, admin placed) shows neither. The role is the one saved on the order at placement, so a later promotion or demotion of the account changes nothing.
- **AC-2**: Edit mode. Pressing the button turns each line's سعر الوحدة cell into a number field (small, 40 high, `inputMode="decimal"`, `aria-label` "سعر الوحدة للسطر {n}", `n` the line's position from 1 in the page's existing `sort` order), prefilled with `toShekelsInput(unit_price)`. Beside each field the catalog unit price shows struck through when the typed value differs from it. A line whose field differs from its catalog price shows a link button "السعر الأصلي" that puts `toShekelsInput(catalog_unit_price)` back in the field. Under the table: an optional field "ملاحظة (تظهر لك فقط)" (up to 200 characters) and two buttons, primary "حفظ الأسعار" and outline "إلغاء". While editing, each line total and the totals card show a live preview from the typed values: a value that parses is previewed even when above the catalog price (its error still shows); a field that does not parse keeps its line's saved total in the preview. A preview that `computeOrderTotals` rejects (total below 0) shows the saved totals instead of throwing. "حفظ الأسعار" is disabled while no field differs from the saved `unit_price`. "إلغاء" leaves edit mode and drops every typed value. The button "تعديل الأسعار" is hidden while editing.
- **AC-3**: Price rule. Each field takes shekels with up to two decimals, Arabic or Western digits, commas allowed (the catalog price field rules, spec 0006), and 0 is allowed (a free line). With zero allowed, "0", "0.00", and "00" all mean 0. It must be at most that line's `catalog_unit_price`. A field never touched is not sent; a field cleared to empty is sent as `""` and fails as `required`. Errors under the field, with `aria-invalid` and `aria-describedby`: empty "أدخل السعر.", not a price "اكتب سعراً صحيحاً.", above the catalog price "لا يمكن أن يزيد السعر عن سعر الكتالوج ({price}).". On save the page checks every field first, marks every problem, focuses the first, and sends nothing. The server runs the same checks on every line it receives: `adjustedPriceField` (in the action's Zod schema, before any database read) gives only `required` and `price_invalid`; `above_catalog` is checked inside the transaction under the lock against the stored `catalog_unit_price`, and returned the same way (`invalid` with `lineErrors`, nothing written).
- **AC-4**: Save. "حفظ الأسعار" calls `adjustOrderPrices` with the order id, `expectedTotal` (the saved `total` when edit mode opened), the optional note, and only the lines whose typed value differs from the saved `unit_price`, each with its `lineId`, `expectedUnitPrice` (the saved `unit_price`), and the typed text. The action first runs `requireAdmin()` and the Zod schema (shape, `adjustedPriceField`, the note through `tidiedText({ optional: true, max: 200 })`). Then in one transaction, checking in this fixed order: lock the order row `for update` and read `total` (this is `fromTotal`), `amount_paid`, `placed_by_role`, `status` (missing: `not_found`); lock the sent lines `for update` ordered by `id`, scoped to this order (any `lineId` not found: `not_found`); AC-1 role (`not_electrician`); AC-1 status (`locked`); `total = expectedTotal` and each sent line's `unit_price = expectedUnitPrice` (`stale`); each parsed price `<= catalog_unit_price` (`invalid` with `lineErrors` of `above_catalog`); at least one parsed price differs from its line's current `unit_price` (`no_change`, for example "5.0" typed over 5). Then for each line whose price differs: update `unit_price` and `line_total` (`computeLineTotal`); run `recomputeOrderTotals` (its own `for update` on the order is a harmless relock; its result's `total` is `toTotal`); check `toTotal >= amount_paid` (`below_paid`, the transaction rolls back); insert one `order_events` row (`type = 'line_price_changed'`, `actor_kind = 'admin'`, `actor_user_id` the admin, `seen_at = now()`, `data = { lineCount, fromTotal, toTotal, note? }`, `note` left out when empty); insert one `order_line_price_changes` row per changed line pointing at that event; commit. Any later money action (feature 24 payments, feature 34 returns) takes the same lock order: order row first, then lines. Then edit mode closes, the page shows the saved values, and a notice with `role="status"` reads "حُفظت الأسعار.". Lines not sent are not touched.
- **AC-5**: Catalog untouched. After any save, `order_lines.catalog_unit_price` and `product_variants.price` are unchanged, `line_total = unit_price * quantity` on every line, and `total = subtotal + delivery_fee - discount_total`. `delivery_fee` and `discount_total` never change in this feature.
- **AC-6**: Refusals. Each is a typed result; nothing is written. `forbidden` (not an `aal2` admin, from `requireAdmin()`): the page calls `router.refresh()`, and the dashboard layout's existing guard sends the browser to sign in (the status card's behaviour today). `invalid` (bad shape, or a line's text fails AC-3, returned per `lineId` with `required`, `price_invalid`, or `above_catalog`): the fields are marked as AC-3. `not_found` (no such order, or a `lineId` not on this order). `no_change` (every sent line already has that price): "لم يتغيّر أي سعر.". `not_electrician`: "هذا الطلب ليس طلب كهربائي." and the page refreshes. `locked` (now delivered or cancelled): "لا يمكن تعديل الأسعار بعد التسليم أو الإلغاء." and the page refreshes, which closes edit mode. `stale` (the total or any sent line's price differs from what the page had): "تغيّرت الأسعار في مكان آخر. راجعها ثم احفظ مرة أخرى." and the page refreshes, which closes edit mode. `below_paid`: "الإجمالي الجديد أقل من المبلغ المدفوع ({paid})." with edit mode and the typed values kept. Anything else: "تعذّر حفظ الأسعار. حاول مرة أخرى." with edit mode kept. Notices show above the lines table with `role="alert"`; after a refresh for `locked`, `stale`, or `not_electrician`, focus moves to that notice.
- **AC-7**: The order after a cut, in the dashboard. Out of edit mode, a line whose `unit_price < catalog_unit_price` shows the catalog unit price struck through (`<s>`, with visually hidden "قبل الخصم") before its unit price. When the order's price discount (Σ (`catalog_unit_price` − `unit_price`) × `quantity`) is above 0, the totals card shows two rows above المجموع الفرعي: "قبل الخصم" (Σ `catalog_unit_price` × `quantity`) and "خصم الأسعار" (the discount, shown as a minus amount). With no discount the card is as today. When loyalty (feature 32) later fills `discount_total`, its row goes below المجموع الفرعي, so "قبل الخصم" minus "خصم الأسعار" always equals المجموع الفرعي. Strings: `AdminOrders.priceBefore` "قبل الخصم", `AdminOrders.priceDiscount` "خصم الأسعار", `AdminOrders.beforeDiscountHidden` "قبل الخصم" (visually hidden).
- **AC-8**: History. "سجل الطلب" shows each `line_price_changed` event in time order with the others: "المتجر عدّل الأسعار: الإجمالي من {from} إلى {to} (الأسطر المعدّلة: {count})" (`AdminOrders.eventPrices`), and when `data.note` is present, the note on the next line, muted. Plumbing: `HISTORY_EVENTS` in `admin-queries.ts` gains `line_price_changed` and the events read selects `data`; `AdminOrderEvent.type` and `HistoryEvent.type` widen to include it, `HistoryEvent` gains `data`; `historyEntries` maps it to a new entry `{ kind: "prices", from, to, count, note? }` (from `data.fromTotal`, `data.toTotal`, `data.lineCount`, `data.note`), whatever its `to_status`. The event is written seen, and `FLAGGING_EVENTS` stays `created` and `cancelled`, so it never marks the order unseen (spec 0014 AC-14).
- **AC-9**: What the electrician sees. On `/orders/[number]` (and so for anyone who can open it, the guest lookup included), the "ملخص الطلب" card shows, for a line with `unit_price < catalog_unit_price`, the catalog line total (`catalog_unit_price` × `quantity`) struck through with visually hidden "قبل الخصم" before the line total; and when the discount is above 0, the rows "قبل الخصم" and "خصم المتجر" (minus amount) above المجموع الفرعي. The note is never shown on the storefront. Plumbing: `OrderSummaryLine` gains optional `catalogLineTotal`, `OrderSummaryProps` gains optional `catalogSubtotal` and `priceDiscount`, and `orderSummaryView` returns the struck total per row and the two rows when `priceDiscount > 0`; the checkout confirmation (W5) passes none and renders as today. Strings: `OrderSummary.before` "قبل الخصم", `OrderSummary.shopDiscount` "خصم المتجر". My Orders (rendered per request) and the payment card read the saved `total`, so they show the new total and remaining balance with no change of their own. No message is sent to anyone.
- **AC-10**: History cannot be rewritten. The database refuses `UPDATE`, `DELETE`, and `TRUNCATE` on `order_line_price_changes` (triggers), and its foreign keys are `restrict`. A wrong cut is fixed by another save (the reset link makes that one press).
- **AC-11**: Logs. A successful save logs `order_prices_adjusted` with `orderId`, `lineCount`, `fromTotal`, `toTotal`. A refusal logs `order_prices_refused` with `orderId` and the error code. The note, names, phones, and addresses are never logged.
- **AC-12**: Layout and access. At 390 wide the lines table scrolls sideways inside its own box with the fields usable; at 1280 it matches the design page's lines table. Keyboard alone can enter edit mode, change every field, reset, save, and cancel; after save the button "تعديل الأسعار" renders again and receives focus (a ref focused in an effect once edit mode closes). axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) finds nothing on the admin order page in both modes and on the storefront order page with a discount.
- **AC-13**: Tests. Vitest beside the source for `canAdjustPrices` (null role included), the zero allowing shekel parse ("0", "0.00", "00"), the per line check (`above_catalog` and friends), `priceDiscount`, the edit preview totals (including the fallback when the preview would go below 0), the `"prices"` history entry, `FLAGGING_EVENTS` not containing `line_price_changed`, the summary view rows with and without a discount, and the action's result mapping. Database tests through `withRollback` (`src/server/db/testing.ts`, since the trigger refuses deletes) for `adjustOrderPricesInDb`: success writes lines, totals, one event, one change row per changed line and none for unchanged ones; the catalog prices stay; every refusal (`not_electrician`, `locked`, `stale` on total and on a line, `below_paid`, `no_change`, a line from another order as `not_found`); the check order (a delivered order with a stale total answers `locked`); two concurrent saves with the same expectations give one success and one `stale` (this one test needs committed data on two connections: it runs only when `hasLocalDb`, and cleans up in one transaction with `set local session_replication_role = replica`, which turns the triggers off for that cleanup only); `UPDATE`, `DELETE`, and `TRUNCATE` on change rows are refused; the RLS check passes. Playwright at 390 and 1280: as the owner, cut two lines of an electrician order, see totals and history change, reset one, save, then as that electrician see the struck price and the discount on the order page; a customer order shows no button; a delivered electrician order shows the locked line; an above catalog price is refused inline.

## Decision

**Chosen option**: Option 1: Batch save through one Server Action, change rows tied to the save's event.

The order page gains an edit mode that saves every changed line in one transaction, recorded as one `line_price_changed` event plus one append only `order_line_price_changes` row per changed line, with the catalog price kept on the line and the discount worked out on read.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the trigger, the locking, and the migration · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the field, link button, and notices · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for the flows.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

New table `order_line_price_changes` in `src/server/db/schema/orders.ts`, `.enableRLS()`, no grants:

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | `id()` |
| `order_event_id` | uuid | not null, FK `order_events.id` `on delete restrict`; indexed |
| `order_line_id` | uuid | not null, FK `order_lines.id` `on delete restrict`; indexed |
| `old_unit_price` | integer | not null, `check (old_unit_price >= 0)` |
| `new_unit_price` | integer | not null, `check (new_unit_price >= 0)`, `check (new_unit_price <> old_unit_price)` |
| `created_at`, `updated_at` | timestamptz | `timestamps()` |

Triggers come from a custom migration (`drizzle-kit generate --custom`, since `generate` does not emit triggers): a function `public.reject_price_change_edit()` (`language plpgsql`, `security invoker`, `set search_path = ''`, execute revoked from `public`, `anon`, `authenticated`) that raises; a `before update or delete ... for each row` trigger and a `before truncate ... for each statement` trigger on `order_line_price_changes`. Drizzle snapshots do not track triggers, so later generates leave them alone; `/sync` records this in `src/server/db/AGENTS.md`. Who and when live on the event (`actor_user_id`, `created_at`); the note lives in `order_events.data.note`. This replaces spec 0002's planned `changed_by` and per row `note` columns (one save, one note); spec 0002's table row needs that edit (Follow-up).

Changed by a save, with no schema change: `order_lines.unit_price`, `order_lines.line_total`, `orders.subtotal`, `orders.total`, and one `order_events` row. Relationships: one event has many change rows; one order line has many change rows over time. The discount is never stored; `orders.discount_total` stays reserved for loyalty rewards (feature 32).

**State transitions**: no new states. Adjusting is allowed in `new`, `confirmed`, `preparing`, `ready`, `out_for_delivery`; refused in `delivered` and `cancelled`. Adjusting never moves the status.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `adjustOrderPrices` (Server Action, `src/features/orders/server/price-actions.ts`) | Server Action | `orderId: uuid`, `expectedTotal: int >= 0`, `lines: { lineId: uuid, expectedUnitPrice: int >= 0, price: string }[]` (1 to 100, unique `lineId`), `note?: string` (`tidiedText({ optional: true, max: 200 })`) | `{ subtotal, total, lines: { lineId, unitPrice, lineTotal }[] }` | `requireAdmin()` (role `admin`, `aal2`, `getVerifiedUser`) | in check order: `forbidden`, `invalid` (shape or `required` / `price_invalid` per line), `not_found`, `not_electrician`, `locked`, `stale`, `invalid` (`above_catalog` per line), `no_change`, `below_paid` |
| `readAdminOrder` (existing, `admin-queries.ts`) | read | order number | adds `placedByRole`, `amountPaid`, each line's `id` and `catalogUnitPrice`; events: `HISTORY_EVENTS` gains `line_price_changed` and the select gains `data` | admin page | none new |
| `readCustomerOrder` (existing, `customer-order.ts`) | read | as today | adds each line's `catalogLineTotal` (`catalog_unit_price * quantity`) | as today | none new |

`adjustOrderPricesInDb(tx or db, adminUserId, parsed)` in `src/features/orders/server/price-adjust.ts` holds the transaction; the action wraps it (parse, `requireAdmin`, log, `revalidatePath` for `routes.admin.order(number)`, `routes.admin.orders`, `routes.order(number)`).

Pure helpers in `src/features/orders/price-adjust.ts`: `canAdjustPrices(placedByRole, status)`, `checkAdjustedPrice(text, catalogUnitPrice)` (returns agorot or `required` / `price_invalid` / `above_catalog`), `priceDiscount(lines)`, `previewTotals(lines, deliveryFee, discountTotal)` (over `computeOrderTotals`). `parseShekels` in `src/lib/money.ts` gains `{ allowZero: true }`; the Zod field `adjustedPriceField` is built with `digitsField` like `priceField`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Show button (AC-1) | may adjust | `canAdjustPrices(orders.placed_by_role, orders.status)` |
| Edit mode (AC-2) | field prefill | `toShekelsInput(order_lines.unit_price)` |
| Edit mode (AC-2) | struck catalog price, reset value | `order_lines.catalog_unit_price` |
| Edit mode (AC-2) | live line totals and totals | `previewTotals` from typed values (parsed), `orders.delivery_fee`, `orders.discount_total` |
| Save (AC-4) | `expectedTotal`, `expectedUnitPrice` | `orders.total`, `order_lines.unit_price` as read when edit mode opened |
| Save (AC-3) | new unit price in agorot | `adjustedPriceField` over the typed text |
| Save (AC-3) | upper bound | `order_lines.catalog_unit_price` read inside the transaction |
| Save (AC-4) | `line_total` | `computeLineTotal(new unit price, order_lines.quantity)` |
| Save (AC-4) | `subtotal`, `total` | `recomputeOrderTotals` |
| Save (AC-6) | paid amount for `below_paid` | `orders.amount_paid` (0 until feature 24) |
| Save (AC-4) | `old_unit_price` | `order_lines.unit_price` read under the line lock |
| Save (AC-4) | event `lineCount` | count of lines whose price changed |
| Save (AC-4) | event `fromTotal` | `orders.total` read under the order lock, before any update |
| Save (AC-4) | event `toTotal` | `total` returned by `recomputeOrderTotals` |
| Save (AC-4) | event `note` | the tidied note input, left out when empty |
| Save (AC-4) | actor | `requireAdmin()` user id |
| Dashboard and storefront (AC-7, AC-9) | "قبل الخصم", discount | `priceDiscount` over `catalog_unit_price`, `unit_price`, `quantity` |
| History (AC-8) | line text and note | `order_events.data` of `line_price_changed` |
| My Orders, payment card (AC-9) | new total and remaining | `orders.total`, `orders.amount_paid` (unchanged code) |

**Key invariants**:
- `0 <= order_lines.unit_price <= order_lines.catalog_unit_price` for every line this feature writes (application check under the row lock; the database keeps its existing `unit_price >= 0` and `line_total` checks).
- `catalog_unit_price` and `product_variants.price` are never written by this feature.
- Line updates, `recomputeOrderTotals`, the event, and the change rows commit together or not at all.
- After a save, `orders.total >= orders.amount_paid`.
- Every change row's `old_unit_price` equals the line's price right before that save, so the rows of one line chain from `catalog_unit_price` to the current `unit_price`.
- Change rows are never updated or deleted (trigger).

**Security model**:
- Only an `aal2` admin, checked by `requireAdmin()` inside the action (with `getVerifiedUser()`, since this changes money), before any read or write. The layout check is not relied on.
- All reads and writes go through `getDb()` in `server/` modules with `server-only`; RLS stays on and closed to `anon` and `authenticated`; `pnpm db:check-rls` covers the new table.
- The note is the owner's private text: stored in `order_events.data`, shown only on the admin page, never logged, never sent to the storefront read.
- The storefront gains no access path; it shows prices only to those who could already open the order (spec 0015, spec 0017).
- No regulated compliance scope. The change rows plus the event are the audit trail for this money change.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: cut two lines of a `preparing` electrician order with a note; totals, one event, two change rows, catalog prices kept; the electrician sees the struck price and discount, verifies **AC-2**, **AC-4**, **AC-5**, **AC-7**, **AC-8**, **AC-9**
- Failure case: two admin tabs save against the same starting total; one succeeds, the other gets `stale` and nothing of it is written, verifies **AC-6**
- Failure case: a cut that would bring the total under `amount_paid` is refused with nothing written, verifies **AC-6**
- Invalid state: the order is marked delivered while edit mode is open; save returns `locked`, verifies **AC-1**, **AC-6**
- Auth/permission: a customer or a non `aal2` session calling the action gets `forbidden`; a customer order gets `not_electrician`, verifies **AC-1**, **AC-6**
- Integrity: `UPDATE` and `DELETE` on a change row raise, verifies **AC-10**

## Build plan

Tracer Bullet: one real cut travels from the field to the database and back to the electrician's page first, then each part thickens.

1. Thin thread: the migration (table, indexes, RLS) through `pnpm db:generate`, plus a custom migration for the trigger function and both triggers; `parseShekels` `allowZero`; `canAdjustPrices`, `checkAdjustedPrice`; `adjustOrderPricesInDb` success path (lock, line updates, recompute, event, change rows); the `adjustOrderPrices` action; `readAdminOrder` additions; the edit mode with fields, save, cancel, and the saved notice; one Playwright cut on an electrician order at 1280; database test of the success path, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**
2. Every refusal and the edit details: `no_change`, `not_electrician`, `locked`, `stale` (total and line), `below_paid`, per line `invalid` with inline errors and focus; the reset link; the live preview; the locked line on delivered and cancelled orders; database tests for each refusal and for two concurrent saves, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**
3. Showing the deal: `priceDiscount`; struck prices and the "قبل الخصم" and "خصم الأسعار" rows in the dashboard; the `"prices"` history entry with the note (`HISTORY_EVENTS`, `data` in the select, the widened event types, `historyEntries`); `readCustomerOrder`, the optional `OrderSummary` props, and `orderSummaryView` with the struck line total and "خصم المتجر" rows on `/orders/[number]`, satisfies **AC-7**, **AC-8**, **AC-9**
4. Finish: append only (update, delete, truncate) and RLS database tests; the local only concurrency test with its cleanup; logs; layout at 390 and 1280; keyboard and focus return; Playwright for the electrician view, the customer order with no button, the delivered lock, and the above catalog refusal, all with axe; the remaining Vitest units, satisfies **AC-10**, **AC-11**, **AC-12**, **AC-13**

## Consequences

**Positive**:
- A deal is one deliberate save with a full trail: each line's old and new price, who, when, and why.
- The catalog stays the single public price; the order keeps both prices, so the discount is always provable from stored columns.
- Totals stay correct by reusing `recomputeOrderTotals`, and remaining balance, My Orders, and later reports read the new total with no change.

**Negative / tradeoffs**:
- Anyone who opens an electrician order through the guest lookup (the end customer, if the electrician shares the number) sees the struck catalog price and the discount. Accepted for now; the end customer rarely has the order number.
- Reports (feature 27) and loyalty coins (feature 31) work from the adjusted `subtotal` and `total`, so revenue and coins shrink with every deal. Those features must not assume catalog prices.
- The price cannot be raised above the catalog price, so a real extra cost (say, special handling) needs a later feature.
- The triggers mean rows tied to price changes can never be deleted, orders included; database tests that create them run through `withRollback`, and the one concurrency test needs the trigger bypass cleanup. Today's cleanup code in `place-order.db.test.ts` and `drafts.db.test.ts` deletes orders, so those tests must never create price changes.
- If the admin's profile were ever deleted, `order_events.actor_user_id` becomes null (`set null`); the change rows and the history line survive, only the "who" is lost. The owner's profile is not deleted in practice.
- An edit mode is more UI than save on blur, and a second admin tab editing at the same time loses its save to `stale`.

**Neutral**:
- One migration adds one table and one trigger; nothing existing changes shape.
- `parseShekels` gains an option; existing callers keep rejecting 0.
- `OrderSummary` gains optional discount props; the checkout confirmation (W5) never has a discount, so it renders as today.

## Follow-up

- [ ] Update spec 0002's `order_line_price_changes` row to this shape (`order_event_id` instead of `changed_by` and `note`), and its relationships table.
- [ ] Close open item O-18 on [docs/design/pages/admin-order-details.md](../../design/pages/admin-order-details.md): electrician orders only; edit mode with one save replaces save on blur.
- [ ] Spec 0015 follow-up "Feature 23: check the option line" is answered by AC-9; tick it when this ships.
- [ ] Feature 24 (payments): a recorded refund or reversal must keep `total >= amount_paid` reasoning consistent with `below_paid` here.
- [ ] Feature 34 (returns): once `returned_quantity` exists, `priceDiscount` and "قبل الخصم" must count kept units (`quantity - returned_quantity`), or "قبل الخصم" minus the discount stops equalling the subtotal.
- [ ] Features 24 and 34: take the same lock order as this feature (order row first, then lines).
- [ ] Features 27 and 31: decide whether reports show catalog revenue beside adjusted revenue, and confirm coins earn on the adjusted total.
- [ ] Later, if wanted: open adjustments to customer orders (`canAdjustPrices` is the one rule to widen), a delivery fee override, or prices above catalog, each as its own feature.
