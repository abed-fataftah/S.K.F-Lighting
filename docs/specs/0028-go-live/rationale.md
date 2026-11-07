# 0028. Go live: rationale

## Context

The shop is built feature by feature, but production does not exist yet: no domain, no production Supabase project, no deployed Worker, no GitHub `production` environment. Going live is the first time all the outside services (Cloudflare Registrar and DNS, Workers, Supabase Auth and Storage, Resend, Sentry, Web Analytics, Google OAuth) have to agree on one address. Each one is set by hand in its own dashboard. A missed setting usually shows up as a quiet failure, such as reset emails that link to the wrong host or OAuth that only works on localhost, not as a crash.

The data is the business. Orders, customer balances, cheque payments, and electrician accounts live in one Supabase Postgres database, and product photos live in Supabase Storage. Spec 0001 chose Supabase's daily backups (7 days) plus a weekly encrypted copy in R2, but nothing builds the weekly copy yet. Supabase backups do not include Storage files at all. A backup nobody has restored is a hope, not a backup: wrong keys, a missing schema, or a client version mismatch only appear on the day you need it.

The customers mostly arrive on phones from WhatsApp links, often on mobile data. Every page is rendered on the server for each request (spec 0001), so speed depends on the Worker, Hyperdrive, and the database, not only the browser. Accessibility has a bar already (Lighthouse 95 and axe clean, spec 0003), but nothing checks it across the launch pages together, and nothing sets a speed bar.

The team is one developer plus the shop owner. Whatever runs after launch has to keep working with nobody watching, and has to tell someone when it stops.

## Options considered

### Option 1: Lean on Supabase alone, check by hand

Rely only on Supabase's daily backups and its restore to a new project. Check speed and accessibility by opening PageSpeed Insights in a browser. Launch from a short checklist.

**Pros**:
- Almost no code and no new tools.
- Supabase restore is one button and proves the daily backup.

**Cons**:
- No copy outside Supabase, so losing the Supabase account or project loses everything. Spec 0001 already ruled this out.
- Product photos are not backed up at all.
- PageSpeed Insights cannot fill a cart or open an order, so three of the seven pages go unchecked. The result is a screenshot, not a rule.
- A restore to a new Pro project costs money while it runs, and it never tests the R2 copy.

### Option 2: Weekly encrypted dump with a local restore drill, a hand run Lighthouse check, and a runbook led launch (chosen)

The weekly GitHub Actions job from spec 0001, with a manifest of row counts taken in the same snapshot, a photo sync to R2, and a Sentry cron monitor. A restore drill script that only targets the local database and compares counts exactly. A `launch:check` script on Lighthouse plus Playwright with fixed pass rules, an axe spec in CI, and an ordered runbook.

**Pros**:
- Proves the full path: R2 copy, both keys, the Postgres 17 client, and the restored data the app can read.
- Costs nothing to run. Customer data never leaves your machine during the drill.
- Pass rules are numbers in one constant, rerunnable after any big change.
- Reuses what the project already has: Playwright's Chromium, the axe helper, Sentry, Cloudflare.

**Cons**:
- More moving parts in one workflow (`pg_dump`, `age`, `rclone`, `sentry-cli`).
- The drill does not rehearse restoring into a fresh Supabase project, which is what a real account loss would need.
- Lab numbers, not real customer numbers.

### Option 3: Full automation in CI

The same backup job, plus a Lighthouse CI step after every deploy that fails the pipeline, plus an automated monthly restore into a throwaway Supabase project with checks.

**Pros**:
- Catches a slowdown on the commit that caused it.
- Restores are proven without a person.

**Cons**:
- Lighthouse against a live site over the CI runner's network is noisy. Failing a good deploy on a slow run teaches people to ignore the check.
- An automated restore into Supabase needs an always available second project or creating one through the Management API, with its cost and a second copy of customer data in the cloud.
- Far more to build and keep alive for one developer.

## Rationale

Option 2 fits the forces. The data is the business and spec 0001 already promised an off site copy, so Option 1 is out. A drill on your local database proves the parts most likely to break silently (the R2 upload, the `age` keys, the dump format), costs nothing, and keeps customer data off another cloud. Counting rows inside the same snapshot that `pg_dump` uses makes the check exact, so "matches" means equal, with no tolerance to argue about. Encrypting to two recipients instead of sharing one private key means the owner and you each hold your own key, and either can restore alone.

The photo copy uses `rclone sync` with a backup folder because photos are large and mostly unchanged week to week: copying only changes keeps the job short, and the backup folder means a photo the weekly media sweep removes is still recoverable for 90 days. A Sentry cron monitor beats a failure event because it also catches the run that never happens (a disabled schedule, a broken workflow file), and it reaches the same inbox as site errors.

For speed, Core Web Vitals in the lab with a performance floor of 80 measures what customers feel and what search uses, without making launch depend on one score that a server rendered page with a database round trip struggles to keep at 90. Running by hand, not in CI, keeps the check meaningful: you run it against production after the real catalog and photos are in, where the numbers mean something. The axe spec carries accessibility into every CI run, so the hand check is only the launch gate. Lighthouse plus Playwright, not Lighthouse CI or PageSpeed Insights, because cart, checkout, and the order page need a real cookie, and Playwright is already the project's browser tool.

The quiet launch exists because the first real customers find what tests do not. HSTS waits until after that week because it cannot be quickly undone in browsers that have seen it.

**Runner up**: Option 3, for later, once there is enough traffic that a slowdown or a broken backup costs more than the setup.

## Update 2026-11-07: key rotation and the restore steps

**Key rotation.** AC-4 accepted exactly 2 recipients, while AC-17's rotation added a third first, so the two could not both hold. Options weighed: allow 2 or 3 keys (chosen); keep exactly 2 and swap one key in a single edit (no code change, but a mistyped or lost new key leaves newer dumps with only one working key until someone notices); keep exactly 2 and test the new key on a small file before swapping (catches a typo, not a key lost later). Allowing 3 only for the rotation keeps every dump openable by at least 2 keys at every moment, and the rotation proves the new key against a real backup before the old one goes. The cost is one small change to `parseRecipients`.

**Restore steps, from the first drill.** The first local drill showed two steps of AC-9 could not run as written on Supabase: the cascade from `auth.users` reaches `payments`, whose append only guard refuses any TRUNCATE (so step 1 runs with the replica role too), and Supabase refuses `session_replication_role` as a startup option, so step 2 pipes `pg_restore` SQL into one `psql` session that sets it first. The intent of both steps is unchanged. The drill then matched all 23 tables exactly.

A cross check on another model then tightened the rotation steps (who makes the new key, which backup proves it, what counts as a successful weekly run, a log line while 3 keys are set, a month to return to 2) and the drill's failure output (the warning lines themselves, and a plain note that a failure after step 1 leaves the local database empty). Two suggestions were turned down: replacing step 1 with `supabase db reset` (step 1 keeps the drill working on a database that is not fresh and does no harm on one that is), and a fixed 62 character key check (it would refuse age plugin keys).
