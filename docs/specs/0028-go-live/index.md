# 0028. Go live

**Date**: 2026-11-07
**Status**: In Progress

## Summary

This spec puts the shop on its own domain and makes it safe to open to customers. The domain is bought through Cloudflare Registrar at launch and attached to the Worker, with `www` redirecting to the bare domain. A weekly GitHub Actions job writes an encrypted database dump (a full copy of the data, locked so only the owner's key or yours can open it) and a copy of the product photos to a private Cloudflare R2 bucket (file storage). Supabase's own daily backups cover the days in between. Before launch you restore that dump into your local database and prove it matches. A hand run script checks seven main pages against a phone speed and accessibility bar. An ordered runbook (`docs/runbooks/go-live.md`) walks you from zero to a quiet launch and records every result. There is no database change.

## Requirements

New code is small and lives at the edges. Three scripts go in `scripts/` (`backup-run.ts`, `restore-drill.ts`, `launch-check.ts`), with their pure parts (the manifest shape, the count comparison, the pass rules, the page list) in `src/features/launch/` so Vitest covers them without mocks. Two workflows go in `.github/workflows/` (`backup.yml`, `restore-drill-reminder.yml`), and one Playwright spec goes in `e2e/go-live.spec.ts`. Most of the work is the runbook, because most of going live is setup done by hand in dashboards. `<domain>` below means the bare domain you buy at launch (for example `skf-lighting.com`). No code or test hardcodes it. Everything reads it from `NEXT_PUBLIC_SITE_URL`.

**User stories**:
- As the shop owner, I want the shop on its own address with a padlock, so customers trust the link they get on WhatsApp.
- As the shop owner, I want my orders, customers, and payments copied somewhere safe every week, and proof that the copy really opens, so a mistake or a lost account never loses the business.
- As the developer, I want one ordered checklist from an empty production to a live shop, and one command that tells me whether the main pages are fast and accessible enough on a phone.
- As a customer on a phone, I want the shop pages to load quickly and work with my screen reader.

**Acceptance criteria**:

*Domain*

- **AC-1**: The shop answers on `https://<domain>/` over a valid certificate, through a Workers Custom Domain (`routes` in `wrangler.jsonc`: `{ "pattern": "<domain>", "custom_domain": true }`). `http://<domain>/...` redirects to `https://` (Cloudflare **Always Use HTTPS** on). `https://www.<domain>/<path>?<query>` answers **301** to `https://<domain>/<path>?<query>` through one Cloudflare **Single Redirect** rule on a proxied `www` DNS record (`AAAA 100::`), with the path and query kept. Minimum TLS version is 1.2. `"workers_dev": false` is set in `wrangler.jsonc`, so the production Worker has no second public address.
- **AC-2**: Every place that names the production address uses `https://<domain>` (the bare domain, no trailing slash): the GitHub `production` variable `NEXT_PUBLIC_SITE_URL`, Supabase **Site URL** and redirect URLs, the Google OAuth client's origins and callback, the Resend sending domain (SPF, DKIM, and a DMARC record `p=none` at first, all in Cloudflare DNS), and the Web Analytics site. After the first deploy on the domain, a password reset email from production links to `https://<domain>/auth/confirm`.

*Backups*

- **AC-3**: Supabase daily backups are on (Pro plan, 7 days) and the runbook has you confirm in the Supabase dashboard (Database → Backups) that the latest one is less than a day old. This is the daily backup the scope asks for.
- **AC-4**: `.github/workflows/backup.yml` runs every Sunday at 01:00 UTC and on `workflow_dispatch`, in the `production` environment, never on a pull request. It has `concurrency: { group: backup-production, cancel-in-progress: false }` and `timeout-minutes: 50` (below the cron monitor's 60). It installs pinned release binaries of `age` and `rclone` (version and SHA256 checked in the workflow) and `postgresql-client-17` from the PostgreSQL apt repository. One script, `pnpm backup:run` (`scripts/backup-run.ts`), does the whole job in order: dump, media copy, manifest. Before anything else it checks that `BACKUP_AGE_RECIPIENTS` holds 2 or 3 different lines, each starting `age1` (2 normally, 3 only while a key is being rotated, AC-17; with 3 it logs one line, `3 recipients, rotation in progress`, and never prints a key), and writes them to a recipients file in the runner's temp folder (public keys, not secret). It connects through `DATABASE_URL_DIRECT`, the Supabase **session pooler** (port 5432, IPv4, which GitHub runners need), opens a `repeatable read, read only` transaction, calls `pg_export_snapshot()`, counts every table it will dump inside that transaction, and keeps the transaction open while two `pg_dump --snapshot=<id>` runs (Postgres 17 client, custom format `-Fc`) take the same moment in time:
  - `dump.age`: `pg_dump -Fc -n public -n drizzle`, the two schemas in full;
  - `auth.age`: `pg_dump -Fc --data-only -t auth.users -t auth.identities`, the sign in rows only.

  Each runs as `pg_dump … | age -R <recipients file> | rclone rcat r2:<bucket>/db/<stamp>/<file>`, so no unencrypted copy and no temp file ever touches the runner's disk. Each stage's exit code is checked (Node `spawn` with every process's exit awaited, the shell equivalent of `set -o pipefail`), so a failed `pg_dump` fails the job even when `age` and the upload succeed. After each upload, the script reads the object's size with `rclone size --json` and fails if it is 0. `<stamp>` is the run's start time in UTC, `YYYYMMDDTHHMMZ`. Runs started by hand (`workflow_dispatch`) write under `db/manual/<stamp>/` instead of `db/<stamp>/`.
- **AC-5**: `manifest.json` is uploaded **last**, after the media copy, with `rclone rcat`. It holds only `{ "takenAt": <ISO UTC>, "gitSha": <commit>, "pgDump": <client version>, "tables": { "<schema>.<table>": <row count>, ... }, "media": { "objects": <count>, "bytes": <total> } | null }`. `tables` covers every base table in `public` and `drizzle`, plus `auth.users` and `auth.identities`. `media` is `null` when the media copy failed: the dump is still kept, the manifest is still written, and the job then exits non zero. The manifest holds no customer data. The job logs only the stamp, the number of tables, the total row count, and the object sizes, never a row, a phone, or an address.
- **AC-6**: The media copy runs `rclone sync` over both S3 APIs (Supabase Storage's S3 endpoint and R2's) from the `product-media` bucket into `r2:<bucket>/media/current/`, with `--backup-dir r2:<bucket>/media/removed/<stamp>/` (same remote, as rclone requires), `--check-first`, and `--max-delete 50`. A file deleted or replaced in Storage moves aside instead of being lost. Only new or changed files are copied. Before the sync, a guard lists the source with `rclone size --json`. It fails the media step, deleting nothing, when the source holds 0 objects or at least 20% fewer than `media.objects` in the newest earlier manifest under `db/` (no earlier manifest skips the drop check). Photos are public already, so this copy is not encrypted.
- **AC-7**: R2 keeps about 12 weekly database copies. A bucket lifecycle rule deletes objects under `db/` 84 days after upload (this includes `db/manual/`). A second rule deletes objects under `media/removed/` after 90 days. `media/current/` matches no rule and never expires. Cloudflare can run a lifecycle deletion up to about a day late, and a failed Sunday leaves one copy fewer, so the promise is "about 12", not exactly 12. The bucket has no public access and no `r2.dev` URL.
- **AC-8**: A failed or missed weekly backup reaches you two ways. The workflow runs `sentry-cli monitors run skf-weekly-backup --schedule "0 1 * * 0" --check-in-margin 120 --max-runtime 60 -- pnpm backup:run`, with `SENTRY_DSN` set from the existing `NEXT_PUBLIC_SENTRY_DSN` variable (check ins by DSN need no auth token). Hand runs skip the wrapper, so they never mark the monitor. Sentry then marks a Sunday run that fails, takes longer than an hour, or never starts within two hours of its slot, and emails you through a third alert rule (a Cron Monitor alert, added to `docs/runbooks/monitoring.md`). GitHub's own failed workflow email is the second path. The alert is proven once before launch by a deliberately failing run (a scheduled run with a wrong R2 key, or a temporary `schedule` a few minutes ahead), logged in the runbook.

*Restore drill*

- **AC-9**: `pnpm backup:restore-drill --dir <folder holding dump.age, auth.age, manifest.json> --identity <path to an age key file>` restores into the local Supabase database only. It loads `.env.local` the way `scripts/seed-dev.ts` does and checks `DATABASE_URL_DIRECT` with `isLocalDatabaseUrl` (`src/server/db/local.ts`: localhost or 127.0.0.1, port 54322). Any other value, including one set in the shell, makes it refuse and change nothing; it never falls back. It first checks that `pg_restore` (major version 17 or newer, since an older one cannot read the Postgres 17 archive) and its `psql`, `age`, and `rclone` are on the `PATH` and names any missing one (the runbook gives the Windows install steps). It decrypts both files to the OS temp folder and deletes them when done, even after a failure. Then, in this order:
  1. `truncate auth.users cascade` inside a transaction with `set local session_replication_role = replica` (the cascade also empties `auth.identities`, `public.profiles`, and every table that points at profiles, such as `orders` and `payments`, all restored in step 3; the replica role keeps the `payments_no_truncate` guard from refusing it);
  2. `pg_restore --data-only --file=-` of `auth.age`, piped into one `psql` session (`ON_ERROR_STOP`, one transaction) that runs `set session_replication_role = replica` first, so `handle_new_user` does not fire and create duplicate profiles. Supabase lets `postgres` set that role in SQL but refuses it as a connection startup option (`PGOPTIONS`), and `--disable-triggers` is left out because its `ALTER TABLE` needs the table owner;
  3. `pg_restore --clean --if-exists --no-owner --no-privileges -n public -n drizzle` of `dump.age`, with exit on error off. Its warnings are counted and printed, each line as `pg_restore` wrote it (schema messages only, never row data), not fatal; the count checks below decide pass or fail. Any failure after step 1 ends with the line `the local database is now empty: run supabase db reset and try again`, since step 1 has already emptied it.

  The identity file path is an argument only, never stored in the repo, `.env.local`, or a log. The local database should be fresh first (`supabase db reset`, no `db:seed`). After a drill, the local database carries production's migration history, so you never run `pnpm db:migrate` on it; run `supabase db reset` before going back to normal local work.
- **AC-10**: After the restore, the drill compares row counts with the manifest for every table it lists, `auth.users` and `public.profiles` included. Every table must match exactly. Then it calls `findRlsProblems` from `scripts/check-rls.ts` directly on the local connection (no RLS problems allowed). Then it lists `media/current/<storage_key>` in R2 with `rclone lsf` for 3 restored product images (read only R2 token, env vars below). With `media: null` in the manifest, the image check is reported as skipped and the drill fails. It prints one pass or fail line per check and exits non zero on any failure. Next, by hand, `pnpm dev` against the restored database shows a real product page and, in the dashboard, a real order. Product photos do not show locally, which is expected: they live in production Storage and R2, not in the local bucket.
- **AC-11**: The first drill runs before launch and is written into the drill log in `docs/runbooks/go-live.md` (date, dump stamp, who ran it, each check's result, problems found). `.github/workflows/restore-drill-reminder.yml` opens a GitHub issue "Quarterly restore drill" on the first of January, April, July, and October at 06:00 UTC, and on `workflow_dispatch`, linking the runbook's drill section. Only `issues: write` permission, no secrets. One hand run before launch proves it.

*Phone speed and accessibility check*

- **AC-12**: `pnpm launch:check --base <url> --order <number> --phone <phone> [--category <slug>] [--product <slug>] [--search <text>]` measures seven pages: home, a category page, a product page, search results, the cart with one item in it, checkout with that item, and the order page. Every path is built from `routes` (`routes.home`, `routes.category`, `routes.product`, `routes.search(text)`, `routes.cart`, `routes.checkout`, `routes.orderTrack`, `routes.order(number)`), never by hand. Without `--category` and `--product`, `pickFromSitemap` takes the first `<loc>` whose path starts `/c/` and the first whose path starts `/p/` from `<base>/sitemap.xml`. When the sitemap is missing or not XML (every preview host, spec 0026 AC-2), both flags are required and the script says so before opening a browser. `--search` defaults to `ثريا`. If the results page shows the empty state, the script stops and asks for a `--search` that finds products. `--order` goes through `parseOrderNumberInput` and `--phone` through the same phone schema the lookup form uses; a value either refuses stops the script with a plain message.
- **AC-13**: The script runs Lighthouse (the `lighthouse` npm package) against Playwright's Chromium, with Lighthouse's default mobile settings (simulated slow 4G, mid range phone CPU). It picks a free port at start and opens `chromium.launchPersistentContext(<temp profile>, { args: ["--remote-debugging-port=<port>"] })`, because Lighthouse sees only the cookies of the browser's own profile, not those of a `newContext()`.
  - **Cold group**, a fresh temp profile: home, category, product, search, each with Lighthouse's normal storage reset.
  - **Warm group**, a second fresh temp profile: Playwright opens the product page, picks the default variant if the product has several, and clicks the add to cart button, found by its role and its name from `ar.json` (never a literal string in the script). Then it submits `/orders/track` with `--order` and `--phone` (one lookup, inside the rate limit). Cart, checkout, and the order page then run with `disableStorageReset: true`. Before measuring, the script checks each warm page's final URL equals the URL it asked for. A redirect (an empty cart, a lookup that did not unlock) stops the script naming the page. A lookup answer of not found or limited also stops it, with that reason.

  Each page runs 3 times, and the median run (Lighthouse's `computeMedianRun`) is judged. Both temp profiles are deleted at the end. The script never places, changes, or cancels an order. Run it from one place (your own machine, on a wired or stable connection). When a page fails by a small margin, run the script once more before calling it a failure, and record both runs.
- **AC-14**: A page passes when its median run has all of: LCP (time until the main content shows) 2.5 s or less, CLS (how much the layout jumps) 0.1 or less, TBT (time the page is too busy to respond) 200 ms or less, Lighthouse performance score 80 or more, and Lighthouse accessibility score 95 or more. The script prints a table of each page's five numbers with pass or fail, saves each page's HTML and JSON report to `launch-reports/<stamp>/` (git ignored), and exits non zero if any page fails. Times and scores print through helpers in `src/lib/format.ts` (`formatMs`, `formatScore`, added there), never `.toFixed(` or `Intl` in the script, per the language rules.
- **AC-15**: `e2e/go-live.spec.ts` runs `expectNoAxeViolations` (WCAG 2.1 A and AA, zero violations) on the same seven pages on the `phone` project (390 by 844, RTL) in CI on workerd. It uses the existing local fixtures and helpers: the seeded category "ثريات" and one of its seeded products (from `scripts/seed-dev.ts`, through the helpers in `e2e/categories.ts`), a search for a word in that product's name, the cart and checkout with that product added through the real button, and an order placed in the test with `uniquePhone` (`e2e/orders.ts`) and then opened from a fresh context through the real `/orders/track` form. Every URL comes from `routes`. It is part of every CI run, so a later change cannot quietly break accessibility on the launch pages.
- **AC-16**: Before launch, `pnpm launch:check --base https://<domain>` passes on all seven pages, run after the real catalog is imported. Its table is pasted into the results section of `docs/runbooks/go-live.md` with the date and commit. A page that fails blocks launch until it is fixed and the check is run again.

*Launch*

- **AC-17**: `docs/runbooks/go-live.md` is one ordered checklist from an empty production to a live shop, in the sections of the launch checklist below. Each step is a checkbox, says where its value ends up, and links the existing runbooks (`supabase-production.md`, `monitoring.md`, `admin-mfa.md`) instead of copying them. Steps that only a person can check (AC-1, AC-2, AC-3, AC-19, AC-20) say exactly what to look at and what counts as done. It has a **key rotation** paragraph: to replace a key, the person who holds it makes the new pair on their own device (`age-keygen`), and its public key goes in as a third recipient. Then run the backup by hand and prove the new key opens that copy: the restore drill on the `db/manual/<stamp>/` folder from that run, with `--identity` set to the new key, its stamp written in the drill log. After one scheduled Sunday run succeeds with a green Sentry check in, remove the old key, back to 2, within the same month. Older dumps stay readable with the key that did not change, so keeping the old key until they expire (84 days) is only a second copy. It also has the Windows install steps for `pg_restore` 17 (with `psql`), `age`, and `rclone`. It ends with a results section (the launch check table, the smoke test, the first drill, the alert proof) and the drill log. A yearly line in the drill log suggests one restore into a throwaway Supabase project too, which is what a real account loss would need.
- **AC-18**: The smoke test runs on `https://<domain>` from a real phone, after everything else is ticked. You place a guest delivery order, open it from the WhatsApp message link, see it in `/admin/orders`, then cancel it in the dashboard and see "ملغي" on the customer order page. The cancelled order stays (sales reports already leave cancelled orders out). The `--order` and `--phone` for `launch:check` come from this order. The runbook records its order number.
- **AC-19**: An external uptime check (UptimeRobot free plan) requests `https://<domain>/` every 5 minutes and emails you after a failure. Its setup is a runbook step with no code.
- **AC-20**: Launch is quiet first. Once the checklist is done, the site is public and indexable, and you share it with a few trusted customers and electricians for about a week. Problems they hit are logged in the runbook and fixed first. Then the owner announces it. After that quiet week, you turn on HSTS (it tells browsers to always use https) in Cloudflare: max age 6 months, no `includeSubDomains`, no preload.

## Decision

**Chosen option**: Option 2: Weekly encrypted dump with a local restore drill, a hand run Lighthouse check, and a runbook led launch.

The launch is mostly an ordered runbook. The code it needs is one weekly backup workflow (encrypted dump plus a photo copy to R2, watched by a Sentry cron monitor), a restore drill script that proves the dump against its manifest on your local database, a Lighthouse plus Playwright check script with fixed pass rules, an axe spec in CI, and a quarterly drill reminder.

**Implementation skills**: `cloudflare` (`cloudflare/skills`, `.agents/skills/cloudflare/`) · `wrangler` (`cloudflare/skills`, `.agents/skills/wrangler/`) · `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) · `sentry-nextjs-sdk` (`getsentry/sentry-agent-skills`, `.agents/skills/sentry-nextjs-sdk/`) · `web-perf` (installed globally, not in the project)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

No database change. The new stored things are files in R2 and one JSON shape:

| Thing | Where | Shape | Notes |
|---|---|---|---|
| Bucket `skf-pro-backups` | Cloudflare R2, same account as the Worker | private, no `r2.dev` URL | made by hand (runbook) |
| `db/<stamp>/dump.age` | R2 | `pg_dump -Fc` of `public` and `drizzle`, `age` encrypted to 2 recipients | expires after 84 days |
| `db/<stamp>/auth.age` | R2 | `pg_dump -Fc --data-only` of `auth.users` and `auth.identities`, same encryption, same snapshot | expires after 84 days |
| `db/<stamp>/manifest.json` | R2 | `BackupManifest` (below), uploaded last | expires with its dump |
| `db/manual/<stamp>/…` | R2 | the same three files from a hand run | expires after 84 days |
| `media/current/<path>` | R2 | the same paths as the `product-media` bucket | never expires |
| `media/removed/<stamp>/<path>` | R2 | files that `rclone sync` replaced or removed | expires after 90 days |
| `launch-reports/<stamp>/` | your machine, git ignored | Lighthouse HTML and JSON per page | never committed |

```ts
// src/features/launch/manifest.ts (pure, Zod parsed)
type BackupManifest = {
  readonly takenAt: string;            // ISO 8601 UTC
  readonly gitSha: string;
  readonly pgDump: string;             // "pg_dump (PostgreSQL) 17.x"
  readonly tables: Readonly<Record<string, number>>; // "public.orders": 412, "auth.users": 87
  readonly media: { readonly objects: number; readonly bytes: number } | null; // null: media copy failed
};
```

Script env is parsed once per script with Zod in `src/features/launch/env.ts` (`backupEnv`, `drillEnv`, `checkEnv`), never in the app's own env module, so the Worker never needs a backup variable to start.

**State transitions**: none. Each backup is written once and expires by the lifecycle rule.

**API surface** (scripts and workflows, no HTTP endpoints):

| Entry | How it runs | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `pnpm backup:run` (`scripts/backup-run.ts`) | inside `backup.yml`, wrapped by `sentry-cli monitors run` on schedule | `DATABASE_URL_DIRECT`, `BACKUP_AGE_RECIPIENTS`, R2 env, Supabase S3 env, `GITHUB_EVENT_NAME` | `dump.age`, `auth.age`, `media/current/`, then `manifest.json`, one summary log line | `production` environment secrets | bad recipients → exit 1 before dumping · snapshot export fails · any `pg_dump`, `age`, or `rclone` stage exits non zero · an uploaded object of size 0 · media guard trips (dump kept, `media: null`) → exit 1 |
| `pnpm backup:restore-drill` (`scripts/restore-drill.ts`) | by hand, your machine | `--dir`, `--identity`, `DATABASE_URL_DIRECT` from `.env.local`, read only R2 env | pass or fail per check, exit code | your machine only | target not local → refuse · a tool missing on `PATH` · decrypt fails (wrong key) · count mismatch · RLS problems · image missing in R2 · `media: null` |
| `pnpm launch:check` (`scripts/launch-check.ts`) | by hand | `--base`, `--order`, `--phone`, optional `--category`, `--product`, `--search` | table, reports in `launch-reports/`, exit code | public pages plus one order lookup | no sitemap and no flags · bad `--order` or `--phone` · empty search · lookup not found or limited · a warm page redirected · any page below the bar |
| `restore-drill-reminder.yml` | cron, quarterly | none | a GitHub issue | `GITHUB_TOKEN`, `issues: write` | none that matter |

Pure helpers in `src/features/launch/` (unit tested): `parseManifest(json)`, `buildManifest(counts, media, meta)`, `compareCounts(manifest, restored) → readonly Mismatch[]`, `parseRecipients(text)` (2 or 3 different `age1…` lines), `mediaGuard(sourceObjects, previousObjects) → ok | "empty" | "dropped"` (20% rule), `backupPrefix(stamp, eventName)` (`db/` or `db/manual/`), `judgePage(metrics) → { pass, failures }` with the thresholds as one `LAUNCH_BAR` constant, `launchPages({ base, category, product, search, order })` (built through `routes`), `pickFromSitemap(xml) → { category, product } | null`, and `backupStamp(date)` (slices `date.toISOString()`, no local date getters; tested at a UTC day boundary). `formatMs` and `formatScore` go in `src/lib/format.ts` with its other formatters.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Domain | `<domain>` | bought at launch (runbook step 1), then set once in `NEXT_PUBLIC_SITE_URL` and `wrangler.jsonc` `routes` |
| Backup | connection | `DATABASE_URL_DIRECT`, the session pooler on port 5432 (IPv4) |
| Backup | snapshot id | `pg_export_snapshot()` in the dump script's transaction, held open until both `pg_dump` runs end |
| Backup | table list | `information_schema.tables` for schemas `public` and `drizzle`, base tables only, plus the fixed pair `auth.users`, `auth.identities`, read in the same snapshot |
| Backup | dump or hand run prefix | `GITHUB_EVENT_NAME` (`schedule` → `db/`, `workflow_dispatch` → `db/manual/`) |
| Backup | previous media count | `media.objects` in the newest earlier `manifest.json` under `db/` (listed with `rclone lsf`) |
| Backup | row counts | `select count(*)` per table in the same snapshot, so they equal what `pg_dump --snapshot` writes |
| Backup | `<stamp>` | the run's start time in UTC, through `backupStamp` |
| Backup | `gitSha` | `GITHUB_SHA` |
| Backup | recipients | `BACKUP_AGE_RECIPIENTS` (GitHub `production` variable, one public key per line: 2 keys, 3 only during a rotation) |
| Backup | media counts | `rclone size --json` on `media/current/` after the sync |
| Retention | about 12 copies | R2 lifecycle rule, 84 days on `db/` (decided here) |
| Drill | local database | `DATABASE_URL_DIRECT` from `.env.local`, accepted only by `isLocalDatabaseUrl` |
| Drill | expected counts | `manifest.json` |
| Drill | restored counts | `count(*)` per manifest table on the local database |
| Drill | 3 image paths | `product_media.storage_key` of the first 3 rows with `kind` image (by `id`) in the restored database, looked up as `media/current/<storage_key>` |
| Check | category and product URLs | `--category` / `--product`, else the first `<loc>` with a `/c/` path and the first with a `/p/` path in `<base>/sitemap.xml` |
| Check | add to cart button | its role and accessible name from `ar.json` |
| Check | debugging port | a free port picked at start |
| Check | search text | `--search`, default `ثريا` |
| Check | order page access | `--order` and `--phone` from the smoke test order (AC-18), sent through `/orders/track` |
| Check | pass bar | `LAUNCH_BAR` in `src/features/launch/bar.ts`: LCP 2500 ms, CLS 0.1, TBT 200 ms, performance 0.80, accessibility 0.95 (decided here) |
| Check | device and network | Lighthouse default mobile config, unchanged |
| Alerts | missed or failed backup | Sentry cron monitor `skf-weekly-backup`, schedule and margins in AC-8, DSN from `NEXT_PUBLIC_SENTRY_DSN` passed as `SENTRY_DSN` |

**Key invariants**:
- No unencrypted database dump is ever written to disk on a runner, and no dump of any kind goes to git, a GitHub artifact, or a log.
- Every dump is encrypted to every recipient (2 keys, or 3 during a rotation), so any one of them alone opens it. Losing one key does not lose the backups, and a new key is proven to open a copy before an old one is removed.
- The restore drill never connects to anything but a local database, and never runs migrations on what it restored.
- The media copy never deletes more than 50 files in one run, and never runs against an empty or sharply shrunk source.
- The manifest is written last, so a manifest's presence means its dump files finished uploading.
- `launch:check` only reads, apart from one order lookup.
- Nothing in code holds the domain name except what comes from `NEXT_PUBLIC_SITE_URL` (and the one `routes` line in `wrangler.jsonc`).
- Migrations still only add. The restore drill restores the schema that was dumped and does not run migrations.

**Security model**:
- Dumps hold customer phones and addresses, plus password hashes from `auth.users`, so they are encrypted with `age` before leaving the dump process. The two private keys live offline: the owner keeps one in a password manager with a printed copy at the shop, and you keep the other in your password manager. Neither ever goes into GitHub, Cloudflare, or the repo.
- The backup job uses `DATABASE_URL_DIRECT` (the same `postgres` login migrations use), only in the `production` environment, only on `main`'s workflow file, never on pull requests.
- The R2 token in CI is scoped to the `skf-pro-backups` bucket, **object read and write**. The drill uses a separate, **object read only** token for the same bucket, kept on your machine for the run. The Supabase S3 key is read only use (the job only reads Storage), though Supabase S3 keys carry full Storage access, so it lives only in the `production` environment.
- MFA factors, sessions, and refresh tokens are not dumped. After a real disaster restore, admins enroll MFA again (`docs/runbooks/admin-mfa.md`).
- Rule from `AGENTS.md`: no customer phone or address in logs. The dump script logs counts only. The launch check passes `--phone` to a form and never prints it.

**Configuration required**:
- `BACKUP_AGE_RECIPIENTS` (GitHub `production` variable): the two `age` public keys, one per line (a third only while rotating a key, AC-17). Replaces spec 0001's single `BACKUP_AGE_PUBLIC_KEY`.
- `R2_ENDPOINT` (variable, `https://<account id>.r2.cloudflarestorage.com`), `R2_BUCKET` (variable, `skf-pro-backups`), `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (secrets, the read and write token).
- `SUPABASE_S3_ENDPOINT` and `SUPABASE_S3_REGION` (variables, from Storage → S3 Connection), `SUPABASE_S3_ACCESS_KEY_ID` and `SUPABASE_S3_SECRET_ACCESS_KEY` (secrets).
- `NEXT_PUBLIC_SENTRY_DSN` (existing variable) passed to `sentry-cli` as `SENTRY_DSN` for the cron check ins.
- `NEXT_PUBLIC_SITE_URL` (existing `production` variable) set to `https://<domain>`.
- `wrangler.jsonc`: `routes` with the custom domain, `"workers_dev": false`.
- Drill only, on your machine: `DRILL_R2_ACCESS_KEY_ID`, `DRILL_R2_SECRET_ACCESS_KEY` (read only), with `R2_ENDPOINT` and `R2_BUCKET`.
- Outside the app: Cloudflare Registrar, the Single Redirect rule, Always Use HTTPS, minimum TLS 1.2, HSTS later, the R2 lifecycle rules, the Sentry cron monitor alert, UptimeRobot.

**Critical test scenarios**:
- Happy path: run `backup.yml` by hand, download the newest `dump.age`, `auth.age`, and `manifest.json` into one folder, run `backup:restore-drill` with your key, every count matches, RLS passes, 3 images found, the app shows a product and an order, verifies **AC-4**, **AC-5**, **AC-6**, **AC-9**, **AC-10**, **AC-11**
- Happy path: `launch:check` against production after the smoke order passes all seven pages and saves reports, verifies **AC-12**, **AC-13**, **AC-14**, **AC-16**, **AC-18**
- Failure case: the drill with the owner's key opens the dump, and with a random key it fails cleanly and leaves no temp file, verifies **AC-4**, **AC-9**
- Failure case: a manifest with one count changed makes the drill fail naming that table (unit test on `compareCounts`), verifies **AC-10**
- Failure case: `judgePage` fails a page at LCP 2501 ms, CLS 0.11, TBT 201 ms, performance 0.79, or accessibility 0.94, and passes at exactly the limits, verifies **AC-14**
- Failure case: a backup run that exits non zero, or a skipped Sunday, raises the Sentry cron alert, proven once by a deliberately failing run, verifies **AC-8**
- Failure case: `mediaGuard` refuses a source of 0 objects and one 20% below the last manifest (unit test), and a manifest with `media: null` fails the drill, verifies **AC-5**, **AC-6**, **AC-10**
- Failure case: a restored database where the auth rows loaded with the trigger on would show more profiles than the manifest; the drill's ordered restore matches exactly, verifies **AC-9**, **AC-10**
- Failure case: `launch:check` with an empty cart profile stops on the cart redirect instead of measuring the wrong page, verifies **AC-13**
- Manual: the runbook steps for AC-1, AC-2, AC-3, AC-19, and AC-20 are ticked with what was seen, and the reminder workflow is run once by hand, verifies **AC-2**, **AC-3**, **AC-11**, **AC-19**, **AC-20**
- Auth/permission: `backup:restore-drill` pointed at a non local `DATABASE_URL_DIRECT` refuses and changes nothing, verifies **AC-9**
- Domain: `curl -I http://<domain>/` → 301 to https, `curl -I "https://www.<domain>/c?page=2"` → 301 to `https://<domain>/c?page=2`, the `workers.dev` address no longer answers, verifies **AC-1**
- Accessibility: `e2e/go-live.spec.ts` passes on the phone project in CI, verifies **AC-15**

### Launch checklist (the shape of `docs/runbooks/go-live.md`)

Production starts from nothing, so the order matters. Each section is a set of checkboxes in the runbook.

1. **Domain and accounts.** Choose the name (Latin letters, `.com` unless you prefer another Cloudflare Registrar extension) and buy it in Cloudflare Registrar. Workers Paid plan on. Supabase Pro project per [supabase-production.md](../../runbooks/supabase-production.md) (Project, Storage, Database lockdown, connection strings). GitHub `production` environment with its variables and secrets.
2. **First deploy.** Push to `main`. Migrations apply and the Worker deploys. Run `pnpm db:check-rls` against production (`DATABASE_URL_DIRECT` set for that one command). Bootstrap the admin (`pnpm admin:promote`) and enroll MFA on two devices ([admin-mfa.md](../../runbooks/admin-mfa.md)).
3. **Domain on the Worker.** Add `routes` with `custom_domain` and `"workers_dev": false` in `wrangler.jsonc` and deploy. `www` DNS record and the Single Redirect rule. Always Use HTTPS, minimum TLS 1.2. Set `NEXT_PUBLIC_SITE_URL`, deploy again. Supabase Site URL and redirect URLs. Google OAuth origins and callback (AC-1, AC-2).
4. **Email.** Resend domain with SPF, DKIM, DMARC. Supabase custom SMTP and the raised rate limit. Send yourself a reset email and check the link (AC-2).
5. **Monitoring.** Everything in [monitoring.md](../../runbooks/monitoring.md), including its live proof, plus the cron monitor alert rule and UptimeRobot (AC-8, AC-19).
6. **Backups.** R2 bucket, lifecycle rules, the two tokens. Generate both `age` key pairs (`age-keygen`), owner's on the owner's device. Supabase S3 keys. Variables and secrets. Run `backup.yml` by hand, check R2 has the dump, manifest, and `media/current/`. Confirm Supabase's latest daily backup. Run the restore drill and log it (AC-3 to AC-11).
7. **Content.** Shop settings (WhatsApp number, delivery zones), policy pages with the privacy paragraph from `monitoring.md`, the real catalog through the import, home banners and featured products.
8. **Final check.** Smoke test order (AC-18). `pnpm launch:check --base https://<domain> --order <n> --phone <p>` passes and its table goes in the results (AC-16). CI green, including `e2e/go-live.spec.ts` (AC-15). Search Console: verify the domain through Cloudflare DNS and submit `https://<domain>/sitemap.xml`.
9. **Quiet launch.** Share with a few trusted customers and electricians. Log what they hit. Fix. The owner announces. Turn on HSTS after about a week (AC-20).

## Build plan

Tracer Bullet: prove one real backup goes all the way from production to a restored local database first, since that path crosses the most systems and is the one you can least afford to find broken later. Then add the alerting, the speed check, the tests, and the runbook around it.

1. Thin thread: `src/features/launch/env.ts` and the pure `backupStamp`, `backupPrefix`, `parseRecipients`, `buildManifest`, `parseManifest`, `compareCounts` with unit tests. `scripts/backup-run.ts` (recipients check, snapshot, counts, the two `pg_dump --snapshot | age | rclone rcat` pipelines with every exit code checked, size checks, manifest last) and `pnpm backup:run`. `backup.yml` with pinned `age` and `rclone` binaries, the Postgres 17 client, `concurrency`, and `timeout-minutes`, `workflow_dispatch` only for now. `scripts/restore-drill.ts` with the `isLocalDatabaseUrl` guard, the tool checks, temp file cleanup, the three step restore order, counts, `findRlsProblems`, and the R2 image check, and `pnpm backup:restore-drill`. Production does not exist yet, so prove the thread with your local database as the source and the real R2 bucket as the target: `backup:run` with a local `DATABASE_URL_DIRECT`, then `pnpm db:start` fresh (`supabase db reset`), then the drill from the downloaded files, satisfies **AC-4**, **AC-5**, **AC-9**, **AC-10**
2. Media copy inside `backup:run` (pure `mediaGuard` with tests, `rclone sync` with `--backup-dir`, `--check-first`, `--max-delete`, `media: null` on failure), the Sunday schedule, the Sentry cron wrapper, and the lifecycle rules documented, satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**
3. `restore-drill-reminder.yml` with `workflow_dispatch`, satisfies **AC-11**
4. Pure `launchPages`, `pickFromSitemap`, `judgePage` and `LAUNCH_BAR` with unit tests (including the exact limits), and `formatMs`, `formatScore` in `src/lib/format.ts` with tests. `scripts/launch-check.ts` with `lighthouse` (new dev dependency) on Playwright's Chromium through `launchPersistentContext` and a free debugging port, the cold and warm profiles, the final URL check, 3 runs and the median, the table, the reports folder (add `launch-reports/` to `.gitignore`), and `pnpm launch:check`. Try it against `pnpm preview` with flags, satisfies **AC-12**, **AC-13**, **AC-14**
5. `e2e/go-live.spec.ts` on the phone project with the local fixtures and `expectNoAxeViolations` on all seven pages, satisfies **AC-15**
6. `docs/runbooks/go-live.md` with the nine sections above, the manual checks, key rotation, the Windows tool installs, the results section, and the drill log. Add the cron monitor alert to `monitoring.md`, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-16**, **AC-17**, **AC-18**, **AC-19**, **AC-20**
7. At launch, walking the runbook: the `wrangler.jsonc` `routes` and `workers_dev` change, as its own commit after the domain is bought (committing it earlier would break the deploy), then the second deploy with `NEXT_PUBLIC_SITE_URL` set, the first real backup, the deliberate failing run, the drill, the reminder hand run, the smoke test, and the launch check on production, all logged, satisfies **AC-1**, **AC-2**, **AC-8**, **AC-11**, **AC-16**, **AC-18**

## Consequences

**Positive**:
- One ordered path from nothing to a live shop, with each result written down where you and the owner can find it.
- Backups are proven to open, not assumed. Two keys mean losing one person's password manager does not lose the data.
- Product photos are covered too, which neither Supabase backups nor a database dump do.
- A missed backup is noticed within hours, not on the day you need it.
- The speed and accessibility bar is a number you can rerun before any big change, and the axe spec keeps the launch pages accessible in every CI run.

**Negative / tradeoffs**:
- The off site copy is weekly, so a total loss of the Supabase account loses up to a week of orders (Supabase's daily backups cover anything short of that).
- A restore drill done by hand depends on someone doing it. The quarterly issue reminds you, but only a person closes it.
- Lighthouse lab numbers on a simulated phone are not real customer numbers. Real phone timings show later in Web Analytics' own Core Web Vitals, and a page can pass the lab and still feel slow on a bad connection.
- The backup job holds the `postgres` login and a full access Storage key in GitHub. A leaked `production` environment would expose both, as it already would for migrations.
- `workers_dev: false` removes the easy `workers.dev` address for checking production. Previews still work through their own URLs.
- Three more outside setups to keep alive (R2 lifecycle, the Sentry cron monitor, UptimeRobot).

**Neutral**:
- New dev dependency `lighthouse`. No S3 npm package: `rclone` does every R2 and Storage transfer. New CI tools installed per run: `postgresql-client-17`, pinned `age` and `rclone`. The drill needs the same three tools on your machine.
- Spec 0001's `BACKUP_AGE_PUBLIC_KEY` becomes `BACKUP_AGE_RECIPIENTS` (two keys), and its monthly keepalive is not needed: GitHub only pauses schedules in public repositories, and the Sentry cron monitor would catch a paused one anyway.
- Running `launch:check` on production adds about 20 page views to Web Analytics.

## Follow-up

- [ ] Confirm at build time that the Sentry Developer (free) plan includes at least one cron monitor, and the current `sentry-cli monitors run` flags. If not included, fall back to a `backup_failed` Sentry event on failure plus GitHub's email.
- [ ] Confirm at build time the Supabase Storage S3 endpoint format and that `rclone` lists the `product-media` bucket with it.
- [ ] Confirm at build time that `pg_dump --snapshot` works over the Supabase session pooler (port 5432). The direct connection is IPv6 only without Supabase's IPv4 add on, and GitHub runners are IPv4, so if the pooler refuses, the fallback is that add on (a cost) or a dump without the shared snapshot and a manifest counted from the restore (weaker).
- [ ] Confirm at build time that the `postgres` role can read `auth.users` and `auth.identities` over the pooler on Supabase Pro.
- [ ] Choose the domain name (runbook step 1).
- [ ] `docs/runbooks/supabase-production.md` and spec 0001 mention `BACKUP_AGE_PUBLIC_KEY`. `/sync` can flag spec 0001 as stale on that line.
- [ ] `web-perf` is installed globally, not in `.agents/skills/`. If you want it in the project, add it to root `AGENTS.md` `## Agent skills`.
- [ ] After launch: real phone Core Web Vitals from Web Analytics on the stats page, if Lighthouse and real numbers disagree.
