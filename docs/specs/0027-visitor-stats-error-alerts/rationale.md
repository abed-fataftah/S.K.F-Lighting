# 0027. Visitor stats and error alerts: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file says why.

## Context

> ⚠️ Premise note: the shop's main share channel is WhatsApp, and the WhatsApp app usually opens links with no referrer (the header that says which site sent the visitor). Any referrer based "where visitors come from" view will show most WhatsApp traffic as direct. The sources list is still worth having for Google and Facebook, but it should not be read as proof that WhatsApp brings no one. The spec says so on the page itself (AC-4) and leaves a source marker on share links as a follow up.

Scope feature 29 asks for two things before launch: the owner should see visits and popular products, and a failure on the live site should reach someone who can fix it. It adds one hard limit: no customer phone or address may be sent to the services that do this. Today the site has Workers Logs (spec 0001) and structured JSON `console` lines, and nothing else. Nobody is told when something breaks. Most unexpected failures are caught, logged, and turned into a friendly message (the typed result rule in `AGENTS.md`), so a broken catalog read or a failed order save is invisible unless someone goes looking in the logs.

The people involved are different. The owner reads Arabic, is not technical, and already uses the `/admin` dashboard daily (orders, Reports from spec 0024). The developer fixes code and is the right person to get stack traces. The shop is small: a few hundred visits a day at launch, one owner, a budget of about $30 a month (spec 0001), and no time for a new system to run.

The platform shapes what is possible. The site runs as one Worker on Cloudflare through OpenNext, with DNS on Cloudflare. Pages render on each request, client navigation uses the Next.js router, and private pages carry sensitive values in their paths (order numbers, half of the guest lookup key from spec 0015). Error messages from the database layer can carry query values: Drizzle's `Failed query` message lists the parameters, and for an order insert those are the customer's phone and address. Preview builds (`workers.dev`, branch previews) run the same code as production and must not pollute numbers or alerts; spec 0026 already defines the production host check.

Without a decision, the shop launches blind: no sense of which products draw interest, and failures found only when a customer complains on WhatsApp, if they bother.

## Options considered

### Visits

#### Option A1: Cloudflare Web Analytics, read through the GraphQL Analytics API

A small beacon script on storefront pages, cookieless, free, on the platform the shop already uses. The admin page queries the account's GraphQL API with a read only token.

**Pros**:
- No cost, no new vendor, no consent banner.
- Path, referrer host, and visit counts are exactly the dimensions the page needs.
- The API lets the owner see it all in Arabic inside `/admin`.

**Cons**:
- Ad blockers hide some visits, and data is sampled at volume.
- No unique visitor figure (by design, it has no cookies).
- The beacon follows in app navigation, so private paths reach it and must be filtered in queries.
- History is bounded by Cloudflare's retention.

#### Option A2: Workers Analytics Engine, counted on the server

The Worker writes a data point per page render and the admin page queries it with SQL.

**Pros**:
- No browser script, so ad blockers do not affect it.
- Exact control over which paths are counted (private ones never written).

**Cons**:
- Every render counts, including bots, crawlers, and router prefetches; filtering them well is real work.
- Visits and unique visitors need a hashed daily identifier built from IP and user agent, which is personal data handling we would own.
- More code on the hot path of every page.

#### Option A3: Plausible Cloud

A hosted, cookieless analytics product with a clean Stats API, hosted in the EU.

**Pros**:
- Best referrer and campaign reporting of the options, with a simple API.
- Mature and privacy focused.

**Cons**:
- About $9 a month, a second analytics bill and vendor.
- Same ad blocker loss as any browser script.

#### Option A4: Umami Cloud

A hosted, cookieless analytics product with a free tier and an API.

**Pros**:
- Free at this volume, with an API.

**Cons**:
- Another vendor, and free tier limits can change.
- Same ad blocker loss as A1, with no advantage over A1 on this platform.

### Errors

#### Option E1: Sentry, free Developer plan, errors only

`@sentry/nextjs` on the server and in the browser, with source maps, issue grouping, and email alerts.

**Pros**:
- Server and browser errors in one place, grouped, with readable stack traces.
- Alerts on new issues and regressions come built in.
- A `beforeSend` hook gives one place to scrub every event.
- Free at this volume.

**Cons**:
- Its support for OpenNext on Workers is the least proven piece of the stack.
- One more vendor that receives data, so scrubbing must be strict.
- The free plan's monthly quota can run out during a loud bug.
- Ad blockers block part of the browser reports.

#### Option E2: Build it on Workers Logs and Resend

