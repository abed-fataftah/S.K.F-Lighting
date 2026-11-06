# Site & launch

Part of the [S.K.F Lighting scope](index.md). Shop details, public pages, being found, and going live.

## Slice 8: Site

### 26. Shop settings & policy pages · in-progress
Edit shop contact details, WhatsApp number, and delivery fees in the dashboard, plus privacy, terms, and return policy pages in Arabic.
**Done when:** changing the WhatsApp number or a delivery fee updates the whole site, and the policy pages are linked from the footer and checkout.
spec [0025](../specs/0025-shop-settings-policy-pages/index.md) · code in `src/features/settings/`, `src/features/policies/`, `src/app/admin/(dashboard)/settings/`, `src/app/[locale]/policies/`
- [x] Design it (spec): `/architect shop settings & policy pages`
- [ ] Build it: `/develop shop settings & policy pages`
  - [ ] Thin thread: migration (`pages`, drafts, fee check), settings hub with the contact card, WhatsApp number from the database with the env fallback on every storefront link (AC-1, AC-2, AC-3, AC-4, AC-14, AC-15)
  - [ ] Delivery zones: edit, add (up to 10), pause and resume, fee rules, checkout and Home follow (AC-5, AC-6, AC-7)
  - [ ] Policy pages: `react-markdown` body, `/policies/[slug]` with tabs, date, and WhatsApp card, then the editor with preview and the version check (AC-8, AC-9, AC-10, AC-11, AC-13)
  - [ ] Checkout policy line and the remaining tests on a phone sized RTL screen (AC-12, AC-1 to AC-15)
- [ ] Verify it: `/check verify shop settings & policy pages`
- [ ] Test it: `/test shop settings & policy pages`

### 28. Search engine visibility · needs a decision
Product and category pages that search engines can read in Arabic, with good share previews on WhatsApp and Facebook.
**Done when:** each public page has its own Arabic title, description, and share image, a site map lists every product, and private pages (dashboard, orders) stay hidden.
- [ ] Design it (spec): `/architect search engine visibility`

### 29. Visitor stats & error alerts · needs a decision
See visits and popular products, and get told when something breaks.
**Done when:** you can see visits and top products, an error on the live site reaches you with enough detail to fix it, and no customer phone or address is sent to these services.
- [ ] Design it (spec): `/architect visitor stats & error alerts`

## Launch

### 30. Go live
Put the site on its real address with backups and a final check before customers arrive.
**Done when:** the site runs on the shop's domain over a secure connection, data is backed up daily and a restore has been tried, and the main pages pass an accessibility and phone speed check.
- [ ] Build it: `/develop go live`
