# Site & launch

Part of the [S.K.F Lighting scope](index.md). Shop details, public pages, being found, and going live.

## Slice 8: Site

### 26. Shop settings & policy pages · in-progress
Edit shop contact details, WhatsApp number, and delivery fees in the dashboard, plus privacy, terms, and return policy pages in Arabic.
**Done when:** changing the WhatsApp number or a delivery fee updates the whole site, and the policy pages are linked from the footer and checkout.
spec [0025](../specs/0025-shop-settings-policy-pages/index.md) · code in `src/features/settings/`, `src/features/policies/`, `src/app/admin/(dashboard)/settings/`, `src/app/[locale]/policies/`
- [x] Design it (spec): `/architect shop settings & policy pages`
- [x] Build it: `/develop shop settings & policy pages`
  - [x] Thin thread: migration (`pages`, drafts, fee check), settings hub with the contact card, WhatsApp number from the database with the env fallback on every storefront link (AC-1, AC-2, AC-3, AC-4, AC-14, AC-15)
  - [x] Delivery zones: edit, add (up to 10), pause and resume, fee rules, checkout and Home follow (AC-5, AC-6, AC-7)
  - [x] Policy pages: `react-markdown` body, `/policies/[slug]` with tabs, date, and WhatsApp card, then the editor with preview and the version check (AC-8, AC-9, AC-10, AC-11, AC-13)
  - [x] Checkout policy line and the remaining tests on a phone sized RTL screen (AC-12, AC-1 to AC-15)
- [x] Verify it: `/check verify shop settings & policy pages`
- [ ] Test it: `/test shop settings & policy pages`

### 28. Search engine visibility · in-progress
Product and category pages that search engines can read in Arabic, with good share previews on WhatsApp and Facebook.
**Done when:** each public page has its own Arabic title, description, and share image, a site map lists every product, and private pages (dashboard, orders) stay hidden.
spec [0026](../specs/0026-search-engine-visibility/index.md) · code in `src/features/seo/`, `src/app/robots.txt/`, `src/app/sitemap.xml/`, `src/proxy.ts`
- [x] Design it (spec): `/architect search engine visibility`
- [x] Build it: `/develop search engine visibility`
  - [x] Thin thread: share helper and builders, layout defaults, product share tags, robots, a products only sitemap, the shop and logo images (AC-1, AC-5, AC-6, AC-13, AC-14)
  - [x] Preview host guard: host check, `X-Robots-Tag` on every proxy path, robots and sitemap off the production host (AC-2)
  - [x] Full live sitemap: home, `/c`, categories, policies, `lastmod`, the 503 path (AC-3, AC-4)
  - [x] Remaining pages: home title and Store block, `/c`, category images, policy descriptions (AC-7, AC-8, AC-9, AC-10, AC-11)
  - [x] End to end on a phone sized RTL screen, private pages stay `noindex` (AC-12, AC-1 to AC-14)
- [ ] Verify it: `/check verify search engine visibility`
- [ ] Test it: `/test search engine visibility`

### 29. Visitor stats & error alerts · in-progress
See visits and popular products, and get told when something breaks.
**Done when:** you can see visits and top products, an error on the live site reaches you with enough detail to fix it, and no customer phone or address is sent to these services.
spec [0027](../specs/0027-visitor-stats-error-alerts/index.md) · code in `src/features/stats/`, `src/server/monitoring/`, `src/lib/error-scrub.ts`, `src/app/admin/(dashboard)/stats/`, `src/instrumentation.ts`, `src/instrumentation-client.ts`, `src/sentry.server.config.ts`, `src/app/global-error.tsx`
- [x] Design it (spec): `/architect visitor stats & error alerts`
- [ ] Build it: `/develop visitor stats & error alerts`
  - [x] Two thin threads: Sentry proven on workerd (server error flushed, production gate), and the beacon plus `/admin/stats` with a 7 day total (AC-1, AC-5, AC-6, AC-8, AC-13, AC-15)
  - [x] `reportError` everywhere: the helper, every `console.error` switched, the rule test, `order_save_failed`, the full scrubber with real leak samples (AC-10, AC-11, AC-14)
  - [x] Browser errors: client init, `global-error.tsx`, the two error boundaries report (AC-9, AC-13, AC-14, AC-15)
  - [x] Stats page done properly: periods, day bars with table, top products join, sources, per section failures and not set up state (AC-1 to AC-4, AC-7)
  - [ ] Deploy and finish: source maps and release, the two alert rules, the monitoring runbook with the privacy paragraph, the live proof, Playwright on 390 and 1280 with axe (AC-8, AC-12, AC-16, AC-17)
- [ ] Verify it: `/check verify visitor stats & error alerts`
- [ ] Test it: `/test visitor stats & error alerts`

## Launch

### 30. Go live · in-progress
Put the site on its real address with backups and a final check before customers arrive.
**Done when:** the site runs on the shop's domain over a secure connection, data is backed up daily and a restore has been tried, and the main pages pass an accessibility and phone speed check.
spec [0028](../specs/0028-go-live/index.md) · code in `src/features/launch/`, `scripts/backup-run.ts`, `scripts/restore-drill.ts`, `scripts/launch-check.mts`, `.github/workflows/backup.yml`, `.github/workflows/restore-drill-reminder.yml`, `e2e/go-live.spec.ts`, `docs/runbooks/go-live.md`
- [x] Design it (spec): `/architect go live`
- [ ] Build it: `/develop go live`
  - [x] Backup thread: weekly encrypted dump of the database and sign in rows, manifest last, local restore drill that matches every count (AC-4, AC-5, AC-9, AC-10)
  - [x] Backup guards and alerts: photo copy to R2 with its guard, lifecycle rules, Sentry cron monitor, quarterly drill reminder (AC-6, AC-7, AC-8, AC-11)
  - [x] Phone speed and accessibility: `launch:check` on seven pages with the pass bar, and the axe spec in CI (AC-12, AC-13, AC-14, AC-15)
  - [ ] Go live runbook and launch: the ordered checklist, domain and `www`, email, uptime, smoke test, results and drill log, quiet launch (AC-1, AC-2, AC-3, AC-16 to AC-20)
- [ ] Verify it: `/check verify go live`
- [ ] Test it: `/test go live`
