# Runbook: production Supabase settings

From spec [0001](../specs/0001-stack-architecture/index.md). Local settings live in `supabase/config.toml`. Production settings are applied by hand in the Supabase dashboard, so keep this list in step with that file whenever it changes.

## Project

- [ ] Plan: **Pro** (no pausing, daily backups kept 7 days).
- [ ] Region: **eu-central-1 (Frankfurt)**. The Worker placement in `wrangler.jsonc` points at the same region.
- [ ] Postgres **17**.

## Auth (Authentication → Settings)

- [ ] Site URL: the production domain (bare domain, `https://...`).
- [ ] Redirect URLs: `http://localhost:3000/**`, the production domain, and the Workers preview URL pattern.
- [ ] Email + password sign in on. Email confirmations as decided by the accounts feature (18).
- [ ] Google provider on, with the client id and secret from Google Cloud. Google callbacks work on production and localhost only, not on preview deploys.
- [ ] MFA: authenticator app (TOTP) enroll and verify on. Phone MFA off. The dashboard needs it (spec 0004): without it `/admin/mfa` cannot set up or check a code.
- [ ] Custom SMTP: Resend, sending from the shop domain (SPF and DKIM verified in Cloudflare DNS first).
- [ ] Raise the auth email rate limit after custom SMTP is on (it starts low).

## Storage

- [ ] Bucket `product-media`: public, file size limit 50 MB, allowed types `image/jpeg`, `image/png`, `image/webp`, `video/mp4`.
- [ ] Image transformations on (Pro plan).

## Database lockdown

Applied by Drizzle migrations from the data model feature (3) onwards, listed here so it is checked after each restore:

- [ ] Row Level Security on for every `public` table, with no policies.
- [ ] Grants on `public` revoked from `anon` and `authenticated`, including default privileges for future tables.

## Connection strings for the app

- [ ] Hyperdrive config created against the **session pooler** URL (`pnpm wrangler hyperdrive create skf-pro-db --connection-string=...`), and its id set in `wrangler.jsonc`.
- [ ] `DATABASE_URL_DIRECT` (session pooler, port 5432) stored as a CI secret for migrations and backups.

## Worker settings that go with it

- [ ] `ORDER_RATE_LIMITER` (spec 0004): the order spam limit, 5 submissions a minute per IP. It is declared in `wrangler.jsonc` (`ratelimits`) and deploys with the Worker, so there is nothing to click. Its `namespace_id` must be unique within the Cloudflare account; change it there if another Worker already uses `1004`. Without the binding the limit is skipped, never blocking an order.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is a Worker secret (spec 0006): the product editor signs uploads and cleans up product files with it. Set it with `pnpm wrangler secret put SUPABASE_SERVICE_ROLE_KEY`. It never goes in a `NEXT_PUBLIC_` variable. `pnpm admin:mfa-reset` also uses it, run from a trusted machine (see [admin-mfa.md](admin-mfa.md)).
- [ ] Hyperdrive caching is off for `skf-pro-db` (`caching.disabled`), so a product saved in the dashboard shows in the shop on the very next request (spec 0006 AC-10).

## Weekly media sweep (spec 0006)

The workflow `.github/workflows/media-sweep.yml` runs `pnpm media:sweep` every Monday. It removes Storage folders `products/<id>/` whose product is gone and whose newest file is more than a day old.

- [ ] Give the `media_sweep` login role (made by migration 0005, with no password) a long random password: `alter role media_sweep with password '<password>';` in the SQL editor. Keep it only in the secret below.
- [ ] In the GitHub `production` environment, add three secrets:
  - `SUPABASE_URL`: the project URL.
  - `SUPABASE_SERVICE_ROLE_KEY`: the service role key.
  - `MEDIA_SWEEP_DATABASE_URL`: the session pooler URL (port 5432) with the user `media_sweep.<project-ref>` and the password above. This login can read product ids and nothing else, so CI never holds the `postgres` login.
- [ ] Run the workflow once by hand (Actions, Media sweep, Run workflow) and check its log ends with `media_sweep_done`.
