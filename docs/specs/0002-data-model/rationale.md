# 0002. Data model: decision record

The build spec is [index.md](index.md). This file keeps the reasoning; `/develop` does not read it.

## Context

The shop sells lighting products that come in sizes and colours, with a price that can differ per size and availability that can differ per combination. Orders arrive from guests, registered customers, and electricians ordering for an end customer, and travel through WhatsApp, so the order number has to be easy to read aloud. The owner records cash and cheque payments by hand, gives electricians better prices on single orders, and after launch adds loyalty coins and returns that change totals and balances after the fact.

The stack is fixed by spec 0001: Postgres 17 on Supabase, Drizzle owning the `public` schema, every query on the server, RLS on with no policies, and migrations that only add. So a model that needs a breaking change later is expensive: every later feature is built on this one, and a removal or type change has to be staged over several deploys.

The forces: history must never change when the catalog changes (a past order is a legal and money record); money must be auditable (GA features 23, 24, 34); the solo builder needs a model simple enough to reason about; scale is small (hundreds of products, a handful of orders a day), so performance is not a driver.

Not deciding now means each slice invents its own tables, and the first time returns or coins touch an order total the earlier columns turn out wrong.

## Options considered

### Option 1: Relational model with snapshots and append only ledgers (chosen)

Normalized tables, one variant row per size and colour combination, orders copying prices and customer details at placement, stored totals recomputed in one transaction, payments and coins as append only ledgers.

**Pros**: history safe by construction; every money change has a row explaining it; constraints in the database catch bugs; plain columns for lists and reports.
**Cons**: more tables; stored totals and caches must be recomputed by every money action; combination rows multiply for products with many options.

### Option 2: Minimal tables, compute everything, lines as JSON

Products with a JSON list of options, orders with a JSON array of lines, totals and balances always computed on read, payments editable.

**Pros**: fewest tables and the fastest first slice; nothing stored can drift.
**Cons**: no foreign keys or checks on lines; price adjustments and returns need JSON surgery; reports and filters parse JSON; editable payments lose the audit trail the GA features need.

### Option 3: Generic option groups (Shopify style)

Option groups and values in their own tables, variants linked to values, the rest as in Option 1.

**Pros**: any future option (bulb type, voltage) without a migration.
**Cons**: three more tables and a harder admin UI and import for an option set (size, colour) that is already known; filters join through two extra tables.

### Choices made per dimension

| Dimension | Chosen | Runner up |
|---|---|---|
| Build scope | Design all, migrate the core now | Migrate everything now |
| Variants | One row per size and colour | Sizes priced, colours separate |
| Availability | In stock flag | Counted stock |
| Codes | Product code plus optional variant code | Product code only |
| Price | Always on the variant | Product price with variant override |
| Categories | Two levels, one per product | Flat |
| Specs | Ordered label and value list (JSON) | Fixed columns |
| Media | Optional link to a variant | Product only |
| Option values | Shared colour list, free text sizes | Shared lists for both |
| Removal | Status active, hidden, archived | Visible flag plus soft delete |
| Order number | `YY-NNNNN` per year | Plain running number |
| Drafts | Separate tables | Orders in a draft status |
| Cart | Browser only | Database carts |
| Customer details | Full copy on the order | Saved addresses plus copy |
| Price adjustment | Catalog price, current price, change log | Two prices, no log |
| Totals | Stored, recomputed in one transaction | Computed on read |
| Statuses | Starter enum now | Column only |
| History | Event log with seen flag | Columns on the order |
| Delivery fee | Zones table | Cities mapped to zones |
| Payment allocation | One payment, one order | Split across orders |
| Cheques | Number, bank, due date, bounce as reversal | Number and bank only |
| Payment fixes | Append only with kinds | Editable rows |
| Electrician prices | Per order adjustments only | Price per variant |
| Phones | As typed plus E.164 | Digits only |
| Coins | Append only ledger, cached balance | Balance column plus history |
| Exchanges | Returned quantity plus new lines on the same order | New linked order |
| Keys | UUID | Integer identity |
| URLs | Arabic slug ending in the code | Code only |
| Profiles | Name, phone, role; deletion keeps order copies | Block deletion |
| Banners | Image, link, order, on/off | Plus start and end dates |
| Seed | Zones, settings, three demo products | Zones and settings only |

### Calls made while writing (the engineer did not weigh in)

- `updated_at` set by Drizzle `$onUpdate`, since every write goes through Drizzle (runner up: a trigger per table).
- Full `order_event_type` and `actor_kind` lists created now, so later features need no `ALTER TYPE` (runner up: add values per feature).
- `amount_paid` stored next to the totals, so dashboard and My Orders lists filter unpaid orders with a plain column (runner up: a view summing payments).
- Order number year taken in `Asia/Jerusalem`, so an order at 00:30 local time on 1 January gets the new year (runner up: UTC year).
- New products default to `active`, matching "see the change on the site right away" in feature 7 (runner up: `hidden` until published).
- Demo data from `scripts/seed-dev.ts` after migrate, because `supabase db reset` runs `seed.sql` before Drizzle migrations create the tables (runner up: a Supabase migration copy of the schema, which would duplicate the source of truth).
- Category depth checked in its Server Action (runner up: a trigger), since one action owns that write. Variant ownership for order lines and media uses composite foreign keys, added after the cross check.
- Coin and redemption rows block profile deletion (`restrict`), since a cascade would delete rows from append only ledgers; account removal anonymizes instead (from the cross check).
- Hyperdrive query caching turned off, so reads outside a transaction are never up to 60 seconds stale (from the cross check).
- `area` nullable until feature 13 decides whether it is required.

## Rationale

History safety and money auditability are the forces that decide this, and only Option 1 delivers both without JSON surgery. Copying name, code, size, colour, and price onto each line makes "later edits change no old order" a property of the schema rather than a habit. Keeping `catalog_unit_price` beside `unit_price`, with a change log, gives feature 23 its original price and its audit at once. Payments and coins as append only ledgers mean a bounced cheque, a refund, or a clawback is a new row with a reason, which is what the GA features will be reviewed against.

Stored totals go against the usual rule of computing derived values on read, and that is a deliberate exception. An order's total at placement is itself a record (what the customer agreed to), every list and report reads it, and the database check `total = subtotal + delivery_fee - discount_total` plus a recompute helper used inside every money transaction keep it honest. The cost, an action that forgets to recompute, is covered by the DB tests and by funnelling every change through `recomputeOrderTotals`.

Option 3's flexibility solves a problem the shop does not have: the scope names exactly two option kinds. Option 2 is faster for Slice 1 only, and would be the breaking change this feature exists to prevent by Slice 6. Designing every table now but migrating only the core keeps the Tracer Bullet thin while the later features add tables that are already agreed.
