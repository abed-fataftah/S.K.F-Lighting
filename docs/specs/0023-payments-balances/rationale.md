# 0023. Payments and balances: rationale

Decision record for [index.md](index.md). The build spec is there; this file holds the why.

## Context

The shop is paid in cash or by cheque, never online, so every shekel arrives at the counter or on delivery and the owner has to write it down. Electricians often pay large orders in parts, and post dated cheques (شيكات مؤجلة, cheques dated for a later day) are a normal way to pay. Until now the site stored only a single number per order, `orders.amount_paid`, always 0, which the customer page, My Orders, the customers page's owed total, the price cut guard, and the customer cancel rule already read. This feature is what makes that number real.

Money records have to be trustworthy over years: the owner must be able to explain any balance, a bounced cheque must be visible as a bounce rather than vanish, and a mistyped amount must not be quietly overwritten. Spec 0002 already set the shape: an append only ledger (rows are only ever added) in a `payments` table, with refunds and reversals as rows of their own, and `amount_paid` as a cached sum. Several existing features take the order row lock before touching money (spec 0022), so a new writer must join that order to avoid deadlocks and double counting.

The forces are a single owner working from a phone or a counter computer, small volume (a few payments per order, tens of orders a day at most), Arabic only screens, and a hard rule against editing or deleting money rows. There is no card data, so no PCI scope (the card industry's security standard), but the feature changes money, so it needs the stronger admin check (`getUser()` through `requireAdmin()`), an audit trail, and tests without mocks for the math.

Without this decision the owner would keep balances on paper, the "paid" badges would never move, and reports (feature 27) and returns (feature 34) would have nothing to build on.

## Options considered

### Option 1: Append only ledger, `amount_paid` updated by the actions in the same transaction

Each payment, refund, and reversal inserts one `payments` row. The Server Action locks the order row, checks the rules, inserts the row, sets `orders.amount_paid` from a pure `applyEntry`, and writes one history event, all in one transaction. Triggers refuse updates and deletes.

**Pros**:
- Matches spec 0002 and the price adjustment pattern (spec 0022) already in the code, so it is one more instance of a known shape.
- Every reader keeps using `amount_paid` with no change; list filters and sorting stay plain column queries.
- The math lives in pure, unit tested functions, per the project rule for money.

**Cons**:
- `amount_paid` is a stored copy of the ledger sum and can drift if some later code inserts a row without updating it.
- Two places to keep in step (row and cache) inside every action.

### Option 2: Append only ledger, `amount_paid` kept by a database trigger

The same table, but an `after insert` trigger on `payments` updates `orders.amount_paid`.

**Pros**:
- The cache can never drift, whoever inserts the row.

**Cons**:
- Money logic moves into PL/pgSQL, outside the pure TypeScript functions the project requires for money, and outside Vitest.
- The limit checks (no overpayment, refunds only on cancelled orders) still need the order lock in the action, so the logic ends up split across two languages.
- Drizzle does not track triggers, so behaviour hides in a custom migration.

### Option 3: Ledger only, sum on every read

No cached column is written; every reader sums `payments` per order.

**Pros**:
- One source of truth, nothing to keep in step.

**Cons**:
- Every existing reader (customer page, My Orders, customers owed total, list, cancel rule, price cut guard) must change to a join and aggregate, and list filters by payment state become aggregate queries.
- `orders.amount_paid` already exists and is already read, so dropping its meaning breaks spec 0002, 0015, 0016, 0018, 0019, 0022.

### Option 4: Editable payment rows with a separate audit log

Payments are normal rows the owner can edit or delete; an audit table records each change.

**Pros**:
- Fixing a typo is one step.

**Cons**:
- Breaks the spec 0002 rule that money rows are never edited; the audit log becomes the real history and the payments table a summary that can lie.
- A bounced cheque turns into an edit instead of a visible event.

## Rationale

Option 1 is the right fit because the forces here are trust and consistency with what already exists, not scale. The project already chose an append only ledger with a cached sum in spec 0002 and already built the same pattern for price changes in spec 0022 (order lock first, one event per save, triggers for append only). Reusing it means the owner's money trail works the same way everywhere, and `/develop` builds a shape the codebase already knows. The drift risk of the cache is real but narrow: only two actions write payments, both in one transaction, and a database test asserts `amount_paid = netPaid` after a mixed sequence; the new `amount_paid <= total` check adds a database backstop for the worst kind of drift.

Option 2 would guarantee the cache, but it moves money math into SQL, against the project rule that money is pure and unit tested, while the real business rules still need the lock in the action. Option 3 is the purest model but would rewrite six shipped readers for no user benefit at this volume. Option 4 trades a two step fix for a ledger that can be rewritten, which is exactly what the owner cannot afford with cheques that bounce.

Smaller calls made in the spec, with the runner up:
- **Idempotency through a client supplied row id** (`paymentId` made on the server render, inserted as the row's primary key) rather than a separate idempotency key column. It needs no extra column and a retry finds its own row. Runner up: rely on the `expectedAmountPaid` stale check alone, which blocks a double insert but answers a harmless retry with a confusing `stale`.
- **`received_on` as a date**, not 0002's timestamptz, because the owner can backdate an entry and has no real time for it; `created_at` keeps the true moment. Runner up: a timestamptz at shop midnight, which invents a time.
- **The orders list shows "استرجاع مستحق" with the yellow `new` badge**, because it is the one payment state that needs the owner to act and the design tokens have no other attention colour. Runner up: `proc`, which would hide it among partial payments.
- **The customer sees amounts only, no payment list**, because the order page opens with order number plus phone and cheque details and notes are private.
- **Reversal date is today**, not chosen, because a reversal records when the owner learned of the problem; the original row keeps its own day.
