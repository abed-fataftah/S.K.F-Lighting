# 0027. Visitor stats and error alerts

**Date**: 2026-11-06
**Status**: In Progress

## Summary

The shop owner gets a new Arabic page in the dashboard, `/admin/stats` (الزيارات), showing visits per day, the most viewed products, and where visitors come from. The numbers come from Cloudflare Web Analytics (a free, cookieless visit counter; no consent banner needed), read through its GraphQL API (a query interface) on each page load. Errors on the live site go to Sentry (an error tracking service, free plan, errors only), which emails you, the developer, when a new kind of error appears or a fixed one comes back. A scrubber (a filter that runs before anything is sent) keeps customer phone, address, name, email, and order numbers out of Sentry, and only the production host ever reports. There is no database change.

## Requirements

New code lives in three places. `src/features/stats/` holds the stats page logic (pure builders and parsers at the top, the Cloudflare call in `server/`). `src/lib/error-scrub.ts` holds the pure scrubber and production gate, shared by the browser and the server. `src/server/monitoring/` holds the `reportError` helper (imports `server-only`). The Sentry entry files sit at the project root and in `src/app/` where Next.js expects them. Every string goes in `ar.json` (a new `Stats` namespace), every link through `routes`, every number and date through `src/lib/format.ts`.

**User stories**:
- As the shop owner, I want to see how many people visited, which products they looked at most, and where they came from, so I know what sells and which share channel works.
- As the developer, I want an email with a readable stack trace when something breaks on the live site, so I can fix it before customers give up.
- As a customer, I want my phone number and address to stay with the shop, not with outside services.

**Acceptance criteria**:

*Stats page*

- **AC-1**: `/admin/stats` is a dashboard page with its own sidebar link (الزيارات) after Reports (`stats` added to `AdminLinkId` and `adminLinks` in `src/features/shell/nav.ts`). It sits under the `(dashboard)` layout. The page itself calls `requireAdmin()` once, before it renders the three sections, each in its own `Suspense` boundary. The period comes from `?period=` with three values: `today`, `7d`, `30d`. `parseStatsPeriod` (new, pure) returns a `StatsPreset` (`Extract<ReportPreset, "today" | "7d" | "30d">`). With no value or an unknown one, the page shows `7d`. Periods are shop calendar days, resolved with `resolvePeriod` from `src/features/reports/period.ts`: today is the current shop day, `7d` and `30d` are the last 7 or 30 shop days including today. The period chips link through `routes.admin.stats(period)`, which leaves out `?period=` for `7d` (as `reportsFor` leaves out the default).
- **AC-2**: The visits section shows two totals for the period: page views (مشاهدات الصفحات, every page shown, including in app navigation) and visits (الزيارات, arrivals from outside the site or a new tab). A one line hint says the counts are an estimate: Cloudflare samples at volume, ad blockers hide some visitors, and some bots are included. For `7d` and `30d`, it also shows one bar per shop day, with a text table alternative, built on the Reports chart pattern (`src/features/reports/components/sales-chart.tsx`) with design tokens only. Days with no data show as zero, never missing. `today` shows the totals only. The page shows no "unique visitors" figure, because a cookieless counter cannot tell people apart.
- **AC-3**: The top products section lists up to 10 products by page views of `/p/<slug>` in the period. Each row shows the product name, its page views, a link to its storefront page (`routes.product(slug)`), and a link to its editor (`routes.admin.product(id)`). A path is normalized before matching: strip one trailing `/`, decode with the shared slug decoder, then Unicode NFC. Paths with more than one segment after `/p/` are dropped. Paths that normalize to the same slug are added together. A path with no listed product (a renamed slug, a deleted product, or a hidden one) is dropped and the next one moves up. Ties sort by product name. If too many of the 50 fetched paths are stale, fewer than 10 rows show, and that is fine. With no matches, the section shows an empty state.
- **AC-4**: The sources section lists up to 10 sources by visits. `referrerLabel(host, siteHost)` lowercases the host, drops a leading `www.`, and groups known hosts under one label:
  - Google: the host is `google.<tld>` or `google.com.<cc>` or `google.co.<cc>`, or ends in one of those after a dot (so `news.google.com` and `www.google.co.il` count);
  - Facebook: `facebook.com` or any `*.facebook.com`, `fb.com`, `fb.me`;
  - Instagram: `instagram.com` or any `*.instagram.com`;
  - WhatsApp: `whatsapp.com` or any `*.whatsapp.com`, `wa.me`.

  An empty referrer, the shop's own host, or its `www.` form counts as مباشر (direct). Any other host shows as its bare host name. A short note under the list says that links opened inside the WhatsApp app usually arrive with no referrer, so they count as direct.
