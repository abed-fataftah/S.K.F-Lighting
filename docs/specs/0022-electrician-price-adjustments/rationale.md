# 0022. Electrician price adjustments: rationale

The decision record for [index.md](index.md). The build reads `index.md`; this file is for people and for later `/architect` runs.

## Context

Electricians send large orders (up to 30 lines from a draft, spec 0020). The owner wants to give a better price on some of them without changing the public catalog price that every customer sees. The order already copies `catalog_unit_price` and `unit_price` at placement (spec 0002), stores `line_total`, `subtotal`, and `total`, and has database checks that tie them together. The `line_price_changed` event type already exists. Nothing writes to `unit_price` yet.

The forces:
- **Money must stay exact and traceable.** Totals feed the remaining balance now, and payments (24), reports (27), and loyalty coins (31) later. Every change to money needs who, when, old and new value (spec 0002: money tables are audit trails).
- **Orders are big.** A 30 line order means many prices typed in one sitting, so half saved states and a noisy history are real risks.
- **Two writers can collide.** The owner may have the order open in two tabs, or move its status while editing.
- **Payments can already exist.** `amount_paid` is on the order; a cut must not leave the shop owing money back, since refunds are out of scope.
- **What the electrician sees matters.** The deal should be visible to them, while the owner's reasoning stays private.

## Options considered

### Option 1: Edit mode, one batch save, change rows tied to the save's event (chosen)

An edit mode on the order page; one Server Action saves every changed line in one transaction, writes one `line_price_changed` event (who, when, note, totals) and one append only change row per changed line pointing at it.

**Pros**: one save, one history entry, nothing half saved; reuses `order_events` for who and when, so no duplicate audit columns; typed money columns and foreign keys for each line.
**Cons**: more UI than inline fields; deviates from spec 0002's planned columns (needs a small edit there).

### Option 2: Save each line on blur (the design page's sketch)

Each price field saves when you leave it, one action per line, one event and one change row per line.

**Pros**: least UI; instant feedback per line.
**Cons**: a stray edit saves at once; 30 lines make 30 events in the history; no single place for a reason; many short transactions, each recomputing totals.

### Option 3: Parent and child tables

A new `order_price_adjustments` table (one row per save: order, who, note, time) with `order_line_price_changes` under it.

**Pros**: the cleanest grouping, independent of the events table.
**Cons**: a second new table that repeats what `order_events` already records (actor, time, order); two places to read history from.

### Option 4: Event only, changes as JSON

Store the changed lines as JSON inside the `line_price_changed` event, no new table.

**Pros**: no migration at all; simplest write.
**Cons**: money history loses typed columns, checks, and foreign keys; harder to query per line; goes against spec 0002's audit trail rule.

## Rationale

Option 1 fits the size of electrician orders: the owner reviews a whole order and commits once, which also gives the one natural place for a reason. Tying change rows to the event keeps one source for who and when (the event already carries `actor_user_id`, `created_at`, and is shown in the history), while each line's old and new price stays in typed, checked, append only columns, as spec 0002 requires for money. Option 2 is simpler but turns a 30 line deal into 30 history entries and saves mistakes instantly. Option 3 adds a table for no information the event lacks. Option 4 trades away the audit guarantees that make the totals trustworthy.

The smaller calls, made with the design in view:
- **Concurrency by expected values, not a version column.** The action sends `expectedTotal` and each line's `expectedUnitPrice` and locks the order row; a mismatch is `stale`. This mirrors spec 0014's status moves (`from` must match) and needs no new column. Runner up: an `updated_at` check on the order, which also fires on unrelated changes.
- **Discount computed on read, `discount_total` untouched.** The cut lives in `unit_price`, so `subtotal` already reflects it; `discount_total` stays reserved for loyalty rewards (feature 32), and storing a second copy of the discount would only drift. Runner up: write the cut into `discount_total`, which would mix two meanings in one column.
- **Note in `order_events.data.note`.** One note per save, shown only in the dashboard. Runner up: a `note` column on each change row (repeated per line).
- **Foreign keys `restrict` plus a trigger.** The app never deletes orders; history that cannot vanish matters more than test cleanup convenience. Runner up: `cascade` from the order, which the trigger would block anyway.
- **`parseShekels` gains `allowZero`** instead of a second parser, so every price field keeps one parsing rule. Runner up: a separate `parseShekelsOrZero`.
- **Lines only, never raising above catalog, locked at delivery.** These were the engineer's choices; they keep the feature to "a better deal" and keep settled orders settled.
