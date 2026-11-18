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

### 36. Storefront desktop & tablet layout · in-progress · from spec 0029
Give every storefront page a real tablet and desktop layout (one row desktop header with a category bar, wider grids, a filter column, two column product, cart, and checkout, a quick order table) while phones stay exactly as they are.
**Done when:** no storefront page shows the narrow 480px strip on a tablet or laptop, nothing scrolls sideways from 768 to 1920px wide, and every phone test passes unchanged.
spec [0029](../specs/0029-storefront-desktop-layout/index.md) · code in `src/components/page-frame.tsx`, `src/app/tokens.css`, `src/features/shell/`, `src/features/catalog/components/`, `e2e/storefront-layout.spec.ts`
- [x] Design it (spec): `/architect storefront desktop & tablet layout`
- [x] Build it: `/develop storefront desktop & tablet layout`
  - [x] Thin thread: tokens and breakpoint lock, `PageFrame`, full width shell, desktop header and category bar, wide category page, tablet Playwright project (AC-1 to AC-9, AC-19 to AC-22)
  - [x] Browsing: category bar overflow, filter column, search and `/c` wide, product page two columns, wide Home (AC-5, AC-9 to AC-13, AC-20)
  - [x] Buying: cart and checkout two columns, form and prose pages (AC-14, AC-17)
  - [x] Accounts: order details, my orders and drafts, quick order table, responsive sheet (AC-11, AC-15, AC-16, AC-18)
  - [x] Finish: drop `width="phone"`, axe and 200% zoom on all three widths, design docs updated (AC-21, AC-23)
- [ ] Verify it: `/check verify storefront desktop & tablet layout`
- [ ] Test it: `/test storefront desktop & tablet layout`

### 38. Dashboard on phone and tablet · planned · needs a decision
Real phone and tablet layouts for every dashboard page, so you can run orders and products from your phone: the sidebar becomes a drawer or bottom bar, tables turn into cards or scroll inside their own box, and KPI cards, form rows, and detail columns stack. Desktop stays as designed.
**Done when:** every dashboard page works at 390 and 820px with no sideways page scroll, every control is at least 44px, the sidebar's unseen orders count stays reachable, and axe passes on each page at both widths.
- [ ] Design it (spec): `/architect dashboard on phone and tablet`

### 39. Small phone, landscape & large monitor sweep · planned
Close the gaps spec 0029 left open on the storefront: small phones from 320px, phones held sideways, and monitors wider than 1920px. Runs after feature 36 is verified.
**Done when:** no storefront page scrolls sideways from 320 to 2560px wide, a phone in landscape (390px tall) keeps the header, bottom bar, and WhatsApp float usable, content stays centred at 1280px on a 2560px screen with the shell backgrounds full width, and the Playwright projects cover 320 and 2560.
- [ ] Build it: `/develop small phone, landscape & large monitor sweep`

### 43. Light hero & orange brand · in-progress · from spec 0032
The Home hero moves from the black band to a white surface, and the brand colour changes from yellow to orange (#F7931E) across the storefront, dashboard, logo, and link preview pictures; in code the colour is renamed `brand`. A dev only `pnpm media:samples` command gives local products and main categories glowing sample pictures until the real photos are uploaded.
**Done when:** no `yellow` name or value is left in the code, the logo and share pictures are orange, the hero and its fallback card are white at 390, 820, and 1280px with the orange marker under line 2, axe passes, and `media:samples` fills local pictures and refuses a non local database.
spec [0032](../specs/0032-light-hero-orange-brand/index.md)
- [x] Design it (spec): `/architect light hero and orange brand colour`
- [ ] Build it: `/develop light hero & orange brand`
  - [x] Brand token end to end: tokens, contrast table, every class, `cn()` names, gallery and Arabic copy, tests and docs (AC-1, AC-2, AC-4, AC-15)
  - [x] Logo and share pictures recoloured and made again (AC-3)
  - [ ] Light hero: surface, marker, white tint, dots, arrows, fallback card and chandelier, loading shape, hero flows (AC-5 to AC-13, AC-15)
  - [ ] Sample pictures command with guards and tests, run locally (AC-14, AC-15)
  - [ ] Finish: full suites, axe at three widths, Home screenshots against the mockup (AC-13, AC-15)
- [ ] Verify it: `/check verify light hero & orange brand`
- [ ] Test it: `/test light hero & orange brand`

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