- **AC-5**: Every number on the page leaves out paths under `/orders`, `/checkout/done`, `/account`, and `/admin`. The filter sits in the GraphQL query, so the totals, the day bars, and the lists all agree.
- **AC-6**: The Cloudflare beacon script loads only from the storefront layout (`src/app/[locale]/layout.tsx`). It loads only when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set and the browser's host is the production host (`isProductionHost` from spec 0026). It never loads under `/admin` or `/auth`. The Cloudflare site is set up as a manual snippet site, never with automatic injection, and with SPA mode on (it follows in app navigation).
- **AC-7**: Each section (visits, top products, sources) loads and fails on its own. When the Cloudflare call fails, returns an error, or takes longer than 5 seconds, that section shows an Arabic message with a retry link (a plain `<a>` to the same address with prefetch off, so it really reloads), the failure goes to `reportError` as `stats_read_failed` with the section name and HTTP status, and the other sections still show. When `CF_ANALYTICS_API_TOKEN`, `CF_ACCOUNT_ID`, or `CF_WEB_ANALYTICS_SITE_TAG` is missing, the whole page shows a single "not set up yet" notice and reports nothing. While loading, each section shows a skeleton.

*Errors to Sentry*

- **AC-8**: An error thrown in a page, layout, Server Action, or route handler on the production host reaches Sentry through `onRequestError` in `instrumentation.ts`. It arrives with a readable stack trace (source maps uploaded at deploy), the environment `production`, and the release set to the deployed git commit.
- **AC-9**: An uncaught error or unhandled promise rejection in the browser on the production host reaches Sentry. `src/app/global-error.tsx` (new) and the two existing error boundaries (`src/app/[locale]/error.tsx`, `src/app/admin/(dashboard)/reports/error.tsx`) send their error with `Sentry.captureException` and keep their current look. `global-error.tsx` renders its own `<html lang="ar" dir="rtl">` and `<body>`, and since next-intl is not available there it imports its strings straight from `src/i18n/messages/ar.json`. Errors whose stack frames are only in browser extensions (`chrome-extension://`, `moz-extension://`, `safari-extension://`) and the `ResizeObserver loop` warnings are dropped.
- **AC-10**: A server helper `async reportError(event, error, details?)` writes the same JSON log line the code writes today (`{ event, ...details, error: <name> }` to `console.error`, still in Workers Logs) and sends the error to Sentry with the fingerprint `[event]`, so each kind of failure is one Sentry issue. Call sites `await` it.
  - `details` takes flat string, number, or boolean values only, and goes through the scrubber like everything else.
  - It reads the request host from `headers()` (when there is a request) and sets it on the Sentry scope as the `host` tag, which the production gate reads (AC-13).
  - It hands the send to `getCloudflareContext().ctx.waitUntil(Sentry.flush(2000))`, so the event leaves before the Worker ends the request, and the response is never held up.
  - It sends at most one Sentry event per event name per minute in each Worker instance (a small in memory map of last send times). This is a named exception to the no shared mutable state rule, so a database outage cannot use up the free monthly quota. The log line is always written.
  - Uncaught errors from `onRequestError` keep Sentry's default grouping. Only `reportError` sets fingerprints.

  Every `console.error` in `src/` switches to it (26 call sites in 23 files at the time of writing, none in a `"use client"` file; recount at build time). A Vitest rule fails on `console.error(` anywhere in `src/` outside `src/server/monitoring/` and test files. Client code has no `console.error` today, and new client failures go through `Sentry.captureException`, so the rule covers client files too.
