# Verify: visitor stats & error alerts · spec 0027 · updated 2026-11-07
_Steps derived from spec 0027 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Already proven during the build (2026-11-07)

- Server errors flush from workerd: on `pnpm preview` with a DSN pointed at a local fake ingest and `NEXT_PUBLIC_SITE_URL=http://localhost:8787`, a route that throws arrived through `onRequestError`, and `reportError` arrived through `waitUntil(Sentry.flush(2000))`. Plain `@sentry/nextjs` works on OpenNext, so the `withSentry` fallback was not needed. → AC-8
- The same requests with `Host: skf-pro.someone.workers.dev` sent nothing. → AC-13
- A phone (`0599123456`, `059-912-3456`) and an order path (`/orders/1042`) arrived as `[digits]` and `/orders/[order]`; headers kept only the user agent. → AC-14
- Per request isolation: request `a` set user `user-a`, request `b` set `user-b` and threw; `b`'s event carried `user-b` only. → AC-14
- Browser: an uncaught error and an unhandled rejection on the "production" host reached the ingest, scrubbed, with no replay data. → AC-9, AC-15
- Beacon: present on `/` with `{"token":…,"spa":true}`, absent on `/admin/login`. → AC-6
- `e2e/visitor-stats.spec.ts`: 8 of 8 passed on `next dev` and on workerd (`E2E_TARGET=preview`). → AC-1 to AC-7, AC-17

## UI / manual

- [ ] Sign in as admin, open `/admin/stats` → title الزيارات, chip "آخر 7 أيام" current, sidebar link الزيارات current and right after التقارير → AC-1
- [ ] `/admin/stats?period=90d` → reads as 7 days → AC-1
- [ ] `?period=30d` → two totals (page views, visits), the estimate hint, 30 bars with a zero day shown as an empty bar, and no "unique visitors" figure; `?period=today` → totals only, no bars → AC-2
- [ ] Top products: stale and multi segment paths dropped, an encoded and a plain path for one product added together, each row links to the storefront page and to `تعديل <name>` → AC-3
- [ ] Sources: direct plus the shop's own host together as مباشر, both Facebook hosts together, any other host bare; WhatsApp note under the list → AC-4
- [ ] `?period=today` against the stub → visits shows; sources (500) and products (over 5 s) each show "تعذّر تحميل هذا القسم." with a plain retry link to the same address; Workers Logs show `stats_read_failed` twice → AC-7
- [ ] With the three `CF_*` values unset → one "إحصاءات الزيارات غير مفعّلة بعد" notice, nothing reported → AC-7
- [ ] Storefront on a non production host → no `cloudflareinsights` script; on the production host → present with `spa: true`; never under `/admin` or `/auth` → AC-6
- [ ] 390 and 1280 wide, keyboard only through chips and links, axe clean → AC-17

## Live proof (needs your Sentry and Cloudflare accounts, docs/runbooks/monitoring.md section 6)

- [ ] Production deploy with `SENTRY_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_CF_BEACON_TOKEN` set; a temporary server throw and browser throw on the live domain arrive in Sentry with readable stack traces through the OpenNext bundle, release = deployed commit, environment `production`, no user data beyond an id → AC-8, AC-9
- [ ] The "new issue" email arrives; resolving and re-triggering emails again; a repeat of an open issue does not → AC-12
- [ ] The `order_save_failed` rule emails, at most once per 30 minutes → AC-11, AC-12
- [ ] The same throws on `workers.dev` send nothing → AC-13
- [ ] The live GraphQL API accepts the query shapes: `rumPageloadEventsAdaptiveGroups`, `datetimeHour`, `requestPath`, `refererHost`, `requestPath_like`, `requestPath_notlike`, `orderBy: [count_DESC]` / `[sum_visits_DESC]`, limits 800 and 50, and a 30 day window (split `30d` into two queries if the window cap is shorter) → AC-2 to AC-5
- [ ] The privacy paragraph from the runbook is on the privacy page → AC-16

## Value sourcing checks

- [ ] Period: `?period=` drives the chip and the range line; unknown → 7d → Value sourcing: period
- [ ] Shop days: near midnight shop time (22:00 to 24:00 UTC in winter), a visit lands on the shop day, not the UTC day (unit: `summarizeVisits` "puts each hour on its shop day") → day list, per day bars
- [ ] Window: `datetime_geq`/`datetime_lt` are `shopDayStart(from)` and `shopDayStart(to + 1)`, also across the October summer time change (unit: `statsWindow`) → GraphQL window
- [ ] Ids and token come only from `serverEnv()`; a partial set fails at startup naming the missing ones; `CF_GRAPHQL_URL` other than localhost is rejected → GraphQL ids and token
- [ ] Totals are sums of `count` and `sum.visits` over the period's rows only → page views, visits totals
- [ ] Product names and ids come from `products` under the listed rule (a hidden product never shows) → top products name, id
- [ ] Own host = `NEXT_PUBLIC_SITE_URL` host; change it and the shop's own referrer stops counting as direct → sources own host
- [ ] Beacon token and browser DSN only on `isProductionHost(window.location.host)` → beacon, Sentry client
- [ ] Server gate reads the `host` tag, else the request URL; no host → dropped → Sentry server gate
- [ ] Release = `SENTRY_RELEASE` (`github.sha`) in the deploy job only → release
- [ ] Sentry user = `getClaims()` `sub` only; role tag from `readProfileRole` (admin check) and the checkout's profile read → user id, role
- [ ] `reportError` rate limit: one event per name per minute per instance, the log line always (unit: `report.test.ts`) → rate limit state, fingerprint
- [ ] `order_save_failed` with tag `area: checkout` only from the save catch (unit: checkout `actions.test.ts`) → order save alert

## Commands

- [ ] `pnpm exec vitest run` → all pass, including `src/lib/error-scrub.test.ts`, `src/monitoring-rules.test.ts`, `src/features/stats/**` → AC-2 to AC-5, AC-7, AC-10, AC-11, AC-13, AC-14
- [ ] `pnpm exec playwright test e2e/visitor-stats.spec.ts` (local Supabase up) → 8 passed → AC-1 to AC-7, AC-17
- [ ] `E2E_TARGET=preview pnpm exec playwright test e2e/visitor-stats.spec.ts` with the stub values in `.dev.vars` → 8 passed (start `pnpm preview` first on a slow machine; the build can pass Playwright's 5 minute wait) → AC-1 to AC-7

## Acceptance-criteria coverage

- AC-1 to AC-4: UI steps 1 to 5, e2e, unit (`period`, `shape`)
- AC-5: unit (`query.test.ts`), e2e numbers
- AC-6: build proof, UI beacon step, e2e
- AC-7: UI failure and not set up steps, e2e `today`, unit (`queries.test.ts`)
- AC-8, AC-9: build proof, live proof
- AC-10, AC-11: unit (`report.test.ts`, rule test, checkout test)
- AC-12: live proof
- AC-13, AC-14: build proof, unit (`error-scrub.test.ts`, `monitoring-env.test.ts`, `user.test.ts`)
- AC-15: config (`tracesSampleRate: 0`, transactions and logs dropped, no replay), browser proof
- AC-16: runbook, live proof
- AC-17: e2e with axe at 390 and 1280
