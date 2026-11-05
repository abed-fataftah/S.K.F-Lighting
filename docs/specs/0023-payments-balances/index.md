# 0023. Payments and balances

**Date**: 2026-11-05
**Status**: In Progress

## Summary

You record every cash or cheque payment on the dashboard order page, and the order shows its total, what is paid, and what remains. A cheque counts the day you receive it, and its number, bank, and date are kept. Money records are never edited or deleted: a mistake or a bounced cheque is fixed with a "reversal" (a new row that cancels an old one, with a required reason), and money owed back on a cancelled order is paid out as a "refund". The customer sees the paid and remaining amounts on their order page and in My Orders, and the orders list gets a payment column and filter.

## Requirements

**User stories**:
- As the owner, I want to record each cash or cheque payment with its date and a note, so I always know what each order still owes.
- As the owner, I want to correct a wrong entry or a bounced cheque without erasing the record, so the money trail stays honest.
- As the owner, I want to see which orders are unpaid, part paid, or owed money back, so I can chase or settle them.
- As a customer or electrician, I want to see how much I paid and how much remains, so I know where I stand.

**Acceptance criteria**:
- **AC-1**: Payments card. `/admin/orders/[number]` shows a card "الدفعات" under the totals card. It lists every `payment` and `refund` row of the order oldest first (by `received_on`, then `created_at`), each with: the day (`formatDayKey(received_on)`), the method text, and the amount (`formatPrice`). Method text: cash "نقداً" (`AdminPayments.methodCash`); cheque "شيك رقم {number} · {bank} · تاريخه {dueDate}" (`AdminPayments.chequeLine`, `{dueDate}` through `formatDayKey`, `{number}` inside `<bdi dir="ltr">` so the dots do not reorder it). A refund row reads "استرجاع · " before its method text (`AdminPayments.refundPrefix`) and shows its amount as a minus amount. A row's note shows on the next line, muted. In the payments card a reversal row is never listed on its own (history still lists it, AC-10): the row it reverses shows its amount struck through (`<s>`, with visually hidden "معكوسة") and a muted line "عُكست في {date}: {reason}". With no rows the list reads "لا توجد دفعات بعد.". Under the list, summary rows: "الإجمالي" (`total`), "المدفوع" (`amount_paid`), and, for an order that is not cancelled, "المتبقي" (`total − amount_paid`). For a cancelled order with `amount_paid > 0`, the row "مستحق للعميل" (`amount_paid`) replaces "المتبقي".
- **AC-2**: Form mode. A pure `paymentFormMode(status, total, amountPaid)` decides what sits under the summary: `null` when `total = 0` and nothing is paid (nothing to collect: no form, no line, and the list badge stays "لم يُدفع"); `"payment"` when the order is not cancelled and `amount_paid < total` (form "تسجيل دفعة"); `"settled"` when not cancelled, `total > 0`, and `amount_paid >= total` (muted line "الطلب مدفوع بالكامل."); `"refund"` when cancelled and `amount_paid > 0` (form "تسجيل استرجاع"); `null` when cancelled with nothing paid (nothing). Every status before `cancelled`, `delivered` included, takes payments.
- **AC-3**: Form fields. In order: "المبلغ (₪)" (`inputMode="decimal"`, prefilled with `toShekelsInput` of the limit: `total − amount_paid` for a payment, `amount_paid` for a refund); "الطريقة" (Select: "نقداً" default, "شيك"); when "شيك" is chosen, three required fields appear: "رقم الشيك", "البنك", "تاريخ الشيك" (`type="date"`, any valid date, past or future, before the payment date included); the same cheque number and bank may appear on several orders or twice on one order (one cheque can pay several orders), so there is no uniqueness rule; "التاريخ" (`type="date"`, default the shop's today `shopDateKey(new Date())`, `max` today, `min` the order's shop day `shopDateKey(placed_at)`); "ملاحظة (تظهر لك فقط)" optional, up to 200 characters. Submit: yellow small "تسجيل الدفعة" or "تسجيل الاسترجاع". Switching back to "نقداً" hides the cheque fields and they are not sent. Errors show under each field with `aria-invalid` and `aria-describedby`; on submit the page checks every field first, marks every problem, focuses the first, and sends nothing. Messages: amount empty "أدخل المبلغ."; not an amount (`parseShekels` gives null, so 0 is refused) "اكتب مبلغاً صحيحاً."; above the limit "المبلغ أكبر من المتبقي ({limit})." for a payment, "المبلغ أكبر من المدفوع ({limit})." for a refund; cheque number empty "أدخل رقم الشيك."; bank empty "أدخل اسم البنك."; cheque date empty or invalid "أدخل تاريخ الشيك."; date empty or invalid "أدخل التاريخ."; date after today "لا يمكن أن يكون التاريخ بعد اليوم."; date before the order's day "التاريخ قبل تاريخ الطلب.". Arabic digits are accepted in every number field (through `digitsField`).
- **AC-4**: Record. Submit calls `recordPayment` with `paymentId` (a uuid the server page made with `crypto.randomUUID()` when it rendered, like checkout's `idempotencyKey`), `orderId`, `kind` (`payment` or `refund`, from the form mode), `expectedAmountPaid` (the `amount_paid` the page showed), and the fields. The action runs `requireAdmin()`, then the Zod schema `paymentSchema({ today })` (a factory so the browser and the server share it: the server passes `shopDateKey(now)` from its one `now`, the form gets `today` and `minDay` as props from the server render) (shape, amount through `digitsField` and `parseShekels`, cheque fields required exactly when `method = "cheque"` and dropped otherwise, dates through `isDateKey`, `receivedOn <= shopDateKey(now)` with one `now` taken by the action, `chequeNumber` `tidiedText({ max: 30 })` after `digitsField`, `chequeBank` `tidiedText({ max: 60 })`, note `tidiedText({ optional: true, max: 200 })`). Then in one transaction, checking in this fixed order: lock the order row `for update` and read `status`, `total`, `amount_paid`, `placed_at`, `order_number` (`not_found`); a `payments` row with `id = paymentId` already exists for this order: return `ok` with the order's current `amount_paid` and `duplicate: true`, writing nothing, even if the order was cancelled since or the payload differs (the first request won; the same id on another order is a bug and throws); the kind fits the status (`payment` needs not cancelled, `refund` needs cancelled; else `not_allowed`); `amount_paid = expectedAmountPaid` (`stale`); amount at most the limit of AC-3 (`too_much`, carrying `{ limit }` read under the lock); `receivedOn >= shopDateKey(placed_at)` (`invalid` with the field error `before_order`; this catches a wrong year or month typed by mistake). Then insert the `payments` row (`recorded_by` the admin), set `orders.amount_paid` to `applyEntry(amount_paid, entry)`, insert one `order_events` row (`type = 'payment_recorded'`, `actor_kind = 'admin'`, `actor_user_id` the admin, `seen_at = now()`, `data = { paymentId, kind, method, amount, fromPaid, toPaid }`), commit. The page refreshes (`router.refresh()`), so the list, the summary, and a fresh `paymentId` come back; a notice with `role="status"` reads "سُجّلت الدفعة." or "سُجّل الاسترجاع." (`AdminPayments.recorded`, `AdminPayments.refunded`; a `duplicate` success shows the same notice), and focus moves to it. The form renders as `<PaymentForm key={paymentId}>`, so the fresh id clears it; after a generic failure (nothing written) the same id is kept and reused, which is correct.
- **AC-5**: Refunds. A refund is recorded only on a cancelled order, by the same form in `"refund"` mode, cash or cheque (a cheque refund carries the shop's cheque number, bank, and date), any amount from 0.01 up to `amount_paid`, so a partial refund leaves the rest owed back. Each refund lowers `amount_paid` by its amount. When `amount_paid` reaches 0 the form disappears (AC-2).
- **AC-6**: Reversal. Each listed `payment` or `refund` row that is not already reversed shows an outline small button "عكس" (`aria-label` "عكس الدفعة {amount} بتاريخ {date}"). It opens a dialog "عكس الدفعة" naming the row (day, method text, amount), a required field "سبب العكس" (up to 200 characters; empty: "اكتب سبب العكس."), and the buttons "تأكيد العكس" and "تراجع". Confirm calls `reversePayment` with `reversalId` (`crypto.randomUUID()` called inside the render of `order-payments-card.tsx`, once per listed row, passed to that row's dialog as a prop), `orderId`, `paymentId`, `expectedAmountPaid`, and `reason`. After `requireAdmin()` and Zod, in one transaction, in this fixed order: lock the order row `for update` (`not_found`); a row with `id = reversalId` already exists for this order: `ok` with `duplicate: true`, nothing written; lock the target payment `for update` scoped to this order (`not_found`); target is a reversal (`is_reversal`); target already has a reversal (`already_reversed`; under the order lock two reversals cannot race, and the unique index stays as a backstop that would surface as a bug); `amount_paid = expectedAmountPaid` (`stale`); the new `amount_paid` (minus the amount for a reversed payment, plus the amount for a reversed refund) stays within 0 and `total` (`out_of_range`; in practice only the below 0 side is reachable, for example a payment reversed after a refund already paid it back; the above `total` side is a defence, since a refund exists only on a cancelled order whose total is locked). Then insert the reversal row (`kind = 'reversal'`, `reverses_payment_id` the target, `amount`, `method`, and the three cheque fields copied from the target, `received_on` the shop's today, `note` the reason, `recorded_by` the admin), update `amount_paid`, insert one seen `payment_recorded` event with `data = { paymentId: reversalId, kind: 'reversal', reverses: target id, method, amount, fromPaid, toPaid }`, commit. A reversal is allowed in every status, cancelled and delivered included. The dialog closes, the page refreshes, the notice "عُكست الدفعة." shows with `role="status"` and receives focus. To fix a wrong amount you reverse it, then record the right one.
- **AC-7**: Refusals. Each is a typed result and writes nothing. `forbidden` (from `requireAdmin()`): `router.refresh()`, and the dashboard layout sends the browser to sign in. `invalid`: per field errors as AC-3 (and "اكتب سبب العكس." in the dialog). `not_found`: "لم نجد الطلب أو الدفعة." with a refresh. `not_allowed`: "تغيّرت حالة الطلب. راجعها ثم حاول مرة أخرى." and the page refreshes. `stale`: "تغيّرت الدفعات في مكان آخر. راجعها ثم حاول مرة أخرى." and the page refreshes, typed values are dropped. `too_much`: the amount field error of AC-3 with the `limit` the result carries. The result types, defined once in `src/features/payments/schemas.ts`: `invalid` carries `fieldErrors: Partial<Record<"amount" | "receivedOn" | "chequeNumber" | "chequeBank" | "chequeDueDate" | "note" | "reason", code>>`; `too_much` carries `{ limit }`. `is_reversal` and `already_reversed`: "هذه الدفعة معكوسة من قبل." with a refresh. `out_of_range`: "لا يمكن عكس هذه الدفعة: سيصبح المدفوع أقل من صفر.". On a refresh the reversal dialog closes and its reason is dropped. Anything else: "تعذّر حفظ الدفعة. حاول مرة أخرى." with the typed values kept. Notices sit above the form (or inside the dialog) with `role="alert"`; after a refresh, focus moves to the notice.
- **AC-8**: Double submit and two tabs. The submit button is disabled while the action runs. A retried request with the same `paymentId` or `reversalId` (a double click that got through, a network retry) returns `ok` with `duplicate: true` and records nothing twice. Two tabs recording against the same `expectedAmountPaid` give one success and one `stale`. A pay then reverse pair can bring `amount_paid` back to the value an old tab holds; that tab then passes the `stale` check, which is harmless because the limits are checked again under the lock. Every payment action takes the order row lock first, then (for a reversal) the target payment row (spec 0022 lock order), so payments, price cuts (0022), owner cancel (0014), and customer cancel (0016) on one order run one after another.
- **AC-9**: Owner cancel with money on it. The cancel dialog on the dashboard order page (`CancelOrderDialog` gains the prop `amountPaid: number`, passed through `OrderStatusCard` from the page render, so it can be a moment old, which is fine for a warning) shows above its buttons, when `amount_paid > 0`, the line "على هذا الطلب دفعات بقيمة {amount}. بعد الإلغاء سجّل الاسترجاع في بطاقة الدفعات." Cancelling is still allowed; afterwards the payments card is in `"refund"` mode. The customer's own cancel stays blocked while `amount_paid > 0` (spec 0016, unchanged); a reversal that brings `amount_paid` back to 0 reopens it.
- **AC-10**: History. "سجل الطلب" shows each `payment_recorded` event in time order with the others: payment "المتجر سجّل دفعة {amount} ({method})" (`AdminOrders.eventPayment`), refund "المتجر سجّل استرجاع {amount} ({method})" (`AdminOrders.eventRefund`), reversal "المتجر عكس دفعة {amount}" (`AdminOrders.eventReversal`), with `{method}` from `AdminPayments.methodCash` "نقداً" or `AdminPayments.methodCheque` "شيك". Plumbing: `HISTORY_EVENTS` gains `payment_recorded`; `AdminOrderEvent.type` and `HistoryEvent.type` widen; `historyEntries` maps it to `{ kind: "payment", entry: "payment" | "refund" | "reversal", amount, method }` from `data`. The event is written seen and `FLAGGING_EVENTS` stays `created` and `cancelled`.
- **AC-11**: Orders list. `/admin/orders` gains the column "الدفع" between "الحالة" and "الإجمالي", showing a badge from a pure `orderPaymentBadge(status, amountPaid, total)`: not cancelled and `amount_paid = 0` "لم يُدفع" (`off`), a total of 0 included; `partial` "دفعة جزئية" (`proc`); `paid` "مدفوع" (`ok`); cancelled with `amount_paid > 0` "استرجاع مستحق" (`new`, yellow, it needs action); cancelled with 0 an empty cell. The filter bar gains a Select "الدفع" (الكل، لم يُدفع، دفعة جزئية، مدفوع، استرجاع مستحق) stored in the address as `payment=none|partial|paid|refund_due` (`ORDER_PAYMENTS` and `OrderPaymentFilter` in `admin-filters.ts`, written in the existing fixed order after `method`, unknown values ignored). This is separate from the existing `method` filter (delivery or pickup, "الاستلام"); the cash or cheque type is named `PaymentMethod` and is never a list filter. The SQL matches the badge: `none` is not cancelled and `amount_paid = 0`; `partial` is not cancelled and `0 < amount_paid < total`; `paid` is not cancelled and `amount_paid > 0` and `amount_paid >= total`; `refund_due` is cancelled and `amount_paid > 0`. `AdminOrderRow` gains `amountPaid`. The phone search results (same table) show the column too.
- **AC-12**: What the customer sees. On `/orders/[number]` the "الدفع" card keeps its badge (spec 0015 AC-11) and, when `amount_paid > 0` and the order is not cancelled, adds rows "المدفوع" (`amount_paid`) and "المتبقي" (`total − amount_paid`, only while above 0). On a cancelled order with `amount_paid > 0` (no badge, as today) it adds the row "مبلغ يُعاد إليك" (`amount_paid`). No payment list, cheque detail, or note is ever read for or shown on the storefront. Strings: `OrderPage.paidAmount` "المدفوع", `OrderPage.remainingAmount` "المتبقي", `OrderPage.refundDue` "مبلغ يُعاد إليك".
- **AC-13**: My Orders matches. `/account/orders` keeps its money line from `orderMoneyLine` (spec 0018 AC-4) over the same `total` and `amount_paid`, so after any payment, refund, or reversal it shows the same remaining amount as the order page on the next load. One change: `OrderMoneyLine` gains `{ kind: "refund"; amount }` for a cancelled order with `amount_paid > 0`, shown as "مبلغ يُعاد إليك {amount}" (`MyOrders.refundDue`) in both `my-order-card.tsx` and the account page's `customer-orders.tsx`; a cancelled order with nothing paid still shows no line. A Playwright check proves both pages agree.
- **AC-14**: Ledger integrity. The database refuses `UPDATE`, `DELETE`, and `TRUNCATE` on `payments` (triggers). Checks hold: `amount > 0`; `kind = 'reversal'` exactly when `reverses_payment_id` is set; `kind = 'reversal'` needs a non empty `note`; cheque number, bank, and due date are all set exactly when `method = 'cheque'`; `reverses_payment_id` is unique; `orders.amount_paid <= orders.total` (new check on `orders`). After every action, `orders.amount_paid` equals `netPaid` over that order's rows (payments add, refunds subtract, a reversal undoes the row it points at). This holds for orders whose money was written only by these actions; existing test fixtures that set `amount_paid` directly (`customers.db.test.ts`, `price-adjust.db.test.ts`, `e2e/order-page.spec.ts`, the `recordPayment` helper in `e2e/orders.ts`) stay valid as long as they keep `amount_paid <= total`.
- **AC-15**: Logs. Success logs `payment_recorded` with `orderId`, `kind`, `method`, `amount`, `fromPaid`, `toPaid`, `duplicate`. A refusal logs `payment_refused` with `orderId` and the error code. Notes, reasons, cheque numbers, bank names, customer names, phones, and addresses are never logged.
- **AC-16**: Layout and access. At 390 wide the payments card stacks: list rows wrap, form fields go full width, the cheque fields stack; at 1280 it sits in the left column under the totals as the design board shows. Keyboard alone can fill and submit the form, switch the method, open, fill, confirm, and leave the reversal dialog; after the dialog closes focus goes to the notice. axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) finds nothing on the admin order page (payment mode, refund mode, dialog open), the orders list with the payment filter, and the storefront order page with a partial payment.
- **AC-17**: Tests. Vitest beside the source for `applyEntry`, `netPaid`, `paymentFormMode` (each status, settled, refund, null), `paymentLimit`, `orderPaymentBadge` (every branch, total 0 included), the payment form schema (cash drops cheque fields, cheque requires all three, Arabic digits, 0 refused, future date), `parseOrderFilters` with `payment`, the history entries for all three kinds, the payment card view rows (live, settled, cancelled with and without money), and both actions' result mapping. Database tests through `withRollback` for `recordPaymentInDb` and `reversePaymentInDb`: success writes the row, `amount_paid`, and one event; duplicate id returns `ok` with nothing written; a duplicate id after the order was cancelled still returns `ok`; every refusal (`not_allowed` both ways, `stale`, `too_much` with its `limit`, `before_order`, `not_found` for a payment on another order, `is_reversal`, `already_reversed`, `out_of_range` below 0 through the actions and above `total` through a direct SQL fixture); the check order (a cancelled order with a stale amount answers `not_allowed`); `orderMoneyLine` with the new `refund` kind; `amount_paid = netPaid` after a mixed sequence; two concurrent records with the same expectation give one success and one `stale` (local only, with the same trigger bypass cleanup spec 0022 uses); `UPDATE`, `DELETE`, `TRUNCATE` refused; each check constraint, `amount_paid <= total` included; the RLS check passes. Playwright at 390 and 1280: record a partial cash payment and see المتبقي on the dashboard, on `/orders/[number]`, and in My Orders; pay the rest by cheque and see "مدفوع"; reverse the cheque with a reason and see the order back to partial; cancel a paid order (warning shown), record a partial then a full refund; filter the list by each payment value; a cheque without a bank is refused inline; axe on each screen.

## Decision

**Chosen option**: Option 1: Append only ledger, with `orders.amount_paid` kept in the same transaction by the Server Actions.

Every payment, refund, and reversal is a new row in `payments`, written with the order row locked, and the action updates the cached `orders.amount_paid` and writes one history event in that same transaction; nothing is ever edited or deleted.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the table, checks, triggers, and locking · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the form, Select, dialog, and notices · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for the flows.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

New enums in `src/server/db/schema/enums.ts`: `payment_kind` (`payment`, `refund`, `reversal`) and `payment_method` (`cash`, `cheque`). Both are new types, so they go in the same migration as the table.

New table `payments` in `src/server/db/schema/payments.ts`, `.enableRLS()`, no grants:

| Column | Type | Rules |
|---|---|---|
| `id` | uuid PK | `id()`; the action inserts the client's `paymentId` or `reversalId` (idempotency) |
| `order_id` | uuid | not null, FK `orders.id` `on delete restrict`, indexed |
| `kind` | `payment_kind` | not null |
| `method` | `payment_method` | not null; a reversal copies its target's |
| `amount` | integer (agorot) | not null, `check (amount > 0)` |
| `received_on` | date | not null; the shop day the money changed hands (a reversal: the shop day it was recorded) |
| `cheque_number` | text | nullable |
| `cheque_bank` | text | nullable |
| `cheque_due_date` | date | nullable; the date written on the cheque |
| `reverses_payment_id` | uuid | nullable, unique, FK `payments.id` `on delete restrict` |
| `note` | text | nullable; owner only |
| `recorded_by` | uuid | not null, FK `profiles.id` `on delete restrict`, indexed |
| `created_at`, `updated_at` | timestamptz | `timestamps()` |

Checks: `payments_cheque_check`: `(method = 'cheque' and num_nonnulls(cheque_number, cheque_bank, cheque_due_date) = 3) or (method = 'cash' and num_nulls(cheque_number, cheque_bank, cheque_due_date) = 3)`; `payments_reversal_check`: `(kind = 'reversal') = (reverses_payment_id is not null)`; `payments_reversal_note_check`: `kind <> 'reversal' or (note is not null and btrim(note) <> '')`; `payments_not_self_check`: `reverses_payment_id is null or reverses_payment_id <> id`. Rules the database cannot see (target on the same order, same amount, target not a reversal) are checked by the action under the lock.

Append only: a custom migration (`drizzle-kit generate --custom`) adds `public.reject_payment_edit()` (`language plpgsql`, `security invoker`, `set search_path = ''`, execute revoked from `public`, `anon`, `authenticated`) with a `before update or delete ... for each row` trigger and a `before truncate ... for each statement` trigger on `payments`, the same shape as migration 0012.

Changed on `orders`, additive: new check `orders_amount_paid_total_check`: `amount_paid <= total`. Existing rows all have `amount_paid = 0`, so it validates at once. `amount_paid` stays the cache: `netPaid` of the order's rows.

Relationships: one order has many payments (1:N); a reversal points at exactly one earlier row of the same order (1:1, unique); each row has one `payment_recorded` event in `order_events` linked through `data.paymentId`. This replaces spec 0002's planned `received_at` timestamptz with `received_on` date (a backdated entry has no real time; `created_at` holds when it was recorded) and adds the required reversal note and the `amount_paid <= total` check (Follow-up).

**State transitions**: no order states change. Payment state is derived: `none` → `partial` → `paid` as payments add up, and back down on a reversal. A row's own life: `payment` or `refund` → (optionally) reversed, once, never undone (a wrongly reversed entry is recorded again as a new row). On a cancelled order: `refund_due` while `amount_paid > 0`, then nothing.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `recordPayment` (Server Action, `src/features/payments/server/actions.ts`) | Server Action | `paymentId: uuid`, `orderId: uuid`, `kind: "payment" \| "refund"`, `expectedAmountPaid: int >= 0`, `amount: string`, `method: "cash" \| "cheque"`, `receivedOn: "YYYY-MM-DD"`, `chequeNumber?`, `chequeBank?`, `chequeDueDate?`, `note?` | `{ amountPaid, duplicate }` | `requireAdmin()` | in check order: `forbidden`, `invalid` (fields), `not_found`, `not_allowed`, `stale`, `too_much`, `invalid` (`before_order`) |
| `reversePayment` (same file) | Server Action | `reversalId: uuid`, `orderId: uuid`, `paymentId: uuid`, `expectedAmountPaid: int >= 0`, `reason: string` (`tidiedText({ max: 200 })`) | `{ amountPaid, duplicate }` | `requireAdmin()` | `forbidden`, `invalid`, `not_found`, `is_reversal`, `already_reversed`, `stale`, `out_of_range` |
| `readOrderPayments(db, orderId)` (`src/features/payments/server/queries.ts`) | read | order id | rows (`id`, `kind`, `method`, `amount`, `receivedOn`, cheque fields, `note`, `reversesPaymentId`, `createdAt`) oldest first | admin page only | none |
| `readAdminOrder` (existing, `admin-queries.ts`) | read | order number | events: `HISTORY_EVENTS` gains `payment_recorded` | admin page | none new |
| `readAdminOrders` / `listAdminOrders` (existing) | read | filters gain `payment` | rows gain `amountPaid` | admin page | none new |
| `cancelOrderByAdmin` (existing) | unchanged | | | | |

`recordPaymentInDb(db, adminUserId, parsed, today)` and `reversePaymentInDb(db, adminUserId, parsed, today)` in `src/features/payments/server/record.ts` hold the transactions; the actions wrap them (parse, `requireAdmin`, log, `revalidatePath` for `routes.admin.order(number)`, `routes.admin.orders`, `routes.order(number)`, and the My Orders route).

`formatDayKey(key)` in `src/lib/format.ts` (`formatDate(shopDayStart(key))`) shows every `date` column; no page derives it itself.

Pure helpers in `src/features/payments/ledger.ts`: `applyEntry(amountPaid, entry)` (entry: `{ kind, amount, reversedKind? }`; throws if the result is negative, a bug), `netPaid(rows)`, `paymentFormMode(status, total, amountPaid)`, `paymentLimit(mode, total, amountPaid)`, `orderPaymentBadge(status, amountPaid, total)` (over `paymentState`), `paymentRowsView(rows)` (pairs reversals with their targets for AC-1). Zod schemas in `src/features/payments/schemas.ts`. Components in `src/features/payments/components/`: `order-payments-card.tsx` (server; named apart from the storefront's existing `payment-card.tsx`), `payment-form.tsx` (client), `reverse-payment-dialog.tsx` (client).

Strings in `ar.json` under `AdminPayments`: `title` "الدفعات", `empty` "لا توجد دفعات بعد.", `total` "الإجمالي", `paid` "المدفوع", `remaining` "المتبقي", `owedBack` "مستحق للعميل", `settled` "الطلب مدفوع بالكامل.", `methodCash` "نقداً", `methodCheque` "شيك", `chequeLine`, `refundPrefix` "استرجاع · ", `reversedHidden` "معكوسة", `reversedLine` "عُكست في {date}: {reason}", `formPayment` "تسجيل دفعة", `formRefund` "تسجيل استرجاع", `amount` "المبلغ (₪)", `method` "الطريقة", `chequeNumber` "رقم الشيك", `chequeBank` "البنك", `chequeDueDate` "تاريخ الشيك", `date` "التاريخ", `note` "ملاحظة (تظهر لك فقط)", `submitPayment` "تسجيل الدفعة", `submitRefund` "تسجيل الاسترجاع", `recorded`, `refunded`, `reversed` "عُكست الدفعة.", `reverse` "عكس", `reverseLabel` "عكس الدفعة {amount} بتاريخ {date}", `reverseTitle` "عكس الدفعة", `reason` "سبب العكس", `reverseConfirm` "تأكيد العكس", `reverseKeep` "تراجع", `cancelWarning`, and `errors.*` for every message in AC-3, AC-6, and AC-7. Plus `OrderPage.paidAmount`, `OrderPage.remainingAmount`, `OrderPage.refundDue`, `MyOrders.refundDue`, `AdminOrders.eventPayment`, `AdminOrders.eventRefund`, `AdminOrders.eventReversal`, `AdminOrders.paymentColumn` "الدفع", `AdminOrders.paymentRefundDue` "استرجاع مستحق".

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Payments card (AC-1) | rows, reversed marks, reasons | `readOrderPayments`, paired by `paymentRowsView` |
| Payments card (AC-1) | الإجمالي, المدفوع, المتبقي, مستحق للعميل | `orders.total`, `orders.amount_paid` |
| Form (AC-2) | which form | `paymentFormMode(orders.status, total, amount_paid)` |
| Form (AC-3) | amount prefill and limit | `paymentLimit`: `total − amount_paid` (payment), `amount_paid` (refund) |
| Form (AC-3) | date default and `max` | `shopDateKey(new Date())` on the server render |
| Form (AC-3) | date `min` | `shopDateKey(orders.placed_at)` |
| Record (AC-4) | `paymentId`, each row's `reversalId` | `crypto.randomUUID()` in the server page render |
| Record (AC-4) | `expectedAmountPaid` | `orders.amount_paid` as the page showed it |
| Record (AC-4) | amount in agorot | `parseShekels` over `digitsField` of the typed text |
| Record (AC-4) | "today" for the future date check | `shopDateKey(now)`, one `now` per action |
| Record (AC-4) | limit under the lock | locked `orders.total`, `orders.amount_paid` |
| Record (AC-4) | order's first day | locked `orders.placed_at` through `shopDateKey` |
| Record (AC-4) | new `amount_paid`, event `fromPaid`, `toPaid` | `applyEntry` over the locked `amount_paid` |
| Record, reverse | `recorded_by`, event actor | `requireAdmin()` user id |
| Reverse (AC-6) | `amount`, `method`, cheque fields | copied from the locked target row |
| Reverse (AC-6) | `received_on` | `shopDateKey(now)` |
| Reverse (AC-6) | `note` | the tidied reason |
| History (AC-10) | line text | `order_events.data` of `payment_recorded` |
| Orders list (AC-11) | badge, filter | `orderPaymentBadge(status, amount_paid, total)`; SQL of AC-11 |
| Storefront (AC-12) | المدفوع, المتبقي, مبلغ يُعاد إليك | `orders.amount_paid`, `orders.total`, `orders.status` |
| My Orders (AC-13) | remaining | `orderMoneyLine(status, amount_paid, total)` (existing) |

**Key invariants**:
- `0 <= orders.amount_paid <= orders.total` at every commit (the existing `>= 0` check plus the new check; the actions refuse before the database has to).
- `orders.amount_paid = netPaid(payments of that order)` after every action; only these two actions write `amount_paid`.
- A payment is only recorded on a non cancelled order and never above the remaining amount; a refund only on a cancelled order and never above `amount_paid`.
- Each row is reversed at most once; a reversal is never reversed; a reversal has the same order, amount, method, and cheque fields as its target.
- `received_on` is between the order's shop day and the shop's today when written.
- Payment rows are never updated or deleted (triggers); a retried request with the same id writes nothing new.
- The row insert, the `amount_paid` update, and the event commit together or not at all, with the order row locked first.

**Security model**:
- Only an `aal2` admin, through `requireAdmin()` (with `getVerifiedUser()`, since this changes money) at the top of both actions, before any read or write. The layout check is not relied on.
- All reads and writes through `getDb()` in `server/` modules with `server-only`; RLS on `payments`, no grants to `anon` or `authenticated`; `pnpm db:check-rls` covers it.
- Cheque details, notes, and reasons are owner only: read only by the admin page query, never selected by `readCustomerOrder`, My Orders, or any storefront path, never logged.
- The storefront gains no access path; it shows amounts only to people who could already open the order (spec 0015, spec 0017).
- No card data is handled, so no PCI scope. The append only ledger plus one event per entry is the audit trail for every money change.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: record a partial cash payment, then the rest by cheque; the list, summary, badge, storefront amounts, and My Orders agree, verifies **AC-1**, **AC-3**, **AC-4**, **AC-11**, **AC-12**, **AC-13**
- Failure case: the same request sent twice returns `duplicate` and one row; two tabs give one success and one `stale`, verifies **AC-8**
- Failure case: an amount above the remaining amount is refused under the lock even if the page's limit was old, verifies **AC-4**, **AC-7**
- Invalid state: the order is cancelled while the payment form is open; submit returns `not_allowed`, the refresh shows refund mode, verifies **AC-2**, **AC-7**, **AC-9**
- Correction: a bounced cheque is reversed with a reason; reversing it again gives `already_reversed`; reversing a payment that a refund already paid back gives `out_of_range`, verifies **AC-6**, **AC-7**
- Auth/permission: a customer or a non `aal2` session calling either action gets `forbidden`; the storefront never shows a cheque number, verifies **AC-7**, **AC-12**
- Integrity: `UPDATE` and `DELETE` on a payment raise; `amount_paid > total` is refused by the check; `amount_paid = netPaid` after a mixed run, verifies **AC-14**

## Build plan

Tracer Bullet: one real cash payment travels from the dashboard form into the ledger and out to the customer's pages first, then each part thickens.

1. Thin thread: one migration through `pnpm db:generate` (both enums, `payments` with its checks and indexes, RLS, `orders_amount_paid_total_check`) plus a custom migration for `reject_payment_edit` and both triggers; `src/server/db/schema/payments.ts` exported from `public.ts`; `applyEntry`, `netPaid`, `paymentFormMode`, `paymentLimit`; `recordPaymentInDb` success path for a cash payment; `recordPayment` with the schema (cash only at this step; the cheque fields join it in step 2); `readOrderPayments`; `formatDayKey`; the payments card with list, summary, and the cash form; check every test and e2e fixture that sets `amount_paid` directly against the new `amount_paid <= total` check, and make the e2e cleanup for orders with payments use the `session_replication_role = replica` pattern from `price-adjust.db.test.ts`; the storefront payment card rows; the `refund` kind of `orderMoneyLine`; one Playwright run at 1280 recording a partial cash payment and checking the dashboard, `/orders/[number]`, and My Orders; database test of the success path, satisfies **AC-1**, **AC-2**, **AC-4**, **AC-12**, **AC-13**
2. Cheques and the form rules: the method Select and cheque fields, every field check and message, dates with `min` and `max`, `too_much`, `not_allowed`, `stale`, `before_order`, the duplicate id path, focus and notices; database tests for each refusal and the two tab race, satisfies **AC-3**, **AC-4**, **AC-7**, **AC-8**
3. Refunds and corrections: refund mode on cancelled orders; `reversePaymentInDb` and `reversePayment`; `paymentRowsView` with struck rows and reasons; the reversal dialog; the owner cancel warning; the three history lines (`HISTORY_EVENTS`, widened types, `historyEntries`); database tests for every reversal refusal and the `netPaid` sequence, satisfies **AC-5**, **AC-6**, **AC-9**, **AC-10**, **AC-14**
4. Orders list: `orderPaymentBadge`, the "الدفع" column, `amountPaid` on `AdminOrderRow`, the `payment` filter in `admin-filters.ts` and the filter bar, the SQL per value; unit and database tests, satisfies **AC-11**
5. Finish: append only and check constraint database tests, RLS check, logs, layout at 390 and 1280, keyboard and focus, axe on every screen, the remaining Playwright flows and Vitest units, satisfies **AC-14**, **AC-15**, **AC-16**, **AC-17**

## Consequences

**Positive**:
- Every shekel in or out has a row with who, when, how, and why, and nothing can be erased, so the balance can always be explained.
- One number, `orders.amount_paid`, drives the dashboard, the storefront, My Orders, the customers page's owed total (spec 0019), the price cut guard (spec 0022), and the customer cancel rule (spec 0016), so they cannot disagree.
- Retries and double clicks are harmless, and concurrent edits fail loudly as `stale` instead of silently double counting.

**Negative / tradeoffs**:
- `amount_paid` is a stored copy of the ledger sum; any future code that inserts payments outside these two actions could make it drift. Only these actions may write it, and the `netPaid` database test guards it.
- A post dated cheque counts as paid the day you get it, so "مدفوع" can show for money not yet in the bank, and a bounce later moves the order back to partial (and can reopen the customer's own cancel).
- Fixing a wrong amount takes two steps (reverse, then record again).
- Orders with payments can never be deleted (restrict foreign key plus the triggers); database tests that create payments run through `withRollback`, and the one concurrency test needs the trigger bypass cleanup that spec 0022 uses.
- The `amount_paid <= total` check means a later feature that lowers a total (returns, feature 34) must refund first or in the right order in the same transaction, or the write fails.
- Refunds work only on cancelled orders; giving money back on a live or delivered order waits for returns (feature 34), and a goodwill discount on a live order uses a price cut (spec 0022) instead.
- No list of cheques by due date yet; you see cheques only order by order.
- An order cancelled by mistake cannot take a payment, and there is no way to undo a cancel; the customer orders again. Undoing a cancel would be its own feature.

**Neutral**:
- Two migrations: one generated (enums, table, check), one custom (triggers).
- `paymentState` from spec 0015 is reused unchanged; `orderPaymentBadge` adds the cancelled cases on top.
- The design board's payment form gains the bank, cheque date, and note fields and a reversal button the board did not draw.

## Follow-up

- [ ] Update spec 0002's `payments` row to this shape (done when `/sync` runs after this ships): `received_on` date instead of `received_at`, the cheque fields required together, the required reversal note, and the new `orders_amount_paid_total_check`.
- [ ] Spec 0014 follow-up "Feature 24: add the الدفع column and a payment filter" is answered by AC-11; tick it when this ships.
- [ ] Spec 0022 follow-ups on payments (keep `below_paid` reasoning consistent, same lock order) are answered by AC-8 and AC-14; tick them when this ships.
- [ ] [docs/design/pages/admin-order-details.md](../../design/pages/admin-order-details.md): replace "Refunds: not in scope" with refunds on cancelled orders, and add the bank, cheque date, note fields and the reversal dialog.
- [ ] Feature 35 (dashboard home): its الدفع column uses `orderPaymentBadge`.
- [ ] Feature 27 (sales reports): decide whether reports count sales (`total`) only or also collected money (`payments` by `received_on`), and how cheques not yet due are treated.
- [ ] Feature 34 (returns): open refunds to delivered orders by widening `paymentFormMode`, and lower `total` only after or together with the refund so `amount_paid <= total` holds.
- [ ] Later, as its own feature: a "الشيكات" page listing live cheques by `cheque_due_date` (the data is already stored); optionally a "cleared" mark.
- [ ] `/sync`: record in `src/server/db/AGENTS.md` that `payments` is append only through triggers in a custom migration, like `order_line_price_changes`.