- **AC-11**: When saving an order fails unexpectedly (the `catch` in `src/features/checkout/server/actions.ts` that returns `save_failed`), it is reported as `order_save_failed` with the tag `area: checkout`. Expected refusals (`invalid`, `rate_limited`, the honeypot, stock or price changes, missing profile) are logged as today and never sent to Sentry.
- **AC-12**: Sentry emails you (the developer's Sentry account only) when a new issue appears and when a resolved issue comes back (a regression). A repeat of a known open issue does not email again. A second rule emails on every `order_save_failed` event, at most once per 30 minutes. Both rules are set up in Sentry's dashboard and written down in `docs/runbooks/monitoring.md`.
- **AC-13**: Only the production host reports. `isProductionHost` comes from `src/features/seo/indexing.ts` (pure, imported as is). On the server, `beforeSend` takes the host from the event's `host` tag, else from `request.url`. An event is dropped unless that host passes `isProductionHost`, and an event with no known host is dropped too. In the browser, Sentry starts only when `NEXT_PUBLIC_SENTRY_DSN` is set and `window.location.host` passes `isProductionHost`. With no DSN (local dev, CI check builds), nothing starts and nothing fails. `workers.dev` and branch previews stay silent.
- **AC-14**: No Sentry event carries a customer phone, address, name, or email, an IP address, cookies, request headers (other than the user agent), request bodies, or query strings. The scrubber in `src/lib/error-scrub.ts` runs as `beforeSend` on both sides. It walks every string in the event at any depth (exception values, messages, breadcrumbs, `extra`, `tags`, `contexts`, `fingerprint`, `transaction`, `request.url`), and on each one:
  - cuts a Drizzle `Failed query:` message after `params:` (Drizzle puts the query values there, which for an order insert are the phone and address);
  - cuts a Postgres `DETAIL:` line after `Key (` (it echoes the conflicting values);
  - turns Arabic digits into Western ones with `toWesternDigits` from `src/lib/arabic.ts`, then masks every run of 8 or more digits, which may have a leading `+` and spaces, dashes, dots, or brackets between them (phone numbers), as `[digits]`;
  - masks the segment after `/orders/`, `/checkout/done/`, and `/admin/orders/`, and any `number=` query value, as `[order]`;
  - strips the query string from `request.url`, `transaction`, and breadcrumb URLs.

  It also drops `request.data`, `request.cookies`, `request.query_string`, all headers except `user-agent`, `user.ip_address`, and the local variables (`vars`) of every stack frame. Linked `cause` errors are scrubbed like the main one, never sent raw. Tests cover a Drizzle insert error, a Postgres unique key `DETAIL`, a Zod error message carrying an input value, a postgres.js error with a value in its message, and phones written `٠٥٩٩١٢٣٤٥٦`, `059-912-3456`, `(059) 912.3456`, and `+970 59 912 3456`.

  The Sentry user is the Supabase account id only, set on the server where `getClaims()` resolves a user, with a `role` tag (`customer`, `electrician`, `admin`) from `readProfileRole` in `src/server/auth/admin.ts`, set where the role is already read for the request. No extra query is added just to tag Sentry. Guests and all browser events carry no user. `sendDefaultPii` stays `false`.
- **AC-15**: Sentry collects errors only: `tracesSampleRate` is 0, and there is no session replay, profiling, Sentry logs, or crons monitoring. The client bundle includes no replay integration.

*Privacy and finish*

- **AC-16**: The runbook gives the Arabic paragraph below for the privacy page. The owner pastes it into the privacy policy through the spec 0025 editor before go live. No code or migration writes it.

  > نستخدم خدمة Cloudflare Web Analytics لعدّ زيارات صفحات المتجر العامة، دون ملفات تعريف الارتباط (الكوكيز) ودون جمع أي بيانات تعرّف بك. ونستخدم خدمة Sentry لتسجيل الأعطال التقنية في الموقع حتى نصلحها، ولا نرسل إليها رقم هاتفك أو عنوانك أو اسمك أو بريدك الإلكتروني. قد نرفق بالعطل رقمًا تعريفيًا داخليًا لحسابك فقط، لنعرف إن كان العطل يتكرر.

- **AC-17**: The stats page is Arabic, right to left, with every string in `ar.json`. It works at 390 and 1280 pixels wide, by keyboard alone, and passes axe. The chart has its text table alternative (as in AC-2), and every link has a name a screen reader can read.

## Decision

**Chosen option**: Cloudflare Web Analytics for visits, read into an Arabic admin page through the GraphQL Analytics API, plus Sentry (free Developer plan, `@sentry/nextjs`, errors only) for error alerts, with a shared scrubber and a production host gate.

**Implementation skills**: `sentry-nextjs-sdk` (`getsentry/sentry-agent-skills`, `.agents/skills/sentry-nextjs-sdk/`) · `sentry-cloudflare-sdk` (`getsentry/sentry-for-ai`, `.agents/skills/sentry-cloudflare-sdk/`) · `workers-best-practices`, `wrangler`, `cloudflare` (`cloudflare/skills`, `.agents/skills/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`). Later, for triage: `sentry-fix-issues` (`getsentry/sentry-agent-skills`, `.agents/skills/sentry-fix-issues/`).

Note: neither Sentry skill covers OpenNext by name, and their sample code sets `sendDefaultPii: true`. This spec overrides that (AC-14). Follow Sentry's guide for Next.js on Cloudflare Workers with OpenNext for the runtime wiring, and prove it in build task 1 before anything else depends on it.

## Rationale

Reasoning, options, and the choices made in the design conversation: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:
No new tables and no migration. Visits live in Cloudflare Web Analytics (its retention sets the history limit; 30 days fits well inside it). Errors live in Sentry. Top products join paths to the existing `products` table at read time (`id`, `slug`, `name`, and the `listedProduct` rule from `src/features/catalog/server/storefront-sql.ts`, so a hidden product never matches).

**State transitions**: none on our side. Sentry issues move new → resolved → regressed inside Sentry, and AC-12's alerts follow those moves.

**API surface**:

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/admin/stats` | Page (server rendered) | `period`: `today` \| `7d` \| `30d` (opt, default `7d`) | three sections: totals and day bars, top products, sources | `requireAdmin()` (admin, aal2) in the loader | per section failure (AC-7), not set up notice |
| `readStats(period)` in `src/features/stats/server/queries.ts` | Server function, `server-only` | resolved shop days | `{ visits, products, sources }`, each a `Result` | called only after `requireAdmin()` | `timeout`, `http_<status>`, `graphql`, `not_configured` |
| Cloudflare GraphQL `POST https://api.cloudflare.com/client/v4/graphql` | Outbound | `Authorization: Bearer CF_ANALYTICS_API_TOKEN`; `accountTag`, `siteTag`, `datetime_geq`, `datetime_lt`, the path exclusions | `rumPageloadEventsAdaptiveGroups` rows (`count`, `sum.visits`, dimensions) | token with Account Analytics Read only | 5 s timeout, non 200, `errors[]` in the body |
| `reportError(event, error, details?)` in `src/server/monitoring/report.ts` | Server helper | `event`: snake case name, `error`: unknown, `details`: flat primitives | a log line and a Sentry event | none (server only) | never throws, even if Sentry fails |
| `scrubEvent(event, siteUrl)` and `shouldReport(host, siteUrl)` in `src/lib/error-scrub.ts` | Pure functions | a Sentry event; a host | the scrubbed event, or `null` to drop | none | none |
| `onRequestError` in `instrumentation.ts` | Next.js hook | thrown error, request info | a Sentry event | none | none |

The three Cloudflare queries (one per section) run in parallel with `Promise.allSettled`. Each section's `Suspense` child awaits its own result from that one call. Query shapes:
- visits: grouped by `datetimeHour` only, limit 800 (30 shop days span at most 744 hours);
- top products: grouped by `requestPath`, filter `requestPath_like: "/p/%"`, ordered by `count` desc, limit 50;
- sources: grouped by `refererHost`, ordered by `sum.visits` desc, limit 50 (room for grouping into 10 labels).

All three share the private path exclusions, one `requestPath_notlike` per prefix, combined with `AND`. The window is `[shopDayStart(from), shopDayStart(to + 1 day))`, at most 30 days and a few hours, which must fit inside Cloudflare's query window and retention for this plan. Exact field names (`rumPageloadEventsAdaptiveGroups`, `datetimeHour`, `requestPath`, `refererHost`, the `_like` and `_notlike` filters), the largest limit allowed, and the window cap are confirmed against the live API in build task 2, with the Cloudflare GraphQL MCP when it is connected. If the window cap is shorter, `30d` is split into two queries and merged.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Stats page | period | `?period=` parsed by `parseStatsPeriod` (new, pure), unknown → `7d` |
| Stats page | today's shop day, the day list | `shopDateKey(new Date())` and `resolvePeriod` in `src/features/reports/period.ts`; `addDaysToKey` for the list |
| GraphQL query | `datetime_geq`, `datetime_lt` | `shopDayStart(from)` and `shopDayStart(addDaysToKey(to, 1))`, as UTC ISO strings |
| GraphQL query | `accountTag`, `siteTag`, token | `CF_ACCOUNT_ID`, `CF_WEB_ANALYTICS_SITE_TAG`, `CF_ANALYTICS_API_TOKEN` via `serverEnv()` |
| Visits section | page views total | sum of `count` over the period's rows |
| Visits section | visits total | sum of `sum.visits` |
| Visits section | per day bars | rows grouped by `datetimeHour`, each hour mapped to a shop day with `shopDateKey`, zero filled for days with no rows (Cloudflare's `date` dimension is a UTC day, so it is not used) |
| Visits section | day labels, numbers | `formatDayShort`, `formatNumber` in `src/lib/format.ts` |
| Top products | path list | rows grouped by `requestPath`, filter `requestPath_like: "/p/%"`, ordered by `count` desc, limit 50 (room to drop stale ones and still fill 10) |
| Top products | slug | `requestPath` minus `/p/`, then the product page's slug decoding (moved from `src/app/[locale]/p/[slug]/page.tsx` to `src/features/catalog/slug.ts` and shared) |
| Top products | name, id | `products` by slug, `listedProduct` rule, one `inArray` query |
| Sources | label | `referrerLabel(host, siteHost)` (new, pure) over `refererHost`, then rows with the same label summed |
| Sources | own host | `new URL(parsePublicEnv().siteUrl).host` |
| Beacon | token | `NEXT_PUBLIC_CF_BEACON_TOKEN` via `parsePublicEnv()` (optional field) |
| Beacon, Sentry client | production or not | `isProductionHost(window.location.host, siteUrl)` |
| Sentry server | production or not | `isProductionHost(new URL(event.request.url).host, siteUrl)` in `beforeSend` |
| Sentry | release | `SENTRY_RELEASE` = `github.sha`, set in the deploy build and read by `withSentryConfig` |
| Sentry | user id, role | `getClaims()` `sub` in `src/server/auth/session.ts`; role from `readProfileRole` in `src/server/auth/admin.ts` |
| Sentry server | host for the gate | `host` tag set by `reportError` from `headers()`, else `event.request.url`; none → drop |
| `reportError` | rate limit state | in memory map of event name → last send time, per Worker instance, one minute window |
| `reportError` | fingerprint | the `event` argument |
| Order save alert | event name, tag | `order_save_failed`, `area: checkout`, fixed in the checkout action |

**Key invariants**:
- No Sentry event leaves the browser or the Worker without passing `scrubEvent`. `beforeSend` returns its result, or `null` when `shouldReport` is false.
- `scrubEvent` is pure, unit tested with real samples (a Drizzle insert error carrying a phone and an address, a Postgres unique key `DETAIL`, an order page URL, a `?number=` lookup), and never throws. If scrubbing itself fails, the event is dropped.
- `reportError` never throws and never changes the caller's result. A Sentry outage only loses the Sentry copy; the log line still lands in Workers Logs.
- The Cloudflare token is read only on the server, never logged, never sent to the browser. It has the Account Analytics Read permission and nothing else.
- The stats loader calls `requireAdmin()` before any outbound call.
- The private path exclusions live in one list (`STATS_EXCLUDED_PREFIXES` in `src/features/stats/query.ts`) used by all three queries.
- `console.error` is reached only through `reportError` (enforced by the AC-10 test).
- The project rule tests still hold: no time zone name, `Intl`, or `toLocale*` outside `src/lib/format.ts` (including the GraphQL stub and the new tests), and the chart and pages use design tokens only.

**Security model**:
- `/admin/stats` is admin only (role `admin` and `aal2`), checked in the layout and again in the loader, as every admin read with a secret must be.
- The beacon is public by design. Its token only identifies the site, and it collects page path, referrer host, country, and device class, with no cookies and nothing personal.
- The Sentry DSN is public by design (it only allows sending events). Abuse is limited by Sentry's own rate limits and the free plan's spike protection. The auth token that uploads source maps is a CI secret, never in the Worker.
- Compliance scope: no formal regime applies to this shop, but the project rule "never log customer phone or address" now extends to third parties (AC-14), and the privacy page says what is shared (AC-16).

**Configuration required**:
- `NEXT_PUBLIC_SENTRY_DSN`: Sentry project DSN. A build value (GitHub repository variable, set only for the deploy job), optional in `parsePublicEnv()`. Unset turns Sentry off.
- `SENTRY_AUTH_TOKEN`: Sentry token with project release and source map write rights. A secret in the GitHub `production` environment, used only by the deploy build.
- `SENTRY_ORG`, `SENTRY_PROJECT`: Sentry org and project slugs. GitHub repository variables.
- `NEXT_PUBLIC_CF_BEACON_TOKEN`: the Web Analytics site token for the beacon. A build value, optional in `parsePublicEnv()`. Unset leaves the beacon out.
- `CF_ACCOUNT_ID`, `CF_WEB_ANALYTICS_SITE_TAG`: account and site ids for the GraphQL query. Not secret; `vars` in `wrangler.jsonc` and `.dev.vars.example`.
- `CF_ANALYTICS_API_TOKEN`: Cloudflare API token with Account Analytics Read only. A Worker secret (`pnpm wrangler secret put CF_ANALYTICS_API_TOKEN`).
- `CF_GRAPHQL_URL`: optional override of the GraphQL endpoint, defaulting to `https://api.cloudflare.com/client/v4/graphql`. Only e2e sets it, pointing at a local stub, so the page can be tested end to end without the real API. The schema accepts it only when its host is `127.0.0.1` or `localhost`, and rejects anything else at startup, so the bearer token can never be sent to an outside address.
- Prerequisites before build task 1: a Sentry account (the developer's) with one project for this shop; a Web Analytics site in the Cloudflare dashboard for the shop's domain, set to manual snippet; the API token above.

Shapes:
- **Server.** `parseServerEnv` in `src/server/env.ts` gains `cf: { accountId, siteTag, token, graphqlUrl } | null`. All three of `CF_ACCOUNT_ID`, `CF_WEB_ANALYTICS_SITE_TAG`, and `CF_ANALYTICS_API_TOKEN` set and non empty gives the object, none set gives `null` (the "not set up" notice), and a partial set fails fast at startup with a message naming the missing ones.
- **Public.** `parsePublicEnv` in `src/lib/public-env.ts` gains `sentryDsn: string | null` (a URL when set) and `cfBeaconToken: string | null`, both read as literal `process.env.NEXT_PUBLIC_*` entries in its explicit default object so Next inlines them. Add both to `.env.example` (empty) and leave them unset in the CI check build env.
- **Browser init.** `instrumentation-client.ts` and the beacon component read the inlined values through a guard that cannot throw (a parse failure means "off", never a crash).

Run `pnpm cf-typegen` after adding the `vars`.

**Critical test scenarios**:
- Happy path: with the GraphQL stub returning fixed rows, `/admin/stats?period=30d` shows the totals, 30 day bars with a zero day, top products in order with a stale slug dropped, and sources grouped under Facebook and مباشر. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**.
- Scrubber: a Drizzle `Failed query: insert into "orders" ... params: 0599123456,Hebron, Ein Sara St` error comes out with no digits run and nothing after `params:`. An event from `/orders/1042?number=1042` comes out with `[order]` in both places and no query string. Verifies **AC-14**.
- Production gate: `shouldReport` is false for `skf-pro.<account>.workers.dev`, a branch preview, `www.` and `localhost`, and true only for the `NEXT_PUBLIC_SITE_URL` host. The beacon script is absent in e2e (a non production host) and on `/admin/stats`. Verifies **AC-6**, **AC-13**.
- Failure case: the stub fails the sources query and delays the products query past 5 seconds. Visits still show, the other two sections show their message and retry link, and `reportError` is called twice with `stats_read_failed`. With the three `CF_*` values unset, the page shows the "not set up" notice. Verifies **AC-7**.
- Order failure: a forced database error in the order insert returns `save_failed` to the shopper and calls `reportError("order_save_failed", ...)`. A rate limited attempt does not call it. Verifies **AC-10**, **AC-11**.
- Auth/permission: a signed in customer and an admin without `aal2` are sent away from `/admin/stats` by the layout, and calling the loader directly without admin throws before any outbound fetch. Verifies **AC-1**.
- Live proof (manual, recorded in `verify.md`): on the production host, a test route throws on the server and a test button throws in the browser. Both arrive in Sentry with readable stack traces, the release, and no user data beyond an id, and the new issue email arrives. The test route and button are removed after. Verifies **AC-8**, **AC-9**, **AC-12**.

## Build plan

Tracer Bullet: two thin threads first (an error from workerd to your inbox, a visit from the storefront to the stats page), then each is thickened end to end.

1. **Errors thread.** Add `@sentry/nextjs`, `instrumentation.ts` (server init for the `nodejs` runtime that OpenNext runs, `onRequestError`), `sentry.server.config.ts`, the optional env fields, and `src/lib/error-scrub.ts` with `shouldReport` and the URL and request parts of `scrubEvent`, all unit tested. Prove on `pnpm preview` (workerd) with a temporary dev DSN and the local host allowed that a thrown server error reaches Sentry and flushes before the request ends, both through `onRequestError` and through a test call that sends with `ctx.waitUntil(Sentry.flush(2000))` (the path `reportError` uses). If it does not, fall back to `@sentry/cloudflare` `withSentry` around a custom OpenNext worker entry (OpenNext supports wrapping `.open-next/worker.js`) and record that in this spec before going on. Satisfies **AC-8**, **AC-13**, **AC-15**.
2. **Stats thread.** Beacon component in the storefront layout behind the token and the host check. `routes.admin.stats`, the `stats` sidebar link, the page with `requireAdmin()` in its loader, and a `7d` visits total from one GraphQL query with the private path exclusions. Confirm the GraphQL field names against the live API. Satisfies **AC-1**, **AC-5**, **AC-6**.
3. **reportError everywhere.** `src/server/monitoring/report.ts`, every server `console.error` switched to it, the Vitest rule, the `order_save_failed` report in the checkout action, and the Sentry user id and role tag set where `getClaims()` resolves. Finish `scrubEvent` (Drizzle `params:`, Postgres `DETAIL`, digit runs, extras, breadcrumbs) with the real samples as tests. Satisfies **AC-10**, **AC-11**, **AC-14**.
4. **Browser errors.** `instrumentation-client.ts` (init only with a DSN on the production host, errors only, the ignore rules), `src/app/global-error.tsx`, and `captureException` in the two existing error boundaries. Satisfies **AC-9**, **AC-13**, **AC-14**, **AC-15**.
5. **Stats thickened.** `parseStatsPeriod`, the period chips, the hour to shop day bucketing with zero fill, the chart and its table alternative, the top products query with the slug join (moving slug decoding to `src/features/catalog/slug.ts`), and `referrerLabel` with the WhatsApp note. Pure parts unit tested. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**.
6. **Stats states.** The 5 second timeout, per section `Result` and messages, retry links, the "not set up" notice, skeletons, and `stats_read_failed` reports. Satisfies **AC-7**.
7. **Deploy and alerts.** Wrap `next.config.ts` with `withSentryConfig` only when `SENTRY_AUTH_TOKEN` is set, so check builds stay plain. The plugin uploads during the Next build inside `pnpm run deploy` and deletes the source maps after upload, before OpenNext bundles and Wrangler deploys, so they are never served. Confirm in the live proof that server stack traces map through the OpenNext bundle. Add the deploy job env (`SENTRY_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_CF_BEACON_TOKEN`, `SENTRY_RELEASE: ${{ github.sha }}`), all in the job that runs `pnpm run deploy`. Write `docs/runbooks/monitoring.md`: Sentry project and the two alert rules, the Web Analytics site (manual snippet), the API token, the secrets, and the privacy paragraph. Run the live proof and record it in `verify.md`. Satisfies **AC-8**, **AC-12**, **AC-16**.
8. **Finish.** Playwright on 390 and 1280 with axe against the GraphQL stub (`CF_GRAPHQL_URL`, started by the Playwright web server config): happy path, a failed section, not set up, keyboard through chips and links. Remaining unit tests. Satisfies **AC-17**, **AC-1** to **AC-7**.

## Consequences

**Positive**:
- The owner reads visits and top products in Arabic without an extra login or an English dashboard.
- Errors that today vanish into Workers Logs (caught failures behind friendly messages) now reach you once per kind, with a stack trace.
- One `reportError` call replaces scattered `console.error` lines, so every unexpected failure is logged and reported the same way.
- No new monthly cost: Web Analytics is free and Sentry's Developer plan is free.

**Negative / tradeoffs**:
- Counts are low: ad blockers and privacy browsers block the Cloudflare beacon, and Cloudflare samples data at high volume. Treat the numbers as a trend, not an exact count.
- "Where visitors come from" cannot see WhatsApp in most cases, because the WhatsApp app sends no referrer. The channel the shop relies on most shows up as direct.
- Private paths still reach Cloudflare's analytics (the beacon follows in app navigation); they are only filtered out of what the page shows. Cloudflare already serves and logs every request as the host, so no new party learns anything, but the data is there: anyone with access to the Cloudflare account can see order numbers in the Web Analytics path list. Keep that account's members to the developer and the owner.
- `reportError` keeps a small in memory rate limit map per Worker instance, a deliberate exception to the no shared mutable state rule. A second instance may send its own event in the same minute, which is fine.
- Ad blockers also block Sentry's browser ingest, so some browser errors never arrive. No tunnel route is added at launch.
- Sentry on OpenNext on Workers is the least proven part of this stack, which is why build task 1 proves it first and names a fallback.
- The free plan has one user and a monthly error quota. A loud bug can use the quota up, and later errors that month are dropped until it resets.
- History stops at Cloudflare's retention. There is no copy in Postgres.

**Neutral**:
- About 23 files change to use `reportError`, a wide but mechanical diff.
- Source maps upload only from the deploy job, so a check build has none (and needs none).
- `src/features/catalog/slug.ts` becomes the one place slugs are decoded.

## Follow-up

- [ ] Connect the MCP servers you chose (your own config step): `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp` and `claude mcp add --transport http cloudflare-graphql https://graphql.mcp.cloudflare.com/mcp`, then sign in through `/mcp`. Both URLs came from directories, not the vendors' own docs, so check them on `getsentry/sentry-mcp` and `cloudflare/mcp-server-cloudflare` first.
- [ ] Root `AGENTS.md` `## Agent skills` should list `sentry-nextjs-sdk`, `sentry-cloudflare-sdk`, and `sentry-fix-issues` (installed 2026-11-06), with `sentry` and `cloudflare-graphql` on the MCP servers line. `/sync` owns that.
- [ ] Root `AGENTS.md` `## Rules`: the Errors rule should say unexpected failures go through `reportError` (never `console.error`), and the Env rule should say no customer data reaches Sentry or analytics. These are project wide, so they belong at root.
- [ ] Spec 0001's Observability row says the tools are chosen in feature 29; amend it to point here once this spec is accepted.
- [ ] If the owner wants to know how many visits WhatsApp brings, consider a share path that carries the source (for example the product share button adding a marker the beacon can see). Not in scope here.
- [ ] Revisit a Sentry tunnel route (`tunnelRoute`) if browser errors are clearly missing after launch; it routes browser reports through the Worker, around ad blockers, at the cost of Worker requests.