A Tail Worker (a Worker that receives another Worker's logs and exceptions) or a log filter emails the developer through Resend, which already sends the auth mail.

**Pros**:
- No new vendor; data stays with Cloudflare and Resend.
- Full control over what is sent.

**Cons**:
- Grouping, deduplication, rate limits, and "new versus seen before" logic are all ours to build and maintain.
- Browser errors need a custom report endpoint.
- No source map support, so server stack traces point into the OpenNext bundle.

#### Option E3: Workers Logs only, checked by hand

Keep what exists and look at the logs when something seems wrong.

**Pros**:
- Nothing to build or pay for.

**Cons**:
- Nothing reaches anyone, which fails the scope's "reaches you" bar outright.

## Rationale

**Visits: A1, Cloudflare Web Analytics.** The forces are a tiny budget, one non technical owner, and a platform that already runs on Cloudflare. A1 costs nothing, adds no vendor, needs no consent banner, and gives exactly the three things the owner asked for (visits per day, top products, sources). Its known weakness, undercounting from ad blockers and sampling, does not matter for the question the owner is asking ("which products draw interest, and is traffic going up?"); a trend is enough. A2 would count more accurately but turns a reporting feature into a bot filtering and visitor hashing project, which is the opposite of boring. A3 has the best referrer data, but referrers are already limited by WhatsApp's behaviour (the premise note), so the extra $9 a month buys little here.

**Errors: E1, Sentry.** The scope asks for an error that reaches you "with enough detail to fix it". Grouping, regression detection, and source mapped stack traces are what make an alert actionable rather than noise, and E2 would mean building all three. Sentry's risk on this stack is real, so the spec makes it the first build task, with a named fallback (`@sentry/cloudflare` around a custom OpenNext worker entry). The privacy limit is met by design, not by trust: one pure scrubber runs on every event on both sides, and its tests use the exact leak this codebase can produce (a Drizzle insert error carrying a phone and an address).

**Choices made in the design conversation.** The engineer chose each of these from options with a recommendation, and the spec follows them:
- Stats shown on a new Arabic `/admin/stats` page, separate from Reports (money reports keep their own counting rules from spec 0024).
- Visits per day, top products, and sources. Searches with no results were offered and left out.
- Fixed periods (today, 7 days, 30 days), which always fit the API's limits, live on each load with no cache (one owner, a few views a day, matching spec 0001's no shared caching rule).
- Alerts go to the developer only. Server errors, browser errors, and unexpected order save failures are reported; expected refusals are not.
- Sentry emails on a new issue and on a regression, errors only (no traces or replays, which also keeps checkout fields out of reach).
- Production host only, for both tools.
- Private pages kept out of the numbers by filtering in the queries. The engineer weighed this against forcing full page loads into private pages (truly keeps the paths away from Cloudflare, costs a reload on every account and order link) and against turning off in app tracking (would break top products). Since Cloudflare already serves and logs every request as the host, filtering adds no new exposure.
- Stale or hidden product slugs dropped from top products, the list filled from the next.
- Sentry knows the account id and role only, never contact details, and order numbers are masked in every URL.
- Caught failures reach Sentry through one `reportError` helper with a fingerprint per event name, rather than automatic `console.error` capture (grouping by message text would split one bug into many issues, and scrubbing would have to parse our JSON lines).
- No new tables, so history is bounded by Cloudflare's retention.
- The privacy page gets an Arabic paragraph the owner pastes in, not a migration.

**Calls made while writing the spec** (the engineer did not weigh in on these):
- **Per day bars from hourly rows, bucketed into shop days in code.** Cloudflare's `date` dimension is a UTC day, which would put late evening Hebron visits on the wrong day. Runner up: accept UTC days (simpler, wrong for 2 to 3 hours each night).
- **No unique visitors figure.** A cookieless counter cannot tell people apart, so showing one would mislead. Runner up: label Cloudflare's visits as visitors (it is not the same thing).
- **Referrer grouping by a small fixed host list** (Google, Facebook, Instagram, WhatsApp, direct), other hosts shown raw. Runner up: show raw hosts only (`l.facebook.com` and `m.facebook.com` as separate rows confuse a non technical reader).
- **A separate alert for `order_save_failed`, every event, at most once per 30 minutes.** A lost order is lost money, so it should not wait for "new issue" logic once the issue exists. Runner up: rely on the regression rule only.
- **Scrubbing rules:** cut Drizzle `params:`, cut Postgres `DETAIL: Key (`, mask runs of 8 or more digits, mask order segments and `number=`, drop bodies, cookies, query strings, and headers except the user agent. A long product code may get masked too; that is an acceptable loss. Runner up: an allowlist of event fields (stricter, but drops the context that makes an error fixable).
- **No Sentry tunnel route at launch.** It sends browser reports through the Worker around ad blockers, but adds a rewrite on OpenNext and Worker requests. Runner up: add it now. Kept as a follow up.
- **Sentry user set only on the server.** Passing the account id to the browser to tag client errors would put it in page data for little gain. Runner up: tag browser events too.
- **A `CF_GRAPHQL_URL` override for e2e.** The project bar is unit plus e2e before done, and a server side fetch cannot be intercepted by Playwright. A local stub makes the page testable end to end. Runner up: e2e only the "not set up" state (leaves the real rendering untested in a browser).
- **Errors are reported, but `console.error` stays as the log line inside `reportError`.** Workers Logs remain the full record (spec 0001); Sentry is the alerting copy.
