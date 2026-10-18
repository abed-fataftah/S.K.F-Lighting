# 0002. Data model for the S.K.F Lighting shop

**Date**: 2026-10-17
**Status**: In Progress

## Summary

This spec is the shape of everything the shop stores: products and their size and colour combinations, categories, people and roles, orders, drafts, payments, coins, and returns. The whole model is designed now so no later feature needs a breaking change, but only the core tables that the first real order needs are created in this feature; each later feature adds its own tables from this spec. Orders copy the product, price, and customer details at the moment of ordering, so later catalog edits never change an old order, and money records (payments, coins) are append only (rows are added, never edited or deleted).

## Requirements

**User stories**:
- As the owner, I want every order to keep the prices and details it was placed with, so that editing the catalog never rewrites history.
- As the owner, I want to change one line's price on an electrician order without touching the catalog price, so that I can give a better deal and still see the original.
- As a customer, I want a short order number I can read over WhatsApp, so that the shop finds my order fast.
- As the builder of every later slice, I want the tables for my feature already designed, so that I add them without changing what exists.

**Acceptance criteria**:
- **AC-1**: On a fresh local database, `pnpm db:migrate` creates every core table and enum in *Data model sketch*; right after, `pnpm db:generate` produces no new migration and `drizzle-kit check` passes; a DB test finds the named key constraints and indexes in `pg_constraint` and `pg_indexes`.
- **AC-2**: Every `public` table has RLS (row level security) enabled; `anon`, `authenticated`, and `PUBLIC` hold no table, sequence, or function privileges in `public`, including for objects created later by `postgres` (default privileges revoked); `pnpm db:check-rls` passes, and fails when a table without RLS exists.
- **AC-3**: Creating an auth user creates a `profiles` row with role `customer` and the full name from sign up metadata when present; auth users that existed before the migration get a profile too (backfill).
- **AC-4**: Within one product, each (size, colour) pair is unique (two variants with no size and no colour count as a duplicate); a product has at most one default variant; a variant price must be a positive integer of agorot.
- **AC-5**: An order line keeps the product name, product code, variant code, size, colour name, and catalog unit price from the moment of ordering; later edits to the product, the variant price, or the colour name change no existing line or order.
- **AC-6**: Changing one line's `unit_price` leaves its `catalog_unit_price` and the variant price unchanged, and after recompute the line total, subtotal, and total agree; the database rejects an order whose `total` is not `subtotal + delivery_fee - discount_total`, and a line whose `line_total` is not `unit_price * quantity`.
- **AC-7**: Order numbers read `YY-NNNNN` (for example `26-00042`), take the year from `placed_at` in `Asia/Jerusalem`, are unique, run consecutively within a year, and restart at `00001` each year; 20 orders placed at the same moment get 20 distinct consecutive numbers.
- **AC-8**: A delivery order without an address or a delivery zone is rejected; a pickup order with a delivery fee above 0 is rejected; a pickup order without an address is accepted.
- **AC-9**: A product or variant that any order line references, and a colour any variant uses, cannot be deleted; archived products and variants still show correctly on old orders; a line's variant always belongs to the line's product.
- **AC-10**: `normalizePhone` turns the local and international forms of one number into the same E.164 value (`0599 123 456`, `+970599123456`, `00970599123456` all become `+970599123456`; `054 123 4567` becomes `+972541234567`) and returns `null` for input that is not a valid mobile number.
- **AC-11**: Every later scope feature (7 to 34) maps to tables and columns in this spec that only add to the core (see *Coverage by feature*); checked in review.
- **AC-12**: `pnpm db:seed` on a local database adds two categories, three colours, and three demo products (one simple, one with sizes, one with size by colour), can run twice without duplicating, and refuses to run unless the database host is `localhost` or `127.0.0.1` on port `54322`. Production gets only the two delivery zones and the settings row, from the migration.

## Decision

**Chosen option**: Option 1: Relational model with snapshots on orders and append only ledgers for money

A normalized Postgres schema in Drizzle, one variant row per size and colour combination, orders that copy every price and customer detail at placement with stored totals recomputed in one transaction, and append only ledgers for payments and coins, designed whole now and migrated feature by feature.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Conventions (every table)

