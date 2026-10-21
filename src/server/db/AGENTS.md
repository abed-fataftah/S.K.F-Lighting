# Database (Drizzle over Hyperdrive)

## Overview

The Drizzle schema, the per request client, and the helpers that scripts and database tests use. The app reads and writes Postgres only through `getDb()`; Supabase owns the `auth` schema and Drizzle only mirrors a stub of it.

## Key files

| File | Owns |
|---|---|
| `index.ts` | `getDb()`: one client per request from the Hyperdrive binding (`max: 1`, `prepare: false`) |
| `direct.ts` | `getDirectDb()` over `DATABASE_URL_DIRECT`, for scripts and `*.db.test.ts` only, never the app |
| `local.ts` | `isLocalDatabaseUrl()`: true only for `127.0.0.1`/`localhost` port `54322` |
| `testing.ts` | Shared setup for database tests: `hasLocalDb`, `withRollback()`, seed row helpers |
| `time-limit.ts` | `withTimeLimit(read, ms)`: a read the page can live without, returned as a `Result` (`timeout` or `failed`) so the page shows a fallback instead of a 500 |
| `rls-check.ts` | The logic behind `pnpm db:check-rls` (RLS on, no privileges for `anon`/`authenticated`) |
| `schema/public.ts` | Barrel of the migrated `public` tables; `drizzle.config.ts` reads this one |
| `schema/index.ts` | Barrel the app queries: `public.ts` plus the `auth.users` stub |
| `schema/columns.ts` | `id()`, `createdAt()`, `updatedAt()`, `timestamps()` column helpers |

## Commands

```bash
pnpm db:start && pnpm db:migrate   # local Supabase, then apply drizzle/*.sql
pnpm db:seed                       # dev seed, local database only
pnpm db:check-rls                  # fails on any public table without RLS or with grants
```

## Conventions

- New tables go in their own file under `schema/` and are exported from `schema/public.ts`, never from `schema/index.ts` directly.
- Use the helpers in `schema/columns.ts` for ids and timestamps. `updated_at` is set by Drizzle on update, so every write goes through Drizzle.
- A new migration needs RLS enabled on each new table; `pnpm db:check-rls` and the schema tests prove it.
- Database tests are named `*.db.test.ts`, import from `testing.ts`, and wrap their work in `withRollback()` unless a test truly must commit.

## Gotchas

- `drizzle-kit generate` ignores `schemaFilter`; pointing it at `schema/index.ts` would try to create `auth.users`. Keep the config on `schema/public.ts`.
- `getDb()` needs the Workers request context. Scripts and tests use `getDirectDb()` and close it with `await db.$client.end()`.
- Database suites skip themselves (with a warning) unless `DATABASE_URL_DIRECT` is the local Supabase database, so they never touch production and do not run in CI today.
- Vitest runs files one at a time (`fileParallelism: false`) because the database suites share one local database.
- Hyperdrive means no session features: no `LISTEN`, no session advisory locks. Transactions are fine.

## Agent skills

- [supabase](../../../.agents/skills/supabase/), [supabase-postgres-best-practices](../../../.agents/skills/supabase-postgres-best-practices/): `supabase/agent-skills`, schema, RLS, migrations

## Related specs

- [0001 Stack architecture](../../../docs/specs/0001-stack-architecture/index.md)
- [0002 Data model](../../../docs/specs/0002-data-model/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
