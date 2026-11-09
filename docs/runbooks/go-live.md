# Runbook: go live

From spec [0028](../specs/0028-go-live/index.md). One ordered checklist from an empty production to a live shop. Production starts from nothing, so the order matters: work top to bottom and tick each box when its "done when" is true. `<domain>` means the bare domain you buy in step 1 (for example `skf-lighting.com`). Every value says where it ends up. Where another runbook already covers a step, this one links it instead of copying it.

## 1. Domain and accounts

- [x] Choose the name (Latin letters, `.com` unless you prefer another extension Cloudflare Registrar sells) and buy it in **Cloudflare → Domain Registration → Register Domains**, on the same account as the Worker. The domain then lives in Cloudflare DNS, with nothing to move.
  - Bought somewhere else (Namecheap, for example)? Then in Cloudflare, **Add a domain**, Free plan, on the same account as the Worker, and turn off DNSSEC at the registrar first if it is on. At the registrar, replace its nameservers with the two Cloudflare names. Done when Cloudflare shows the domain **Active** (often within an hour, up to a day). Step 3 needs this. You can move the registration itself to Cloudflare later (**Transfer Domains**), once the registrar's 60 day lock ends; nothing in this runbook needs that.
  - Then clear the registrar's parking records. Cloudflare copies the old records when it adds the domain, so the root and `www` still point at the registrar's parking page (`http://<domain>/` shows "recently registered", `https://<domain>/` answers 522). In **DNS → Records**, delete every `A`, `AAAA`, and `CNAME` record on the root (`@`) and on `www`; keep `TXT` and `MX`. Step 3 needs the root free: a Workers Custom Domain will not attach over an existing record, and the deploy fails. Done when no `A`, `AAAA`, or `CNAME` record is left on either name.
- [x] Workers Paid plan on (**Workers & Pages → Plans**).
- [ ] Supabase Pro project, set up per [supabase-production.md](supabase-production.md): Project, Storage, Database lockdown, Connection strings. Leave the Auth URLs for step 3.
- [x] GitHub: `main` is the default branch (**Settings → General**). Scheduled workflows (backup, media sweep, drill reminder) only run on the default branch, and CI deploys only from `main`. No `main` on GitHub yet? Merge the finished work into one branch, push it as `main` (`git push origin <that branch>:main`), then make `main` the default.
- [x] GitHub `production` environment exists, with **Deployment branches** limited to `main`. Its variables and secrets are filled in by the steps below, and each step names them.

## 2. First deploy

- [ ] Push to `main`. CI applies the migrations and deploys the Worker. Done when the deploy job is green.
- [ ] Run the RLS check against production once, with `DATABASE_URL_DIRECT` set for that one command only:
  ```
  DATABASE_URL_DIRECT='<session pooler URL>' pnpm db:check-rls
  ```
  Done when it prints "RLS check passed".
- [ ] Bootstrap the admin (`pnpm admin:promote`) and enroll MFA on two devices, per [admin-mfa.md](admin-mfa.md).

## 3. Domain on the Worker (AC-1, AC-2)

- [ ] In `wrangler.jsonc`, add the custom domain and turn off the `workers.dev` address, as its own commit (committing it before the domain is bought breaks the deploy):
  ```jsonc
  "routes": [{ "pattern": "<domain>", "custom_domain": true }],
  "workers_dev": false,
  // workers_dev off also turns preview URLs off unless they are named on their own.
  "preview_urls": true,
  ```
  Deploy. Done when `https://<domain>/` shows the shop with a valid padlock.
