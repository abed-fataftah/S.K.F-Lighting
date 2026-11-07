# Runbook: visitor stats and error alerts

From spec [0027](../specs/0027-visitor-stats-error-alerts/index.md). Visits come from Cloudflare Web Analytics and show on `/admin/stats` (الزيارات). Errors on the live site go to Sentry, which emails you, the developer. Neither service ever receives a customer phone, address, name, or email: a scrubber (`src/lib/error-scrub.ts`) runs on every Sentry event, and only the production host reports at all.

Do the setup below once, before go live. Each step says where its value ends up.

## 1. Sentry project (errors)

1. Sign in to Sentry with your own account (the free Developer plan has one user, which is you).
2. Create one project, platform **Next.js**, named for the shop (for example `skf-pro`).
3. In **Project settings → Client Keys (DSN)**, copy the DSN. It is public by design (it only lets someone send events).
4. In **Settings → Auth Tokens**, create an organization token with the rights to write releases and source maps. This one is secret.
5. In GitHub, **Settings → Secrets and variables → Actions**:
   - Repository variables: `NEXT_PUBLIC_SENTRY_DSN` (the DSN), `SENTRY_ORG` and `SENTRY_PROJECT` (the slugs from the Sentry URL).
   - In the `production` environment, the secret `SENTRY_AUTH_TOKEN` (the token).

The deploy job reads these. With `SENTRY_AUTH_TOKEN` set, the build uploads the source maps under the release `SENTRY_RELEASE` (the git commit) and deletes them before the Worker is bundled, so they are never served. Check builds have no DSN, so they send nothing.

Leave **Settings → Security & Privacy → Data Scrubber** and **Use Default Scrubbers** on, and turn on **Prevent Storing of IP Addresses**. They are a second layer behind ours.

## 2. The two alert rules (AC-12)

In Sentry, **Alerts → Create Alert → Issues**, for this project:

1. **New or regressed issue.** When *a new issue is created*, or *the issue changes state from resolved to unresolved*, then *send a notification to* you (Member: your account). A repeat of an issue that is still open does not email again.
2. **Order save failed.** When *an event is captured* and the filter *the event's tags match* `event` equals `order_save_failed` (it also carries `area: checkout`), then *send a notification to* you. Set **Action interval** to **30 minutes**, so a long outage sends at most one email each half hour.

After you fix an issue, mark it **Resolved** in Sentry. If it comes back, rule 1 emails you again.

## 3. Web Analytics site (visits)

1. In the Cloudflare dashboard, **Analytics & Logs → Web Analytics → Add a site**. Enter the shop's domain.
2. Choose **manual setup (JS snippet)**, never automatic injection: the app adds the beacon itself, only on the storefront and only on the production host, never under `/admin` or `/auth`.
3. From the snippet, copy the `token` value. Set it as the GitHub repository variable `NEXT_PUBLIC_CF_BEACON_TOKEN`. The app turns on SPA mode itself, so visits inside the app count as page views.
4. Copy the **site tag** of the site (shown in the site's settings, also called the site id) and your **account id** (on the account home page). Put both in `wrangler.jsonc` under `vars`: `CF_WEB_ANALYTICS_SITE_TAG` and `CF_ACCOUNT_ID`. They are not secret.

## 4. The analytics read token

1. In Cloudflare, **My Profile → API Tokens → Create Token → Custom token**.
2. Permissions: **Account → Account Analytics → Read**, and nothing else. Limit it to the shop's account.
3. Save it as a Worker secret:
   ```
   pnpm wrangler secret put CF_ANALYTICS_API_TOKEN
   ```

All three of `CF_ACCOUNT_ID`, `CF_WEB_ANALYTICS_SITE_TAG`, and `CF_ANALYTICS_API_TOKEN` must be set together. With none, `/admin/stats` shows "not set up yet". With only some, the Worker fails at startup and names the missing ones, so fix the set rather than leave it half done.

Keep the Cloudflare account's members to you and the owner. The beacon follows in app navigation, so Web Analytics' own path list includes order page addresses (the stats page filters them out, Cloudflare's dashboard does not).

## 5. The privacy page paragraph (AC-16)

Before go live, the owner pastes this paragraph into the privacy policy at **/admin/settings → سياسة الخصوصية**. No code writes it.

> نستخدم خدمة Cloudflare Web Analytics لعدّ زيارات صفحات المتجر العامة، دون ملفات تعريف الارتباط (الكوكيز) ودون جمع أي بيانات تعرّف بك. ونستخدم خدمة Sentry لتسجيل الأعطال التقنية في الموقع حتى نصلحها، ولا نرسل إليها رقم هاتفك أو عنوانك أو اسمك أو بريدك الإلكتروني. قد نرفق بالعطل رقمًا تعريفيًا داخليًا لحسابك فقط، لنعرف إن كان العطل يتكرر.

## 6. Live proof (once, after the first deploy with everything set)

1. Add a temporary route that throws on the server and a temporary button that throws in the browser, deploy, and trigger both on the production domain.
2. In Sentry, check that both arrived with a readable stack trace (your file names and lines, not the bundle's), the release equal to the deployed commit, environment `production`, and no user data beyond an account id.
3. Check that the "new issue" email arrived.
4. Trigger the same route on a `workers.dev` or preview address: nothing must arrive.
5. Remove the temporary route and button, deploy again, and record the result in the spec's `verify.md`.

## 7. The weekly backup monitor (spec 0028 AC-8)

The Sunday backup checks in with the Sentry cron monitor `skf-weekly-backup` (`.github/workflows/backup.yml`, through `sentry-cli monitors run` with the DSN, so no auth token is needed). The monitor is created by its first scheduled check in: schedule `0 1 * * 0` UTC, a margin of 120 minutes, at most 60 minutes of run time.

1. Check that your Sentry plan includes a cron monitor (the free Developer plan has had one). If it does not, say so before launch: spec 0028 names the fallback.
2. After the first Sunday run, open **Crons → skf-weekly-backup** and set its alert to email you (Member: your account) when a check in fails, runs over time, or is missed. This is the third alert rule, beside the two in section 2.
3. The proof, once before launch, is a deliberately failing scheduled run ([go-live.md](go-live.md), step 6). Hand runs never mark the monitor.

## Day to day

- **Where a failure is logged.** Every unexpected failure goes through `reportError(event, error, details)` in `src/server/monitoring/report.ts`: one JSON line in Workers Logs (always) and one Sentry issue per `event` name. Sentry gets at most one event per name per minute from each Worker instance, so an outage cannot use up the free monthly quota.
- **Quota used up.** The free plan has a monthly error quota. If a loud bug uses it up, later errors that month are dropped until it resets, but the log lines are still in Workers Logs. Fix the loud bug first.
- **Numbers look low.** Ad blockers and privacy browsers block the beacon, Cloudflare samples at high volume, and WhatsApp's app sends no referrer (so its visits count as مباشر). Read the page as a trend, not an exact count.
- **A stats section shows an error.** The call failed or took over 5 seconds. Each failure is in Sentry as `stats_read_failed` with the section and HTTP status. A `http_401` or `http_403` means the token was revoked or lost its permission.
- **Triage with an agent.** The `sentry-fix-issues` skill (`.agents/skills/sentry-fix-issues/`) reads issues through the Sentry MCP server once it is connected.
