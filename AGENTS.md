<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# S.K.F Lighting shop (skf-pro)

## Stack

- **Language / Runtime**: TypeScript (strict), Node 24 LTS locally and in CI; production runs on Cloudflare Workers (`nodejs_compat`)
- **Framework**: Next.js 16.4 App Router via `@opennextjs/cloudflare`; Arabic storefront at `/`, owner dashboard at `/admin`, one app
- **Key dependencies**: Supabase Pro (Postgres 17, Auth via `@supabase/ssr`, Storage) · Drizzle ORM over Hyperdrive (`postgres` driver) · next-intl (single locale `ar`, RTL) · Tailwind CSS v4 + shadcn/ui · Zod + react-hook-form
- **Package manager**: pnpm
- Full decision and settings table: [docs/specs/0001-stack-architecture/index.md](docs/specs/0001-stack-architecture/index.md)

## Build approach

**Tracer Bullet**: prove one real order travels the whole system first, then thicken each part end to end.

## Commands

```bash
pnpm install                 # Install
pnpm db:start                # Local Supabase (Docker), then: pnpm db:migrate
pnpm dev                     # Dev server
pnpm preview                 # Build and run on workerd (the real Workers runtime)
pnpm lint && pnpm typecheck  # Lint, typecheck
pnpm exec vitest run         # Unit tests (src/**/*.test.ts)
pnpm exec playwright test    # E2E tests (e2e/*.spec.ts)
pnpm db:generate             # New Drizzle migration into drizzle/
cp .env.example .env.local   # for next dev and drizzle-kit; .dev.vars.example → .dev.vars for pnpm preview
pnpm cf-typegen              # after editing wrangler.jsonc bindings
E2E_TARGET=preview pnpm exec playwright test   # E2E on workerd, as CI does
```

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title/index.md`. Scope lives in `docs/scope/`, runbooks in `docs/runbooks/`.

## Rules

- **Functional style**: pure functions by default, immutable data (`const`, `readonly`), no shared mutable state; side effects (DB, Supabase, network) stay at the edges in `server/` modules. Money, totals, fees, and balances are pure and unit tested without mocks. Prefer plain functions over classes.
- **Layout**: group by feature, `src/features/<area>/` with `components/`, `server/`, `schemas.ts`; shared server code in `src/server/` (`db/`, `auth/`); shadcn base components in `src/components/ui/`.
- **Server boundary**: anything touching the database or a secret lives in a `server/` folder and imports `server-only`. The browser never queries the database.
- **Database**: create the Drizzle client per request with `getDb()`, never at module level. RLS on every `public` table, no grants to `anon`/`authenticated`. Migrations only add; fix forward. Money is integer agorot, timestamps `timestamptz` in UTC, shown in `Asia/Jerusalem`.
- **Auth**: `getClaims()` for reads; `getUser()` before admin writes and money changes. `requireAdmin()` (role `admin` + `aal2`) runs inside **every** admin Server Action and route handler, not only the layout.
- **Errors**: Server Actions return a typed result (`{ ok: true, data } | { ok: false, error }`) for expected failures; throw only for bugs. Validate all input with the shared Zod schema on the server too.
- **Env**: parse every env var and secret with Zod once at startup and fail fast; read config only through that module. Never log customer phone or address.
- **UI**: Arabic only, RTL; logical CSS properties only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `left`/`right`. All strings in `src/i18n/messages/ar.json`. WCAG AA on every screen (labels, focus, contrast, keyboard).
- **Tests**: every feature ships Vitest unit tests beside the source for all logic, plus Playwright flows on a phone sized RTL screen for each user facing path. Bar: unit + e2e before done.
- **Commits**: Conventional Commits, e.g. `feat(cart): add quantity stepper`.
- **Supabase client**: auth (and Storage uploads) only, never data; all data goes through Drizzle `getDb()`. Read the user with the helpers in `src/server/auth/session.ts` (`getClaims()`, `getVerifiedUser()`).
- **Proxy**: Next 16 middleware is `src/proxy.ts` (next-intl routing, then Supabase session refresh); `/admin` and `/auth` sit outside locale routing.
- **Windows**: keep `node-linker=hoisted` in `.npmrc`; OpenNext cannot read pnpm's symlinked layout.

## Tooling

Chosen in feature 2; `/develop tooling` installs what is not there yet.
- Lint + format: ESLint (`eslint-config-next`, installed) + Prettier with `prettier-plugin-tailwindcss` (to add).
- Pre commit: lint and format staged files, plus a full typecheck, on every commit (to add).
- CI: GitHub Actions on each push: typecheck, lint, Vitest, build, Playwright against the Workers preview, RLS check; on `main` migrate then deploy (to add).

## Git

- integration: on
- branch prefix: feat/
- commit: per-milestone

## Agent skills

- [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React and Next.js performance patterns
- [vercel-composition-patterns](.agents/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, component composition
- [cloudflare](.agents/skills/cloudflare/), [wrangler](.agents/skills/wrangler/), [workers-best-practices](.agents/skills/workers-best-practices/): `cloudflare/skills`, Workers runtime, Wrangler config, deploys
- [nextjs-on-cloudflare](.agents/skills/nextjs-on-cloudflare/): `cloudflare/skills`, Next.js on Workers (this project uses OpenNext, not vinext)
- [shadcn](.agents/skills/shadcn/): `shadcn-ui/ui`, adding and styling UI components
- [supabase](.agents/skills/supabase/), [supabase-postgres-best-practices](.agents/skills/supabase-postgres-best-practices/): `supabase/agent-skills`, Auth, Storage, schema, RLS, migrations
- [playwright-cli](.agents/skills/playwright-cli/): `microsoft/playwright-cli`, browser flows and e2e tests

MCP servers: supabase (recommended), playwright (recommended), context7 (recommended)

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