- [ ] DNS: a proxied (orange cloud) record `www`, type `AAAA`, value `100::`.
- [ ] **Rules → Redirect Rules → Single Redirects**: when the hostname equals `www.<domain>`, redirect dynamically to `concat("https://<domain>", http.request.uri.path)`, status **301**, **Preserve query string** on.
- [ ] **SSL/TLS → Edge Certificates**: **Always Use HTTPS** on, **Minimum TLS Version** 1.2. Leave HSTS off until step 9.
- [ ] GitHub `production` variable `NEXT_PUBLIC_SITE_URL` = `https://<domain>` (no trailing slash). Deploy again so the build picks it up.
- [ ] Supabase **Authentication → URL Configuration**: Site URL `https://<domain>`, and `https://<domain>/**` in the redirect URLs.
- [ ] Google Cloud OAuth client: authorized origin `https://<domain>`. The callback stays Supabase's own (`https://<project ref>.supabase.co/auth/v1/callback`).
- [ ] Check from a terminal. Done when all three hold:
  ```
  curl -I http://<domain>/                     # 301 to https://<domain>/
  curl -I "https://www.<domain>/c?page=2"      # 301 to https://<domain>/c?page=2
  curl -I https://skf-pro.<account>.workers.dev/   # no answer from the shop
  ```

## 4. Email (AC-2)

- [ ] Resend: add the domain, then add its SPF and DKIM records in Cloudflare DNS (not proxied). Add a DMARC record: `TXT _dmarc` = `v=DMARC1; p=none; rua=mailto:<your address>`. Done when Resend shows the domain verified.
- [ ] Supabase custom SMTP through Resend, and the raised auth email rate limit, per [supabase-production.md](supabase-production.md) (Auth).
- [ ] Ask for a password reset on `https://<domain>` with your own account. Done when the email arrives and its link starts `https://<domain>/auth/confirm`.

## 5. Monitoring (AC-8, AC-19)

- [ ] Everything in [monitoring.md](monitoring.md), including its live proof. The Web Analytics site is `<domain>`.
- [ ] The cron monitor alert, section 7 of [monitoring.md](monitoring.md). The monitor itself appears in Sentry on the first scheduled backup.
- [ ] UptimeRobot (free plan): a new HTTP(s) monitor on `https://<domain>/`, every 5 minutes, alert contact your email. Done when the monitor shows "Up" and you got the contact confirmation email.

## 6. Backups (AC-3 to AC-11)

**R2 bucket**

- [ ] **R2 → Create bucket** `skf-pro-backups`, same account. Leave public access off and do not turn on the `r2.dev` URL.
- [ ] **Settings → Object lifecycle rules**, two rules (AC-7):
  - `db-84-days`: prefix `db/`, delete objects 84 days after upload. This keeps about 12 weekly copies, hand runs under `db/manual/` included.
  - `removed-90-days`: prefix `media/removed/`, delete objects 90 days after upload.
  - Nothing for `media/current/`: it never expires.
- [ ] **R2 → Manage API tokens**, two tokens, both limited to `skf-pro-backups`:
  - **Object Read & Write**, for CI: its access key id and secret go in the `production` secrets `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
  - **Object Read only**, for the drill: keep it in your password manager. You set it as `DRILL_R2_ACCESS_KEY_ID` and `DRILL_R2_SECRET_ACCESS_KEY` in your shell only while a drill runs.
- [ ] `production` variables `R2_ENDPOINT` = `https://<account id>.r2.cloudflarestorage.com` and `R2_BUCKET` = `skf-pro-backups`.

**The two age keys**

- [ ] On the owner's own device, with `age` installed (see Tools on Windows): `age-keygen -o skf-backup-owner.key`. It prints `Public key: age1...`. The owner keeps the key file in their password manager and a printed copy at the shop. It never goes into GitHub, Cloudflare, or the repo.
- [ ] On your machine: `age-keygen -o skf-backup-dev.key`. Keep the file in your password manager.
- [ ] `production` variable `BACKUP_AGE_RECIPIENTS`: the two public keys, one per line. The backup refuses to start unless it holds two different keys (three only while you rotate one, see Key rotation).

**Supabase Storage S3 keys**