- **Keys**: `id uuid primary key default gen_random_uuid()`, except `profiles` (keyed by the auth user id), `shop_settings` (single row, `id smallint = 1`), `order_number_counters` (keyed by year), and `featured_products` (keyed by product).
- **Money**: `integer` agorot (1 ₪ = 100 agorot), never floats. Pure functions in TypeScript do all money math.
- **Time**: `created_at timestamptz not null default now()` on every table; `updated_at timestamptz not null default now()` on every table that is edited, set by Drizzle `$onUpdate(() => new Date())` (all writes go through Drizzle; a trigger is the runner up).
- **Text**: Arabic content in plain `text`. No translation tables (Arabic only, per 0001).
- **Foreign keys**: every foreign key column gets an index. References from orders and lines into the catalog are `on delete restrict`.
- **Schema files**: `src/server/db/schema/` split by area: `enums.ts`, `profiles.ts`, `catalog.ts`, `settings.ts`, `orders.ts` (core); later `drafts.ts`, `payments.ts`, `loyalty.ts`, `returns.ts`, `content.ts`. Each table calls `.enableRLS()`.
- **Enums**: Postgres enums. Adding a value later is safe, but put `ALTER TYPE ... ADD VALUE` in its own migration before any migration that uses the value.

### Data model sketch

**Enums (core)**

| Enum | Values |
|---|---|
| `user_role` | `customer`, `electrician`, `admin` |
| `product_status` | `active`, `hidden`, `archived` |
| `media_kind` | `image`, `video` |
| `fulfilment_method` | `pickup`, `delivery` |
| `order_status` | `new`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `cancelled` |
| `actor_kind` | `guest`, `customer`, `electrician`, `admin`, `system` |
| `order_event_type` | `created`, `status_changed`, `cancelled`, `line_price_changed`, `payment_recorded`, `return_requested`, `return_decided`, `note` (the full list now, so later features need no `ALTER TYPE`) |

