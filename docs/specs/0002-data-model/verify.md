# Verify: Data model · spec 0002 · updated 2026-10-18

_Steps derived from spec 0002 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run these against the local database (`pnpm db:start`, then `pnpm db:migrate`). Steps that use `psql` run it inside the database container: `docker exec supabase_db_skf-pro psql -U postgres -c "..."`.

## Commands

- [x] `pnpm db:migrate` on a fresh database (`supabase db reset`, then migrate), then `pnpm db:generate` → "No schema changes"; `pnpm exec drizzle-kit check` → "Everything's fine" → AC-1
- [x] `pnpm exec vitest run src/server/db src/features/orders` → every `*.db.test.ts` runs (none skipped) and passes → AC-1, AC-3 to AC-9
- [x] `pnpm db:check-rls` → "RLS check passed", exit 0 → AC-2
- [x] Create `public.__rls_probe (id int)`, run `pnpm db:check-rls` → lists `rls_disabled __rls_probe`, exit 1; drop the table → AC-2
- [x] As `postgres`, create a throwaway function in `public`; `has_function_privilege('anon', ...)` → false (the default privilege fix in migration 0002); drop it → AC-2
- [x] `pnpm db:seed` twice → same counts both times: 2 categories, 3 colours, 3 products, 10 variants → AC-12
- [x] `DATABASE_URL_DIRECT=postgresql://postgres:x@db.example.com:5432/postgres pnpm db:seed` → "Refusing to seed", exit 1 → AC-12
- [x] `select name, fee from delivery_zones; select * from shop_settings;` → the two zones (2000, 7000) and one `S.K.F Lighting` row → AC-12
- [x] `pnpm exec vitest run src/lib/phone.test.ts src/features` → the pure rule tables pass → AC-6, AC-7, AC-10

## Database behavior (manual)

- [x] Sign up a user in local Studio (Auth → Add user) with metadata `{"full_name":"تجربة"}` → a `profiles` row with role `customer` and that name → AC-3
- [x] Insert a second variant with no size and no colour for `DEMO-1` → rejected by `product_variants_options_unique` → AC-4
- [x] Set `is_default = true` on a second `DEMO-2` variant → rejected by `product_variants_one_default_idx` → AC-4
- [x] Place a test order for `DEMO-2-60`, then change that variant's price and the product name → the line still shows the old name and price → AC-5
- [x] Update one line's `unit_price` without `line_total` → rejected by `order_lines_line_total_check`; update both and recompute → `catalog_unit_price` unchanged → AC-6
- [x] Insert a delivery order with no address → rejected by `orders_delivery_check`; a pickup order with `delivery_fee = 2000` → rejected by `orders_pickup_check` → AC-8
- [x] Delete a variant that an order line uses → rejected by `order_lines_variant_product_fk` → AC-9

## Value sourcing

- [x] `order_number`: allocate for `placed_at = 2026-12-31T22:30:00Z` → number starts `27-` (year in Asia/Jerusalem, not UTC) → AC-7
- [x] `order_number` under load: 20 parallel allocations → 20 distinct consecutive numbers (covered in `orders.db.test.ts`) → AC-7
- [x] `catalog_unit_price`, `unit_price`: read from `product_variants.price` inside the order transaction → change the price after ordering, the line keeps the old value → AC-5
- [x] `product_name`, `product_code`, `variant_code`, `size_label`, `colour_name`: copied at placement → rename the colour after ordering, the line keeps the old name → AC-5
- [x] `line_total`: `computeLineTotal(unit_price, quantity)` → the DB check rejects any other value → AC-6
- [x] `subtotal`, `total`: `recomputeOrderTotals` after a line change → equals `computeOrderTotals` over the stored lines → AC-6
- [x] `delivery_fee`, `delivery_zone_name`: from the chosen zone; 0 and null for pickup → the pickup check rejects a fee → AC-8
- [x] `customer_phone_e164`: `normalizePhone(customer_phone)` → `0599 123 456`, `+970599123456`, `00970599123456` give one value; a landline gives `null` → AC-10
- [x] `profiles.full_name`: sign up `full_name`, else Google `name` → a user with only `name` gets that name → AC-3
- [x] Product `slug`: `buildProductSlug(name, code)` → seeded slugs read like `ثريا-كريستال-دائرية-DEMO-2` → AC-12
- [x] Demo rows: `scripts/seed-dev.ts` fixed codes `DEMO-1` to `DEMO-3` → no duplicates after a second run → AC-12

## Review

- [x] Compare *Coverage by feature* with features 7 to 34 in `docs/scope/` → every feature maps to existing columns or to later tables that only add → AC-11

## Acceptance-criteria coverage

- AC-1 … migrate, generate, check, and the `migrated shape` DB tests
- AC-2 … `db:check-rls` (clean and with a probe), the function privilege step, `rls-check.db.test.ts`
- AC-3 … Studio sign up, `profiles from auth users` DB tests, `full_name` value step
- AC-4 … duplicate and second default variant steps, `variants` DB tests
- AC-5 … snapshot steps and value steps for copied fields
- AC-6 … line price steps, `line_total` and totals value steps, `totals.test.ts`
- AC-7 … order number value steps, `order-number.test.ts`, `order numbers` DB tests
- AC-8 … delivery and pickup steps, `fulfilment rules` DB tests
- AC-9 … delete ordered variant step, `references from orders` DB tests
- AC-10 … `phone.test.ts`, phone value step
- AC-11 … coverage review
- AC-12 … seed steps, settings and zones step, slug value step