- [ ] Supabase **Storage → S3 Connection**: copy the endpoint (`https://<project ref>.storage.supabase.co/storage/v1/s3`) and region into the `production` variables `SUPABASE_S3_ENDPOINT` and `SUPABASE_S3_REGION`. Create an access key and put its id and secret in the `production` secrets `SUPABASE_S3_ACCESS_KEY_ID` and `SUPABASE_S3_SECRET_ACCESS_KEY`. These keys carry full Storage access, so they live only in `production`.
- [ ] `DATABASE_URL_DIRECT` is already a `production` secret (step 1). It must be the **session pooler** URL on port 5432: GitHub runners have IPv4 only.

**First run and checks**

- [ ] **Actions → Backup → Run workflow** on `main`. Done when the log ends with `Backup db/manual/<stamp>/: N tables, N rows; dump.age ... bytes, auth.age ... bytes; media N objects, N bytes.` and R2 holds `db/manual/<stamp>/dump.age`, `auth.age`, `manifest.json`, and `media/current/products/...`.
  - If `pg_dump` fails on the snapshot over the pooler, stop: spec 0028 Follow up lists the fallbacks, and that is a decision for `/architect`.
- [ ] Supabase **Database → Backups**: daily backups are listed and the newest is less than a day old (AC-3). This is the daily copy; ours is the weekly off site one.
- [ ] The first restore drill (see Restore drill below), logged in the drill log.
- [ ] The alert proof (AC-8), logged in Results. Hand runs never mark the monitor, so it needs a scheduled run that fails. Either set `R2_SECRET_ACCESS_KEY` to a wrong value on a Saturday and let Sunday's run fail, or commit a temporary `schedule` a few minutes ahead to `main` with the wrong key. Done when Sentry's cron alert email and GitHub's failed workflow email both arrive. Then put the real key back, remove any temporary schedule, and run the workflow by hand once more.
- [ ] **Actions → Restore drill reminder → Run workflow** once. Done when the issue "Quarterly restore drill" opens with a working link to this page. Close it.

## 7. Content

- [ ] Shop settings in `/admin/settings`: WhatsApp number and delivery zones.
- [ ] Policy pages, with the privacy paragraph from [monitoring.md](monitoring.md) section 5.
- [ ] The real catalog through the import, then home banners and featured products.

## 8. Final check (AC-15, AC-16, AC-18)

- [ ] **Smoke test** from a real phone on `https://<domain>`: place a guest delivery order, open it from the link in the WhatsApp message, see it in `/admin/orders`, cancel it in the dashboard, and see "ملغي" on the customer's order page. The cancelled order stays (sales reports leave cancelled orders out). Write its number in Results.
- [ ] **Launch check**, after the real catalog is in, from your own machine on a stable connection:
  ```
  pnpm launch:check --base https://<domain> --order <smoke order number> --phone <its phone>
  ```
  Done when all seven pages pass. Paste the table into Results with the date and commit. A page that fails blocks launch until it is fixed and the check passes again. A page that misses by a little: run once more, and record both runs.
- [ ] CI green on `main`, including `e2e/go-live.spec.ts`.
- [ ] Google Search Console: add the domain property, verify it through Cloudflare DNS, and submit `https://<domain>/sitemap.xml`.

## 9. Quiet launch (AC-20)

- [ ] The site is public and indexable. Share it with a few trusted customers and electricians for about a week.
- [ ] Log every problem they hit in Results, fix those first.
- [ ] The owner announces the shop.
- [ ] After the quiet week: **SSL/TLS → Edge Certificates → HSTS** on, max age 6 months, `includeSubDomains` off, preload off.

## Restore drill

The drill proves a backup really opens. It restores into your **local** Supabase database only, and refuses any other `DATABASE_URL_DIRECT`.

1. Start from a fresh local database: `pnpm db:start`, then `pnpm exec supabase db reset` (no `db:seed`).
2. From R2, download one backup folder (`db/<stamp>/` or `db/manual/<stamp>/`): `dump.age`, `auth.age`, and `manifest.json`, into one folder outside the repo.
3. Set the drill's R2 settings in your shell for this run only: `R2_ENDPOINT`, `R2_BUCKET`, `DRILL_R2_ACCESS_KEY_ID`, `DRILL_R2_SECRET_ACCESS_KEY` (the read only token).
4. Run:
   ```
   pnpm backup:restore-drill --dir <that folder> --identity <path to your age key file>
   ```
   The key path is only an argument: never put it in the repo, `.env.local`, or a log. The decrypted files live in the OS temp folder and are deleted at the end, even after a failure.