**Core tables (this feature's migration)**

`profiles`
| Column | Type | Rules |
|---|---|---|
| `id` | uuid | PK, FK `auth.users(id)` on delete cascade |
| `full_name` | text | nullable |
| `phone` | text | nullable, as typed |
| `phone_e164` | text | nullable, `normalizePhone(phone)`, indexed |
| `role` | `user_role` | not null, default `customer` |
| `coin_balance` | integer | not null, default 0; cache of `coin_transactions` (feature 31) |

Created by the trigger `public.handle_new_user()` on `auth.users` insert: `security definer`, `set search_path = ''`, takes `full_name` from `raw_user_meta_data ->> 'full_name'`, else `->> 'name'` (Google). Written as a hand edited Drizzle migration; `execute` revoked from `public`, `anon`, `authenticated`. The same migration backfills existing users: `insert into public.profiles (id, full_name) select id, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name') from auth.users on conflict (id) do nothing`.

`phone` and `phone_e164` are set only by the profile form (feature 18), never by the trigger. Email is not copied: add `email` to the `authUsers` stub in `src/server/db/schema/auth.ts` and join `auth.users` when a screen needs it (features 18, 20).

**Account removal**: once a user has coin or redemption rows (feature 31 on), the profile cannot be deleted (those FKs are `restrict` and the ledgers are append only). Features 18 and 20 remove an account by anonymizing it: clear `full_name`, `phone`, `phone_e164`, and delete or ban the auth login through Supabase Auth admin only when no ledger row points at the profile.

`categories`
| Column | Type | Rules |
|---|---|---|
| `parent_id` | uuid | nullable, FK `categories(id)` on delete restrict; `check (parent_id <> id)` |
| `name` | text | not null |
| `slug` | text | not null, unique |
| `description` | text | nullable |
| `sort` | integer | not null, default 0 |
| `is_visible` | boolean | not null, default true |

Two levels at most: a category whose parent has a parent is rejected by the category Server Action (feature 9), not the database.

`colours`
| Column | Type | Rules |
|---|---|---|
| `name` | text | not null, unique |
| `hex` | text | nullable, `check (hex ~ '^#[0-9A-Fa-f]{6}$')` |
| `sort` | integer | not null, default 0 |

`products`
| Column | Type | Rules |
|---|---|---|
| `category_id` | uuid | not null, FK `categories` on delete restrict, indexed |
| `code` | text | not null, unique, `check (code = upper(btrim(code)))` |
| `name` | text | not null |
| `slug` | text | not null, unique; `buildProductSlug(name, code)` |
| `description` | text | nullable |
| `specs` | jsonb | not null, default `'[]'`, `check (jsonb_typeof(specs) = 'array')`; items `{ label: string, value: string }`, order kept; shape validated by a Zod schema |
| `status` | `product_status` | not null, default `active`, indexed |
| `is_available` | boolean | not null, default true |

- `code` cannot change after create (the import upserts by code and photos match by code). `slug` is set once at create and never regenerated on rename, so shared links keep working.
- Dimensions are a `specs` item labelled `الأبعاد`; when they differ per size, they go in `size_label`.
- **List price** (category lists, homepage, search): the lowest `price` among sellable variants, shown as "من ₪X" when sellable variants differ in price; a product with no sellable variant shows as out of stock.
- Products in a category list newest first (`created_at desc`); a `sort` column can be added later without breaking anything.

`product_variants`
| Column | Type | Rules |
|---|---|---|
| `product_id` | uuid | not null, FK `products` on delete cascade, indexed |
| `size_label` | text | nullable (free text, e.g. `60 سم`) |
| `size_sort` | integer | not null, default 0 |
| `colour_id` | uuid | nullable, FK `colours` on delete restrict, indexed |
| `code` | text | nullable, unique, uppercase check as products |
| `price` | integer | not null, `check (price > 0)` |
| `is_available` | boolean | not null, default true |
| `is_default` | boolean | not null, default false |
| `sort` | integer | not null, default 0 |
| `archived_at` | timestamptz | nullable |

Unique `(product_id, size_label, colour_id) nulls not distinct`. Unique `(id, product_id)` (target for the composite FKs below). Partial unique index on `(product_id) where is_default`. A product with no options has exactly one variant (no size, no colour, `is_default = true`); the product actions (feature 7) keep that true. **Sellable** means product `status = 'active'` and `is_available`, and variant `is_available` and `archived_at is null`.

`product_media`
| Column | Type | Rules |
|---|---|---|
| `product_id` | uuid | not null, FK `products` on delete cascade, indexed |
| `variant_id` | uuid | nullable; composite FK `(variant_id, product_id)` → `product_variants (id, product_id)` `on delete set null (variant_id)` (Postgres 15+, written in the custom migration), so a photo's variant always belongs to its product |
| `kind` | `media_kind` | not null |
| `storage_key` | text | not null, unique; `products/{productId}/{uuid}.{ext}` in bucket `product-media` (0001) |
| `alt` | text | nullable, Arabic |
| `width`, `height` | integer | nullable |
| `sort` | integer | not null, default 0 |

`delivery_zones`
| Column | Type | Rules |
|---|---|---|
| `name` | text | not null, unique |
| `fee` | integer | not null, `check (fee >= 0)` |
| `sort` | integer | not null, default 0 |
| `is_active` | boolean | not null, default true |

The migration inserts `الضفة الغربية` (2000) and `الداخل (مناطق 48)` (7000). The owner renames or edits fees in feature 26.

`shop_settings` (one row)
| Column | Type | Rules |
|---|---|---|
| `id` | smallint | PK, default 1, `check (id = 1)` |
| `shop_name` | text | not null |
| `whatsapp_number` | text | nullable; feature 26 moves `NEXT_PUBLIC_WHATSAPP_NUMBER` here |
| `contact_phone`, `email`, `address` | text | nullable |

The migration inserts the row with `shop_name = 'S.K.F Lighting'`.

`order_number_counters`
| Column | Type | Rules |
|---|---|---|
| `year` | smallint | PK (four digit year) |
| `last_value` | integer | not null, default 0 |

No `updated_at`: the counter is written by raw SQL, where Drizzle's `$onUpdate` does not run.

`orders`
| Column | Type | Rules |
|---|---|---|
| `order_number` | text | not null, unique |
| `placed_by_user_id` | uuid | nullable (guest), FK `profiles` on delete set null, indexed |
| `placed_by_role` | `user_role` | nullable (guest); copied from the profile at placement |
| `customer_name` | text | not null |
| `customer_phone` | text | not null, as typed |
| `customer_phone_e164` | text | not null, indexed |
| `city` | text | not null |
| `area` | text | nullable (feature 13 decides if required) |
| `address` | text | nullable |
| `notes` | text | nullable |
| `fulfilment` | `fulfilment_method` | not null |
| `delivery_zone_id` | uuid | nullable, FK `delivery_zones` on delete restrict |
| `delivery_zone_name` | text | nullable, copied |
| `delivery_fee` | integer | not null, default 0, `check (>= 0)`, copied |
| `subtotal` | integer | not null, `check (>= 0)` |
| `discount_total` | integer | not null, default 0, `check (>= 0)` (feature 32) |
| `total` | integer | not null, `check (total = subtotal + delivery_fee - discount_total and total >= 0)` |
| `amount_paid` | integer | not null, default 0, `check (>= 0)`; cache of `payments` (feature 24) |
| `status` | `order_status` | not null, default `new`, indexed |
| `placed_at` | timestamptz | not null, default now(), indexed; always inserted explicitly with the same `Date` passed to `allocateOrderNumber` |
| `cancelled_at` | timestamptz | nullable |
| `cancelled_by` | `actor_kind` | nullable |
| `cancel_reason` | text | nullable |
| `delivered_at` | timestamptz | nullable |

Checks: `fulfilment = 'delivery'` requires `delivery_zone_id`, `delivery_zone_name`, and `btrim(address) <> ''`; `fulfilment = 'pickup'` requires `delivery_fee = 0`, `delivery_zone_id is null`, and `delivery_zone_name is null`; `(status = 'cancelled') = (cancelled_at is not null)`. A guest or an electrician order for someone else uses the same columns: the copied customer fields are the end customer, `placed_by_user_id` is the account that sent it.

`order_lines`
| Column | Type | Rules |
|---|---|---|
| `order_id` | uuid | not null, FK `orders` on delete cascade, indexed |
| `product_id` | uuid | not null, FK `products` on delete restrict, indexed |
| `variant_id` | uuid | not null, indexed; composite FK `(variant_id, product_id)` → `product_variants (id, product_id)` on delete restrict (Drizzle `foreignKey()`) |
| `product_name`, `product_code` | text | not null, copied |
| `variant_code`, `size_label`, `colour_name` | text | nullable, copied |
| `quantity` | integer | not null, `check (> 0)` |
| `catalog_unit_price` | integer | not null, `check (> 0)`, copied, never changes |
| `unit_price` | integer | not null, `check (>= 0)`, starts equal to `catalog_unit_price` |
| `line_total` | integer | not null, `check (line_total = unit_price * quantity)` |
| `sort` | integer | not null, default 0 |

`line_total` is always the ordered amount (`unit_price * quantity`), also after returns. Old lines show product images live from `product_media`; when a product has no image left, show a placeholder.

`order_events`
| Column | Type | Rules |
|---|---|---|
| `order_id` | uuid | not null, FK `orders` on delete cascade, indexed |
| `type` | `order_event_type` | not null |
| `actor_kind` | `actor_kind` | not null |
| `actor_user_id` | uuid | nullable, FK `profiles` on delete set null |
| `from_status`, `to_status` | `order_status` | nullable |
| `data` | jsonb | not null, default `'{}'`; never holds a phone or an address |
| `seen_at` | timestamptz | nullable; partial index on `created_at where seen_at is null` |

Every new order writes a `created` event in the same transaction. The dashboard flags unseen events of type `created`, `cancelled`, `return_requested`; opening an order sets `seen_at` on its events (feature 15).

**Later tables (designed now, added by the named feature)**

| Table (feature) | Columns | Rules |
|---|---|---|
| `order_line_price_changes` (23) | `order_line_id` FK cascade, `old_unit_price`, `new_unit_price` (`>= 0`), `changed_by` FK `profiles` restrict, `note` nullable | One row per change; the action updates `unit_price`, `line_total`, recomputes totals, and writes a `line_price_changed` event in one transaction |
| `drafts` (21) | `owner_user_id` FK `profiles` cascade, `name`, end customer copies (`customer_name`, `customer_phone`, `customer_phone_e164`, `city`, `area`, `address`, `notes`, all nullable), `fulfilment` nullable, `delivery_zone_id` nullable, `submitted_order_id` nullable unique FK `orders` set null, `submitted_at` nullable | Partial unique `(owner_user_id, name) where submitted_at is null`; a sent draft is kept, hidden from the draft list |
| `draft_lines` (21) | `draft_id` FK cascade, `variant_id` FK restrict, `quantity` nullable `check (quantity is null or quantity > 0)`, `sort` | Unique `(draft_id, variant_id)`, so adding again merges (22); no price stored, live price shown; a null quantity or an unsellable variant blocks sending |
| `payments` (24) | `order_id` FK restrict, `kind` (`payment`, `refund`, `reversal`), `method` (`cash`, `cheque`), `amount` (`> 0`), `received_at` timestamptz, `cheque_number`, `cheque_bank`, `cheque_due_date` date (all nullable), `reverses_payment_id` nullable unique FK `payments` restrict, `note` nullable, `recorded_by` FK `profiles` restrict | `kind = 'reversal'` exactly when `reverses_payment_id` is set; cheque fields null unless `method = 'cheque'`; a trigger rejects `UPDATE` and `DELETE`; a bounced cheque or a mistake is a reversal of the original, which the action allows only for the same `order_id`, with `amount` equal to the original, and never on a row that is itself a reversal |
| `coin_transactions` (31) | `user_id` FK `profiles` restrict, `amount` (`<> 0`, signed), `reason` (`earned_order`, `redeemed_reward`, `reward_cancelled`, `return_clawback`, `manual_adjustment`), `order_id` nullable FK restrict, `redemption_id` nullable FK restrict, `note`, `created_by` nullable FK `profiles` | Partial unique `(order_id) where reason = 'earned_order'` and `(redemption_id) where reason = 'redeemed_reward'`; append only trigger; feature 31 decides whether a balance may go below 0 and adds earning rule columns to `shop_settings` |
| `rewards` (32) | `name`, `description`, `kind` (`gift`, `discount`), `coin_cost` (`> 0`), `discount_amount` nullable, `is_active` | `discount_amount` required exactly when `kind = 'discount'`; retire with `is_active = false` |
| `reward_redemptions` (32) | `reward_id` FK restrict, `user_id` FK `profiles` restrict, `order_id` nullable FK restrict, `coins_spent` (`> 0`), `discount_applied` (default 0), `status` (`applied`, `cancelled`) | `orders.discount_total` = sum of `discount_applied` over its `applied` redemptions |
| `return_requests` (33) | `order_id` FK restrict, `requested_by` `actor_kind`, `requested_by_user_id` nullable FK `profiles` set null, `status` (`requested`, `approved`, `rejected`, `completed`), `customer_reason`, `admin_note`, `decided_by`, `decided_at`, `completed_at` (nullable) | Only on `delivered` orders (checked in the action) |
| `return_request_lines` (33) | `return_request_id` FK cascade, `order_line_id` FK restrict, `quantity` (`> 0`), `reason` nullable, `resolution` (`refund`, `exchange`) nullable, set at approval (34) | Unique `(return_request_id, order_line_id)` |
| `order_lines` additions (34) | `returned_quantity` integer not null default 0 `check (returned_quantity between 0 and quantity)`, `return_request_id` nullable FK `return_requests` (marks an exchange replacement line) | Subtotal then counts `unit_price * (quantity - returned_quantity)`; `line_total` stays the ordered amount, the net line amount is derived for display, reports use `orders.subtotal`; refunds go to `payments` as `kind = 'refund'` |
| `pages` (26) | `slug` unique, `title`, `body` (Markdown, Arabic) | Migration seeds `privacy`, `terms`, `returns` |
| `banners` (25) | `image_key`, `phone_image_key` nullable, `alt` not null, `link_url` nullable, `sort`, `is_active` | Images in `product-media` under `banners/{uuid}.{ext}` |
| `featured_products` (25) | `product_id` PK FK `products` cascade, `sort` | |

Not in this model, by decision: carts (kept in the browser, feature 12), saved addresses, stock counts, electrician catalog prices, guest lookup attempt counters (feature 16 decides rate limiting), search columns (feature 11 adds them).

### Coverage by feature

| Feature | Uses |
|---|---|
| 6 First order | core tables |
| 7, 8 Products, import | `products`, `product_variants`, `product_media`, `colours`, `categories` |
| 9, 10, 11 Browse, product page, search | catalog tables; 11 may add search indexes or columns |
| 12 Cart | no tables; variant ids in the browser, live prices read on the server |
| 13, 14 Checkout, confirmation | `orders`, `order_lines`, `delivery_zones`, `order_number_counters`, `order_events` |
| 15, 16, 17 Manage, lookup, cancel | `orders.status`, `order_events`, `customer_phone_e164`, `cancelled_*` |
| 18, 19, 20 Accounts, My Orders, roles | `profiles`, `orders.placed_by_user_id`, `amount_paid` |
| 21, 22 Drafts | `drafts`, `draft_lines` |
| 23 Price adjustments | `order_lines.unit_price`, `order_line_price_changes` |
| 24 Payments | `payments`, `orders.amount_paid` |
| 25, 26 Homepage, settings | `banners`, `featured_products`, `shop_settings`, `delivery_zones`, `pages` |
| 27 Reports | `orders` totals and status (math decided in 27) |
| 31, 32 Loyalty | `coin_transactions`, `profiles.coin_balance`, `rewards`, `reward_redemptions`, `orders.discount_total` |
| 33, 34 Returns | `return_requests`, `return_request_lines`, `order_lines` additions, `payments` refunds |

### State transitions

- **Order** (starter list; feature 15 decides who moves it and enforces transitions in its action): `new → confirmed → preparing → ready` (pickup) or `out_for_delivery` (delivery) `→ delivered`. Any state before `delivered` may go to `cancelled` (feature 17 decides the exact cut off). Payment state is separate, derived from `total` and `amount_paid` (feature 24).
- **Product**: `active ⇄ hidden`, either `→ archived`, `archived → hidden` to restore.
- **Return request** (33, 34): `requested → approved | rejected`, `approved → completed`.
- **Reward redemption** (32): `applied → cancelled`.

### API surface

No HTTP endpoints. This feature ships pure functions (no database, unit tested without mocks) and two `server-only` helpers that later actions call inside their transaction.

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `computeLineTotal(unitPrice, quantity)` in `src/features/orders/totals.ts` | pure | integers | integer agorot | none | throws on non integer or negative input (bug) |
| `computeOrderTotals({ lines, deliveryFee, discountTotal })` same file | pure | lines: `{ unitPrice, quantity, returnedQuantity? }[]` | `{ subtotal, total }` | none | throws if total would be below 0 |
| `formatOrderNumber(year, seq)` in `src/features/orders/order-number.ts` | pure | 4 digit year, sequence ≥ 1 | `"26-00042"` (sequence padded to at least 5 digits) | none | throws on seq < 1 |
| `orderYear(placedAt)` same file | pure | `Date` | year in `Asia/Jerusalem` | none | none |
| `normalizePhone(raw)` in `src/lib/phone.ts` | pure | string | E.164 string or `null` | none | `null` for invalid |
| `buildProductSlug(name, code)` in `src/features/catalog/slug.ts` | pure | Arabic name, code | e.g. `ثريا-كريستال-CH-1020` | none | none |
| `allocateOrderNumber(tx, placedAt)` in `src/features/orders/server/order-number.ts` | server, inside a transaction | Drizzle transaction, `Date` | order number string | caller's | rolls back with the order; never call outside a transaction |
| `recomputeOrderTotals(tx, orderId)` in `src/features/orders/server/totals.ts` | server, inside a transaction | transaction, order id | updated `{ subtotal, total }` | caller's | order missing → throws (bug) |
| `getDirectDb()` in `src/server/db/direct.ts` | server, scripts and tests only | none (reads `DATABASE_URL_DIRECT`) | Drizzle client over postgres.js | none | missing URL → throws |

`recomputeOrderTotals` reads `delivery_fee` and `discount_total` from the order row and the stored lines, then writes only `subtotal` and `total`. Callers update `line_total`, `delivery_fee`, or `discount_total` first, in the same transaction. `getDirectDb()` exists because `getDb()` needs the Workers context; the app never imports it.

Rules for the pure functions:
- `normalizePhone`: strip spaces, dashes, dots, and brackets. `+970` or `00970` followed by 9 digits starting `5` → `+970…`; same for `+972`/`00972`. A local number `05XXXXXXXX` (10 digits): `059` and `056` → `+970` + the 9 digits after the `0`; any other `05` → `+972`. Anything else → `null`. Checkout accepts mobile numbers only: a phone `normalizePhone` rejects (a landline, for example) gets a clear "mobile number" message, because `customer_phone_e164` is required. Feature 13 may tighten this; if it changes the output for an existing number, it backfills the stored `*_phone_e164` columns in the same migration.
- `buildProductSlug`: remove Arabic diacritics (tashkeel) and tatweel, keep Arabic and Latin letters and digits, turn runs of anything else into one `-`, trim `-` at both ends, lowercase any Latin letters in the name part, then append `-` + the code in its own case. Category slugs use the same cleaning without a code; on a clash the action appends `-2`, `-3`.
- `allocateOrderNumber`: `insert into order_number_counters (year, last_value) values ($1, 1) on conflict (year) do update set last_value = order_number_counters.last_value + 1 returning last_value`, then `formatOrderNumber`. The row lock queues concurrent orders; a rolled back order releases its number.

### Value sourcing

| Action | Value | Source |
|---|---|---|
| Place order (6, 13) | `order_number` | `allocateOrderNumber(tx, placed_at)` |
| Place order | `placed_at` | one `new Date()` taken by the action, inserted explicitly and passed to `allocateOrderNumber` |
| Place order | year in the number | `orderYear(placed_at)`, `Asia/Jerusalem` (AGENTS.md display zone) |
| Place order | `order_lines.sort` | position in the cart |
| Place order | `order_events.actor_user_id` | claims `sub`; null for a guest |
| Place order | `catalog_unit_price`, `unit_price` | `product_variants.price` read inside the transaction |
| Place order | `product_name`, `product_code`, `variant_code`, `size_label`, `colour_name` | `products`, `product_variants`, `colours` read inside the transaction |
| Place order | `quantity` | form input (cart in the browser) |
| Place order | `line_total` | `computeLineTotal(unit_price, quantity)` |
| Place order | `delivery_fee`, `delivery_zone_name` | `delivery_zones.fee`, `.name` for the chosen zone id (input); 0 and null for pickup |
| Place order | `subtotal`, `total` | `computeOrderTotals` |
| Place order | `discount_total` | 0 until feature 32 (sum of applied redemptions) |
| Place order | `customer_phone_e164` | `normalizePhone(customer_phone)` |
| Place order | `placed_by_user_id`, `placed_by_role` | `getClaims()` user id, `profiles.role`; null for a guest |
| Place order | `created` event `actor_kind` | `placed_by_role`, or `guest` |
| Change status (15) | `from_status`, `to_status` | the order's status before the update, the requested status (input) |
| Change status to `delivered` (15) | `delivered_at` | `now()` in that transaction |
| Cancel (17) | `cancelled_at`, `cancelled_by`, `cancel_reason` | `now()`; the actor kind of the caller (`customer`, `guest`, or `admin`); optional reason input |
| Product lists (9, 11, 25) | list price, out of stock state | lowest `product_variants.price` among sellable variants; none sellable → out of stock |
| Customer details (20) | email | join `auth.users.email` |
| Profile form (18) | `profiles.phone`, `phone_e164` | form input, `normalizePhone` |
| Adjust line price (23) | new totals | `recomputeOrderTotals`; old price from `order_lines.unit_price` before the update |
| Record payment (24) | `amount_paid` | sum of payment effects: `payment` +amount, `refund` −amount, `reversal` −(effect of the reversed row) |
| Coins (31) | `coin_balance` | sum of `coin_transactions.amount` for the user |
| Sign up (18) | `profiles.full_name` | sign up metadata `full_name` or Google `name` |
| Product create (7, 8) | `slug` | `buildProductSlug(name, code)` |
| Demo seed | demo rows | `scripts/seed-dev.ts`, fixed values with fixed codes (`DEMO-1` to `DEMO-3`) |

### Key invariants

- `orders.total = subtotal + delivery_fee - discount_total`, never below 0 (DB check).
- `order_lines.line_total = unit_price * quantity` (DB check); `catalog_unit_price` never changes after insert (app rule; no action updates it).
- After any change to lines, fee, discount, or returns, `subtotal` equals `computeOrderTotals` over the lines, recomputed in the same transaction (app rule, covered by a DB test).
- `amount_paid` and `coin_balance` change only in the same transaction that adds a ledger row.
- One default variant per product; unique (size, colour) per product; one `earned_order` coin row per order.
- Payments and coin transactions are never updated or deleted (trigger, added with their tables).
- Catalog rows referenced by an order line are never deleted (FK restrict).

### Security model

- The browser never queries the database. RLS on every `public` table with no policies; `revoke all on all tables, sequences, functions in schema public from anon, authenticated, public`; and `alter default privileges for role postgres in schema public revoke all on tables, sequences, functions from anon, authenticated, public`, so objects created later stay locked (Postgres grants `execute` on new functions to `PUBLIC` by default, which `anon` and `authenticated` inherit). `check-rls` tests with `has_table_privilege` and `has_function_privilege` for `anon` and `authenticated`, not grant rows, since those miss `PUBLIC`.
- Hyperdrive caches read queries made outside a transaction for about 60 seconds by default, which would show stale prices, stock, statuses, and lookups. Turn caching off on the Hyperdrive config (`caching.disabled: true`); see Follow-up.
- The server connects as `postgres` (skips RLS). Authorization lives in Server Actions: admin actions call `requireAdmin()`; My Orders filters by `placed_by_user_id = claims.sub` (19); drafts by `owner_user_id` (21); guest lookup needs both order number and `customer_phone_e164` (16).
- Personal data (names, phones, addresses) lives in `profiles`, `orders`, `drafts`. Never log it; `order_events.data` never stores it. Backups are encrypted (0001).
- Money tables are audit trails: price changes, payments, and coins each record who, when, and why, and are append only.

### Configuration required

No new environment variables. `scripts/seed-dev.ts` and the database tests use the existing `DATABASE_URL_DIRECT`.

### Critical test scenarios

- Happy path: in a DB test, seed one simple product, place one order through `allocateOrderNumber` and `recomputeOrderTotals` in one transaction; the order reads `YY-00001`, totals match, a `created` event exists, verifies **AC-1**, **AC-5**, **AC-7**.
- Snapshot: change the variant price and colour name after ordering; the line and order are unchanged, verifies **AC-5**.
- Price adjustment: update one line's `unit_price`, recompute; `catalog_unit_price` and the variant price are unchanged and totals agree; a direct update breaking `line_total` is rejected, verifies **AC-6**.
- Concurrency: 20 parallel transactions allocate 20 distinct consecutive numbers; `orderYear` for `2026-12-31T22:30:00Z` returns 2027, verifies **AC-7**.
- Constraint failures: duplicate (no size, no colour) variant, second default, price 0, delivery order with no address, pickup with a fee, deleting an ordered variant, all rejected, verifies **AC-4**, **AC-8**, **AC-9**.
- Unit: `normalizePhone`, `computeOrderTotals`, `formatOrderNumber`, `buildProductSlug` tables of cases, verifies **AC-6**, **AC-7**, **AC-10**.
- Auth/permission: `pnpm db:check-rls` passes; as `anon` and `authenticated`, `select` on any public table and `execute` on `handle_new_user()` fail with permission denied; a committed probe table `public.__rls_probe` without RLS makes the check fail (dropped in `finally`), verifies **AC-2**.
- Signup: insert an auth user; a `customer` profile appears with the name; a user inserted before the migration has a profile after it, verifies **AC-3**.

Testing note: this feature has no screen, so the Playwright bar does not apply; its paths are covered by the e2e flows of features 6 and 18. Database tests live beside the schema as `*.db.test.ts`, run by Vitest through `getDirectDb()` against the local Supabase database, and skip with a clear message when the URL is not local. They run one file at a time (`fileParallelism: false`). Tests that must commit (the order number and concurrency tests, the RLS probe) use their own far future year (for example 2091, 2092) and delete that year's counter row in `beforeEach`; every other DB test runs inside a transaction that rolls back.

## Build plan

Tracer Bullet: the thread is one order written correctly by the real database, so the rules come first, then the core schema, then the helpers that prove an order lands, then the support scripts.

1. Pure rules with Vitest tests: `computeLineTotal`, `computeOrderTotals`, `formatOrderNumber`, `orderYear`, `normalizePhone`, `buildProductSlug`, satisfies **AC-6**, **AC-7**, **AC-10**
2. Core Drizzle schema (`enums.ts`, `profiles.ts`, `catalog.ts`, `settings.ts`, `orders.ts`) with every check, unique, partial index, and `.enableRLS()`; generate the first migration, satisfies **AC-1**, **AC-4**, **AC-5**, **AC-8**, **AC-9**
3. Hand edited custom migration (`drizzle-kit generate --custom`): revoke privileges and default privileges `for role postgres` from `anon`, `authenticated`, and `public`; `handle_new_user()` trigger plus the profile backfill; the `product_media` composite FK with `on delete set null (variant_id)`; insert the two delivery zones and the settings row, satisfies **AC-2**, **AC-3**, **AC-9**, **AC-12**
4. `getDirectDb()` in `src/server/db/direct.ts`; `allocateOrderNumber` and `recomputeOrderTotals` server helpers; the DB test suite (happy path order, snapshot, price change, concurrency, constraint failures, named constraints present, signup trigger and backfill) with the isolation rules in the testing note, satisfies **AC-1**, **AC-3** to **AC-9**
5. `scripts/check-rls.ts` with `pnpm db:check-rls` (lists `public` tables without RLS and any table or function `anon` or `authenticated` can use, via `has_table_privilege` and `has_function_privilege`, exits non zero), satisfies **AC-2**
6. `scripts/seed-dev.ts` with `"db:seed": "tsx scripts/seed-dev.ts"` (add `tsx` as a dev dependency; local host and port 54322 only; upserts by code); leave `supabase/seed.sql` empty, because `supabase db reset` runs it before Drizzle migrations exist, satisfies **AC-12**
7. Review the *Coverage by feature* table against the scope; record any gap as a Follow-up, satisfies **AC-11**

Later tables are not built here; each feature in the coverage table adds its tables from this spec in its own migration.

## Consequences

**Positive**:
- Old orders never change when the catalog changes; one line's price can move with its original kept on record.
- Every later slice has its tables designed, so no breaking migration is needed.
- Money is append only with who, when, and why, which the GA features 23, 24, 34 rely on.
- Short readable order numbers that are safe under concurrent orders.

**Negative / tradeoffs**:
- Stored totals and the `amount_paid` and `coin_balance` caches can drift if an action forgets to recompute; every money action must use the shared helper inside its transaction, and DB tests guard it.
- One variant row per combination means a product with 5 sizes by 4 colours is 20 rows to fill in the spreadsheet (feature 8 should generate combinations).
- Category depth is enforced in the category Server Action, not the database.
- Once coins exist, an account cannot be hard deleted; removal means anonymizing the profile.
- Free text sizes make the size filter (11) group only exact matches.
- The order number counter is a single row per year; every order briefly locks it (no issue at this volume).
- Phone normalization rules are a guess until feature 13; changing them later needs a backfill.

**Neutral**:
- Order status transitions, cancellation cut off, report math, coin rules, and return rules stay with features 15, 17, 27, 31 to 34; this model only gives them columns.
- `supabase/seed.sql` stays empty; demo data comes from `pnpm db:seed`.
- Enum values added later need their own migration before use.

## Follow-up

- [ ] Turn off Hyperdrive query caching (`caching.disabled: true`, or `wrangler hyperdrive update <id> --caching-disabled`) for every environment, and add the setting to spec 0001's *DB connection from Workers* row and the production runbook. Do this before feature 6 ships.
- [ ] With `profiles` in place, write `scripts/admin-promote.ts` (`pnpm admin:promote <email>`) from 0001 if the scaffold has not yet.
- [ ] Feature 2 (`/audit`, CI): run `pnpm db:check-rls` and the `*.db.test.ts` suite in CI against a migrated database.
- [ ] Feature 8: the import template should generate size by colour combinations rather than ask for one row per variant by hand.
- [ ] Feature 13: confirm the `normalizePhone` rules and whether `area` is required.
- [ ] Consider removing `public` from the Supabase Data API exposed schemas as a third lock, since nothing uses it (optional; grants and RLS already block it).
