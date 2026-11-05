# Review, feat/data-model, 2026-10-18

**Reviewed by**: Sonnet 5.5 (author model not stated)
**Scope**: 43 files, branch vs da7a0f4
**Verdict**: Approve with nits

## Summary
Adds the core Drizzle schema and three migrations (lockdown, signup trigger, backfill, seed rows, global execute revoke), pure money/order-number/phone/slug rules, server helpers for order numbers and totals, an RLS checker, a local-only dev seed, and DB tests. The work follows AGENTS.md and spec 0002 closely: RLS everywhere, no browser grants (checked with `has_*_privilege`, so PUBLIC inheritance is caught), integer agorot, timestamptz, server-only boundaries, fail-closed local-URL guard. No blockers or majors found; the issues below are edge cases and test-rigor gaps.

## Minor
### 🟡 Same mobile number can normalize to two values, `src/lib/phone.ts:15`
**Problem**: `+972599123456` (Palestinian 059 number dialed with the Israeli code, very common) normalizes to `+972599...`, while `0599123456` becomes `+970599...`. The prefix split only applies to the local form.
**Why it matters**: guest order lookup (order number + `customer_phone_e164`) and profile matching miss when the same person types it differently, contradicting the "however typed" intent. The spec text allows it, so this is a spec gap more than a code bug.
**Suggested fix**: decide in feature 13 whether 059/056 national numbers always map to +970 regardless of the typed country code; if so, canonicalize in the international branch too and add a test case.

### 🟡 Recompute throws on a negative total, `src/features/orders/totals.ts:50` (used at `src/features/orders/server/totals.ts:25`)
**Problem**: when a line price adjustment pushes `subtotal + fee` below `discount_total`, `computeOrderTotals` throws `RangeError`. AGENTS.md says expected failures return a typed result and only bugs throw.
**Why it matters**: the admin price-change action (feature 23) would surface a 500 for a plausible owner input unless it pre-validates.
**Suggested fix**: either return a typed result from the pure function, or document that actions must clamp/validate discount first and add a test at the action level.

### 🟡 Backfill differs from the trigger, `drizzle/0001_lockdown_and_seed.sql:285`
**Problem**: the trigger uses `nullif(btrim(...), '')`; the backfill uses bare `coalesce(...)`, so blank or padded names are copied as `''` or with spaces, and a blank `full_name` never falls back to `name`. The test pins the backfill text verbatim, so it locks in the difference.
**Why it matters**: inconsistent profile data for pre-existing users (low impact, runs once).
**Suggested fix**: reuse the trigger's expression (migrations only add, so fix forward if already applied anywhere).

### 🟡 AC-1 "no newer schema change" test is weaker than its name, `src/server/db/schema/schema.db.test.ts:163`
**Problem**: it only compares journal tags to `.sql` filenames. It does not detect Drizzle schema drift (what `db:generate` would produce).
**Why it matters**: AC-1 depends on a manual verify step; drift between schema files and migrations would pass this test.
**Suggested fix**: rename to what it checks, or run `drizzle-kit generate --check`/`check` in CI.

### 🟡 Slug drops Arabic-Indic digits, `src/features/catalog/slug.ts:5`
**Problem**: U+0660-0669 are Script=Common, so `\p{Script=Arabic}` rejects them and they become `-` (the seed product "لمبة LED ٩ واط" loses the 9).
**Why it matters**: lost information and possible slug clashes between products differing only in an Arabic digit; the code suffix prevents hard collisions for products.
**Suggested fix**: also keep `\p{Nd}` digits (or map them to ASCII) and add a test.

### 🟡 Test helper lives in the production source tree, `src/server/db/testing.ts:4`
**Problem**: it imports `vitest` and runs `process.loadEnvFile` at module load, inside `src/server/db/`, next to code that is bundled for Workers.
**Why it matters**: nothing imports it from app code today, but an accidental import would break the build or leak test setup.
**Suggested fix**: move to a test-only location (or add an eslint no-restricted-imports guard).

### 🟡 Seed re-run does not refresh variant options, `scripts/seed-dev.ts:144`
**Problem**: the variant upsert updates only `price` and `sort`; size, colour, default, and `updated_at` (`excluded` upserts bypass `$onUpdate`) are not refreshed. Idempotent for counts, stale after editing the demo data.
**Suggested fix**: include the remaining columns in `set`.

## Nits
- ⚪ `drizzle/0002_revoke_function_execute_globally.sql:5`, global default-privilege revoke also affects future functions `postgres` creates in other schemas (extensions); documented, just keep in mind for features adding extensions.
- ⚪ `src/features/orders/server/orders.db.test.ts:33`, `ROLLBACK_YEAR` is used by rolled-back tests that never need a special year; name suggests a different role than it plays.
- ⚪ `drizzle/0000_core_schema.sql:148`, `order_events` is described as append-only elsewhere but carries `updated_at` (only `seen_at` changes).

## Strengths
- RLS check uses `has_table/sequence/function_privilege`, so PUBLIC-inherited access is caught, and a probe-table test proves it fails when it should; migration 0002 closes the PUBLIC default-execute gap with an explained fix.
- Database invariants (order total, line total, fulfilment, one default variant, composite variant/product FKs, restrict deletes) enforced in the schema with named constraints and matching tests; order-number allocation is race-safe and tested with 20 parallel transactions and the Jerusalem year boundary.
- Seed refuses non-local URLs; `server-only` and `getDb`-per-request rules respected; pure rules are small, strict, and table-tested.

## Test coverage
Pure rules (totals, order number, phone, slug, local URL guard) have thorough unit tables including error paths. DB tests cover AC-1 through AC-9 (shape, constraints, trigger, backfill, snapshot, concurrency, RLS) but skip silently without a local database and are not yet in CI (spec Follow-up). Untested: `scripts/seed-dev.ts` idempotency (manual verify step only), `scripts/check-rls.ts` exit codes, and negative-total handling at the action level.
