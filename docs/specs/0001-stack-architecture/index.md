# 0001. Stack and architecture for the S.K.F Lighting shop

**Date**: 2026-10-16
**Status**: In Progress
**Amended**: 2026-10-17. The shop is Arabic only (no English site at `/en`, no language switch). The Languages, Architecture pattern, and Framework rows and the code layout reflect this.

## Summary

The shop is one Next.js 16 app (storefront plus owner dashboard in the same codebase) written in TypeScript, running on Cloudflare Workers, with Supabase Pro providing the Postgres database, sign in, and photo and video storage. Server code talks to the database through Drizzle (a typed query layer), so all money and order rules live in TypeScript you can read and test. This keeps the monthly bill near $30, gives daily backups from day one, and uses tools AI coding agents know well. Every later feature builds on this foundation; the scaffold that sets it up is the next build step.

## Decision

**Chosen option**: Option 1: Next.js monolith on Cloudflare Workers with Supabase Pro and Drizzle

One full stack Next.js 16 app, deployed to Cloudflare Workers through the OpenNext adapter, backed by Supabase Pro (Postgres, Auth, Storage, image transformations), with all database access in server only TypeScript through Drizzle ORM over Cloudflare Hyperdrive.

**Implementation skills**: `vercel-react-best-practices`, `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/`) · `wrangler`, `workers-best-practices`, `cloudflare` (`cloudflare/skills`, `.agents/skills/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `supabase`, `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/`) · `resend`, `email-best-practices` (`resend/resend-skills`, `.agents/skills/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

Note: the installed `nextjs-on-cloudflare` skill recommends vinext for new projects. This project deliberately uses OpenNext (real Next.js build); follow that skill only where it applies to OpenNext.

## Rationale

Reasoning, options, and the landscape check: see [rationale.md](rationale.md).

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Architecture pattern | One monolith: Arabic storefront at `/`, dashboard at `/admin`, same app | Solo builder, small shop scale; one codebase, one deploy, one data layer. |
| Language | TypeScript (strict), Node 24 LTS for local dev, builds, and CI | One language end to end; Node 24 is the active LTS line. |
| Package manager | pnpm | Fast, strict dependency resolution, standard with Next.js. |
| Framework | Next.js 16 App Router, pinned to 16.4.1 or later | Server rendering for Arabic SEO, Server Actions for forms, the engineer knows React. 16.4.1 carries the 14 Oct 2026 image optimization security fix. |
| Rendering | Server rendered on each request at launch (dynamic); no ISR (incremental static regeneration) and no shared page caching yet | Product edits show "right away" (feature 7), and cart and sign in cookies make shared caching risky. Add OpenNext's R2 incremental cache plus tag revalidation only if a speed problem is measured. |
| Primary DB | Supabase Postgres 17 (Pro plan, `eu-central-1` Frankfurt region) | Relational data with money and balances needs ACID (all or nothing writes) and constraints. Pro means no pausing and daily backups kept 7 days. Frankfurt is the closest major region to the shop. |
| DB connection from Workers | Cloudflare Hyperdrive (connection pooling and setup caching, included in Workers Paid) pointed at Supabase's session pooler; `postgres` (postgres.js) driver | Workers cannot keep connections between requests; Hyperdrive removes the slow connection handshake on every request. Fallback: Supabase's transaction pooler (port 6543) directly, with `prepare: false`. |
| DB client lifecycle | A `getDb()` factory creates the Drizzle client for each request from the Hyperdrive binding (`max: 1`, `prepare: false`); never a module level client | A client shared across requests fails on Workers ("cannot perform I/O on behalf of a different request"). Transactions (`db.transaction`) are fine; no session features (`LISTEN`, session advisory locks, `SET` outside a transaction). |
| Data access | Drizzle ORM, only inside `server-only` modules under `src/server/` and feature `server/` folders | Typed SQL that runs well on Workers. Money, balances, and price adjustments stay in testable TypeScript. Complex reports use plain SQL through Drizzle's `sql` helper. |
| Migrations | Drizzle Kit owns the `public` schema: schema in TypeScript, `schemaFilter: ['public']`, generated SQL committed in `drizzle/`, applied by `pnpm db:migrate`. `auth.users` is referenced through a `pgSchema('auth')` stub, never migrated | One source of truth for app tables. Supabase owns `auth` and `storage`. See *Migrations and environments* below. |
| Database lockdown | Server connects as the Supabase `postgres` role (has BYPASSRLS, the right to skip row rules). Row Level Security (RLS) enabled on every `public` table with no policies; `anon` and `authenticated` roles have their grants on `public` revoked, including default privileges for future tables. A CI check fails if any `public` table lacks RLS | The browser never queries the database. Two locks (no grants, RLS on) mean one forgotten setting does not leak data. |
| Auth | Supabase Auth with `@supabase/ssr` cookie sessions. Accounts: email + password or Google sign in. Guests: no account | Built into the platform already paid for; 50k monthly users on any plan. Guests order with name + phone and look up orders with order number + phone (features 13, 16). |
| Proxy and sessions | One Next.js `proxy.ts` (the Next 16 name for middleware) that runs next-intl locale routing for storefront paths, then refreshes the Supabase session cookie. Matcher skips `_next`, static files, and images; `/admin` and `/auth` are outside locale routing | Both libraries need the proxy, so they are composed in one place. If the scaffold gate falls back to Next 15.5, the file is `middleware.ts` with the same logic. |
| Reading the user | `supabase.auth.getClaims()` (verifies the sign in token locally) for normal pages and reads; `supabase.auth.getUser()` (a call to Supabase) before admin writes and money changes | Saves a network round trip on most pages while keeping the strongest check where it matters. |
| Roles | `role` column (`customer` · `electrician` · `admin`) on a `profiles` table keyed by the Supabase user id, read once per request (React `cache()`). A trigger on `auth.users` creates the profile with role `customer` (`SECURITY DEFINER`, `search_path = ''`, written as a hand edited Drizzle migration) | A role change applies on the user's next page load (feature 20). |
| Admin protection | Admin signs in with email + password only (no Google), then an authenticator app code (Supabase MFA, TOTP). `requireAdmin()` checks `role = admin` and the token's `aal` claim equals `aal2`; it runs in the `/admin` layout **and inside every admin Server Action and route handler** | Server Actions are public POST endpoints, so a layout guard alone protects nothing. The admin sees every customer phone, address, and payment. |
| Password recovery | Email reset link from Supabase Auth, landing on `/auth/confirm` | Email is required for an account, so a reset link always has somewhere to go. |
| Email delivery | Resend as Supabase Auth's custom SMTP, sending from the shop's own domain. Raise Supabase's auth email rate limit after enabling custom SMTP (it starts low) | Free 3,000 per month, 100 per day, enough for resets. Supabase's built in mailer is rate limited and not for production. |
| File storage | Supabase Storage, public bucket `product-media`, declared in `supabase/config.toml`: file size limit 50 MB, allowed types `image/jpeg`, `image/png`, `image/webp`, `video/mp4`. Photos capped at 10 MB in the upload form. Object keys `products/{productId}/{uuid}.{ext}` | Same service as DB and auth, one admin upload flow. |
| Uploads | The admin's browser uploads straight to Storage using a signed upload URL created by an admin only Server Action (`requireAdmin()`, service role key) | Files never pass through the Worker, so its request size limit never matters. |
| Image delivery | Supabase image transformations through a custom `next/image` loader (`images.loader: 'custom'`) that builds `/storage/v1/render/image/public/product-media/...?width=&quality=` URLs. Next's own image optimizer is off; files in `/public` (logo, icons) use plain `<img>` or `unoptimized` | No image work runs on the Worker (also sidesteps the October image optimizer advisory). Videos are served as is from Storage. |
| Styling and components | Tailwind CSS v4 + shadcn/ui (Radix based), using logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) only | Right to left Arabic works without mirrored CSS. The look itself is decided in feature 4. |
| Languages | Arabic only. next-intl with a single locale `ar` served at `/` (no prefix; `/ar` redirects to `/`). No English site, no language switch, no locale cookie, no browser language detection. `<html lang="ar" dir="rtl">` | Clean Arabic URLs. Keeping next-intl puts every interface string in one messages file, so English could be added later as a config change. Digit style and Arabic text rules are decided in feature 5. |
| Forms and validation | Zod schemas shared by react-hook-form (`@hookform/resolvers/zod`) in the browser and the Server Action on the server | Instant messages in the customer's language, and the server never trusts the browser. |
| Dates and time | Store every timestamp as `timestamptz` in UTC; display in `Asia/Jerusalem` | One rule for order dates, reports, and payment dates. |
| Background work | None at launch. Scheduled jobs run as GitHub Actions cron workflows | No feature needs a queue yet. The database is the queue if one appears. |
| Backups | Supabase Pro daily backups (7 days) + a weekly GitHub Actions job: `pg_dump` with the Postgres 17 client over the session pooler, encrypted with `age` (public key in the repo, private key kept offline by the owner), uploaded to a private Cloudflare R2 bucket, keeping 12 weekly copies. A monthly keepalive commit or `workflow_dispatch` keeps the schedule alive (GitHub pauses cron after 60 days without repo activity) | Covers mistakes noticed after 7 days and account level loss. Dumps hold customer phones and addresses, so they are encrypted. A restore is rehearsed in feature 30. |
| Search | Postgres built in search first (decided in feature 11) | No separate search engine until Postgres cannot meet the need. |
| Observability | Cloudflare Workers Logs with structured `console` logs (JSON, never customer phone or address) at launch. Error tracking and visitor analytics tools are chosen in feature 29 | Logs from day one; the dedicated tools have their own spec. |
| Hosting | Cloudflare Workers via `@opennextjs/cloudflare`, Workers Paid plan ($5/mo), `nodejs_compat` flag, placement hint `aws:eu-central-1` in `wrangler.jsonc` (so the Worker runs next to the database). DNS on Cloudflare; the bare domain is primary and `www` redirects to it | Allows commercial use within the budget. The paid plan is needed for Next.js server rendering CPU time and bundle size. OpenNext over vinext (Cloudflare's newer default) because it runs the real Next.js build, so next-intl, Supabase SSR, and Next docs apply unchanged, and moving to Vercel stays a config change. |
| Repo and CI | Private GitHub repo. GitHub Actions on each push: type check, lint, Vitest, build, Playwright against the Workers preview, RLS check. On `main`: apply migrations to production, then deploy | Free at this size; runs the backup job too. Lint and format tools are chosen in feature 2. |
| Testing | Vitest for logic (totals, fees, balances), Playwright for phone sized browser flows in Arabic right to left, run against `opennextjs-cloudflare preview` (the real Workers runtime) in CI | The Beta tier runs `/test` after each feature; testing on workerd catches bugs that only happen on Workers. |

### Code layout

```
src/
  app/
    [locale]/            storefront routes (Arabic only, served at /)
    admin/               dashboard routes (admin only, aal2); admin/login and admin/mfa sit outside the guard
    auth/callback/       Google sign in return (PKCE code exchange)
    auth/confirm/        password reset and email links (token_hash)
  features/
    <area>/              catalog, orders, cart, accounts, payments, ...
      components/        UI for that area
      server/            queries and Server Actions (import "server-only")
      schemas.ts         Zod schemas shared by form and server
  server/
    db/                  getDb() factory and Drizzle schema
    auth/                Supabase server client, getClaims/getUser helpers, requireRole, requireAdmin
  components/ui/         shadcn base components
  i18n/                  next-intl config and messages (ar.json)
  proxy.ts               next-intl + Supabase session refresh
drizzle/                 generated SQL migrations (public schema)
supabase/
  config.toml            local stack settings: auth, redirect URLs, product-media bucket
  seed.sql               local seed data only
scripts/
  admin-promote.ts       pnpm admin:promote <email>
  admin-mfa-reset.ts     removes a lost MFA factor (service role), see runbook
  check-rls.ts           CI: fails if a public table lacks RLS
open-next.config.ts
wrangler.jsonc           name, compatibility date, nodejs_compat, placement, Hyperdrive binding
```

Rule: anything that touches the database or a secret lives in a `server/` folder and imports `server-only`, so a browser bundle can never include it.

### Admin bootstrap and recovery

- The first admin signs up like anyone (becomes `customer`), then the owner runs `pnpm admin:promote <email>` against production.
- On first `/admin` visit without MFA, the admin is sent to `/admin/mfa` to enroll an authenticator app. Enroll **two** devices (for example phone and tablet), since Supabase has no backup codes.
- Lost both devices: run `pnpm admin:mfa-reset <email>` (service role) from a trusted machine, then enroll again. This runbook lives in `docs/runbooks/admin-mfa.md` (written during the scaffold).

### Auth redirects

- Supabase Site URL: the production domain.
- Allowed redirect URLs: `http://localhost:3000/**`, the production domain, and the Workers preview URL pattern.
- Google OAuth callback: Supabase's callback URL, then `/auth/callback`. Google does not accept wildcard URLs, so **Google sign in works on production and localhost only, not on preview deploys**; previews test email sign in.

### Migrations and environments

- **Local**: `supabase start` (Docker) runs Postgres, Auth, and Storage from `supabase/config.toml`; then `pnpm db:migrate` applies Drizzle migrations. Day to day dev uses `next dev` with `initOpenNextCloudflareForDev()`; `pnpm preview` runs the app on workerd before pushing.
- **Preview deploys**: each branch uploads a Worker version with a preview URL, pointed at the free Supabase dev project. That project is migrated from `main` only; a branch with schema changes is tested locally first.
- **Production**: on `main`, CI runs `pnpm db:migrate` over the session pooler, then deploys. Migrations only add (new columns nullable or defaulted, removals done later in a separate migration), so the running code never breaks mid deploy. Mistakes are fixed forward with a new migration, not rolled back.
- Supabase settings for production (auth providers, SMTP, bucket) are applied in the dashboard to match `supabase/config.toml`, and that list is kept in the runbook.

### Settings and where they live

| Setting | Purpose | Local | Preview / production Worker | CI |
|---|---|---|---|---|
| Hyperdrive binding `HYPERDRIVE` | Database access for the app | `wrangler.jsonc` local connection string to `supabase start` | Hyperdrive config per environment | none |
| `DATABASE_URL_DIRECT` | Migrations, `pg_dump`, scripts. Session pooler URL (port 5432 on the pooler host), because the direct DB address is IPv6 only and GitHub runners are IPv4 | `.env.local` | none | secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `.env.local` | build variable per environment | build variable per environment |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key used by `@supabase/ssr` for auth only | `.env.local` | build variable per environment | build variable per environment |
| `NEXT_PUBLIC_SITE_URL` | Canonical site address (auth redirects, SEO) | `.env.local` | build variable per environment | build variable per environment |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Shop WhatsApp number for order links, until feature 26 moves it to dashboard settings | `.env.local` | build variable per environment | build variable per environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Signed upload URLs, admin scripts | `.dev.vars` | Worker secret (`wrangler secret put`) | secret (scripts only) |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Deploys | none | none | secret |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `BACKUP_AGE_PUBLIC_KEY` | Weekly encrypted backup | none | none | secret |
| Google OAuth client id and secret, Resend SMTP credentials | Sign in, email | `supabase/config.toml` env substitution | Supabase dashboard | none |

`NEXT_PUBLIC_*` values are written into the build, so each environment gets its own build. Server code reads Worker secrets through `process.env` (enabled by `nodejs_compat`).

### Monthly cost at launch

| Item | Cost |
|---|---|
| Supabase Pro | $25 |
| Cloudflare Workers Paid (includes Hyperdrive) | $5 |
| Resend, R2 backups, GitHub, Supabase dev project | $0 (free tiers) |
| **Total** | **about $30**, plus Supabase image transformation or video egress overage if the catalog passes the included quotas (see Follow-up) |

## Consequences

**Positive**:
- One codebase, one language, one deploy: the simplest thing a solo builder with AI agents can run.
- Daily backups, no pausing, and an encrypted off site weekly copy from launch day.
- Money and order logic is plain TypeScript, so it can be unit tested (important for the GA features 23, 24, 34).
- Sign in, MFA, Google, and storage come from the platform already paid for; no extra auth vendor.

**Negative / tradeoffs**:
- Cloudflare plus OpenNext is less smooth than Vercel for Next.js: the built in image optimizer, ISR caching, and `proxy.ts` need adapter specific setup, and a new Next.js release may land on Workers a little later.
- Two vendors for the core (Cloudflare for compute, DNS, Hyperdrive, backups; Supabase for data) means two dashboards to check when something breaks, and production Supabase settings are kept in step with `config.toml` by hand.
- Rendering every storefront page on each request costs a database round trip per page; fine at this scale, revisit with caching if pages feel slow.
- Supabase image transformations are billed per origin image beyond the Pro quota, and video egress counts against the Pro allowance.
- Authorization lives in application code: a forgotten `requireAdmin()` inside a Server Action is a real hole. The RLS and grant locks only block direct browser access, not server bugs.
- Google sign in cannot be tested on preview deploys.
- Losing both admin MFA devices means running a service role script; there are no backup codes.

**Neutral**:
- Lint, format, and commit checks are decided in feature 2 (`/audit`).
- Data model (feature 3), design system (4), language rules (5), search (11), and observability tools (29) each get their own spec on top of this one.
- Money convention to confirm in the data model spec: store amounts as integer agorot (1 ₪ = 100 agorot), never floats.

## Follow-up

- [ ] **Scaffold gate, first step:** confirm `@opennextjs/cloudflare` supports the pinned Next.js 16.4.x, including `proxy.ts`, the custom image loader, and the Hyperdrive binding. If not, fall back to Next.js 15.5.28 or later on Workers (`proxy.ts` becomes `middleware.ts`), or Vercel Pro ($20/mo, about $45 total).
- [ ] Confirm the `aws:eu-central-1` placement hint syntax in current Wrangler docs; if unavailable, use Smart Placement.
- [ ] Confirm the current Supabase Pro image transformation quota, egress allowance, and overage prices before importing the full catalog; if costly, resize at upload time (feature 8).
- [ ] Verify the Resend sending domain (SPF, DKIM records in Cloudflare DNS) before turning on password reset.
- [ ] Create the Google OAuth client with the production and localhost callback URLs.
- [ ] Write `docs/runbooks/admin-mfa.md` and the production Supabase settings checklist during the scaffold.
- [ ] Root `AGENTS.md` should record this stack, the `server/` + `server-only` rule, `requireAdmin()` inside every admin action, the per request `getDb()`, logical CSS properties only, and the RLS lockdown (feature 2, `/audit`).
- [ ] Root `AGENTS.md` `## Agent skills` should list the skills named in Implementation skills (project wide: Vercel, Cloudflare, shadcn, Supabase, Playwright; `resend` and `email-best-practices` belong in the email area's nested `AGENTS.md` once it exists). Its `MCP servers:` line should list Supabase, Playwright, and Context7 once connected.
- [ ] Connect the chosen MCP servers yourself: `claude mcp add --transport http supabase https://mcp.supabase.com/mcp` · `claude mcp add playwright -- npx @playwright/mcp@latest` · `claude mcp add context7 -- npx -y @upstash/context7-mcp`.
- [ ] Consider community skills for Drizzle ORM, Tailwind CSS v4, and next-intl (found but unconfirmed; no official ones exist).
- [ ] Decided in later specs, named so the builder does not invent them: order number format (feature 3), spam protection on the public guest order form (feature 13), rate limiting for guest order lookup (feature 16), digit style in Arabic (feature 5).