5. Done when every line reads PASS: counts (every table matches the manifest), RLS, and photos (3 restored photos found in `media/current/`). A count mismatch names the table. `photos` fails when the manifest says the photo copy failed. Each `pg_restore` warning prints as its own line above the count, schema messages only. If the drill stops with `the local database is now empty`, run `pnpm exec supabase db reset` and start again from step 4.
6. By hand: `pnpm dev`, open a real product page and a real order in the dashboard. Product photos do not show locally; they live in production Storage and R2.
7. Run `pnpm exec supabase db reset` before going back to normal work. The restored database carries production's migration history, so never run `pnpm db:migrate` on it.
8. Write the result in the drill log.

### Key rotation

To replace a key (a new phone, a lost password manager, someone leaving), work through these in order:

1. The person who holds the key makes the new pair on their own device: `age-keygen -o skf-backup-<who>-<year>.key`. The key file stays with them, as in step 6.
2. Add its public key as a third line of `BACKUP_AGE_RECIPIENTS`. The backup accepts three keys and logs `3 recipients, rotation in progress` (never the keys themselves).
3. **Actions → Backup → Run workflow** by hand, then run the restore drill on that run's `db/manual/<stamp>/` folder with `--identity` set to the **new** key. Done when every line reads PASS. Write the stamp in the drill log, with "rotation" under Problems found.
4. Wait for one scheduled Sunday run to succeed with a green check in on the Sentry cron monitor.
5. Remove the old key from `BACKUP_AGE_RECIPIENTS`, back to two lines, within the same month.

Older dumps stay readable with the key that did not change, so keeping the old key until they expire (84 days) is only a second copy, not a need.

### Tools on Windows

The drill needs `pg_restore` 17 or newer with its `psql`, `age`, and `rclone` on the `PATH`, and names any that are missing.

```
winget install PostgreSQL.PostgreSQL.17   # in the installer, the command line tools are enough
winget install FiloSottile.age
winget install Rclone.Rclone
```

Add `C:\Program Files\PostgreSQL\17\bin` to the `PATH` if the installer did not, open a new terminal, and check: `pg_restore --version`, `psql --version`, `age --version`, `rclone version`.

## Day to day

- **A Sunday backup failed.** The Sentry cron email and GitHub's email both arrive. The job log names the stage that failed (`pg_dump`, `age`, `rclone`) without any row data. Fix it and run the workflow by hand.
- **The photo copy refused.** The log says the bucket was empty or shrank by 20% or more, and nothing was synced. The dump is still kept, with `media: null`. Check that the photos are really still in Storage before anything else. A sync that would delete more than 50 files also stops: if a large cleanup was real, run the sync once by hand from your machine with a higher `--max-delete`.
- **The quarterly issue opens.** Run the drill, log it, close the issue.

## Results

Fill in as each step is done.

| What | Date | Commit | Result |
|---|---|---|---|
| First backup run (step 6) | | | |
| Alert proof, deliberate failing run (AC-8) | | | |
| Drill reminder hand run (AC-11) | | | |
| Smoke test order number (AC-18) | | | |
| Search Console sitemap submitted | | | |

**Launch check** (AC-16): paste the table from `pnpm launch:check` here, with the date and commit. Add a second table when a page needed a rerun.

**Quiet launch notes** (AC-20): what trusted customers hit, and what was fixed.

## Drill log

| Date | Dump stamp | Who | counts | RLS | photos | Problems found |
|---|---|---|---|---|---|---|
| | | | | | | |

Once a year, also restore into a throwaway Supabase project instead of the local database. That is what a real account loss would need, and it proves the steps still work end to end.
