# Foundations

Part of the [S.K.F Lighting scope](index.md). The ground every later feature stands on, plus the first real order that proves it all connects.

## Foundation

### 1. Stack & architecture · in-progress
Choose the tools, hosting, and sign in approach, then set up a project that runs, so every slice builds on real structure.
**Done when:** the stack (including how sign in, photo and video storage, and hosting work) is recorded in a spec, and the empty project starts locally and builds cleanly.
spec [0001](../specs/0001-stack-architecture/index.md) · code in `src/`, `wrangler.jsonc`, `supabase/`
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Scaffold from the decision: `/develop stack & architecture`
- [x] Verify it: `/check verify stack & architecture`
- [x] Test it: `/test stack & architecture`

### 2. Coding standards & tooling · done
Record the project's conventions from the real setup, then install formatting, linting, and checks that run before each commit.
**Done when:** root `AGENTS.md` reflects the real stack, and formatting, linting, and commit checks run clean.
code in `.prettierrc.json`, `eslint.config.mjs`, `lint-staged.config.mjs`, `.husky/`, `.github/workflows/ci.yml`
- [x] Capture conventions and tooling choices: `/audit`
- [x] Install the tooling: `/develop tooling`

### 3. Data model · in-progress
The shape of everything the shop stores: products with size and colour options (each with its own price and availability), categories, users and roles, orders (guest, customer, and electrician on behalf of a customer), drafts, payments, coins, and returns.
**Done when:** the model supports every later slice without a breaking change, order lines keep the price at the time of ordering, and one line's price can be adjusted without touching the catalog.
spec [0002](../specs/0002-data-model/index.md) · code in `src/server/db/`, `src/features/orders/`, `drizzle/`, `scripts/`
- [x] Design it (spec): `/architect data model`
- [x] Build it: `/develop data model`
  - [x] Pure rules with unit tests: totals, order number, phone, slug (AC-6, AC-7, AC-10)
  - [x] Core schema and migration with the lockdown, signup trigger, and backfill (AC-1 to AC-5, AC-8, AC-9)
  - [x] Order number and totals helpers, plus database tests (AC-3 to AC-9)
  - [x] RLS check, dev seed, and a coverage review against the scope (AC-2, AC-11, AC-12)
- [x] Verify it: `/check verify data model`
- [x] Test it: `/test data model`
- [x] Review it: `/check review data model`

### 4. Design system & UI foundation · in-progress
A visual language and base components built right to left first, for phones first, and meeting a common accessibility standard (WCAG AA).
**Done when:** `design.md` covers type, colour, spacing, and components; base components work in Arabic, right to left, with clear focus and keyboard use.
spec [0003](../specs/0003-design-system-ui-foundation/index.md) · design in `docs/design/` · code in `src/app/`, `src/components/`, `src/features/shell/`
- [x] Design it (spec): `/architect design system & UI foundation`
- [x] Build it: `/develop design system & UI foundation`
  - [x] Thin thread: tokens, font, Tailwind lock, Button, gallery page, rule and contrast tests, axe in Playwright (AC-1 to AC-6, AC-19, AC-20)
  - [x] The rest of the shadcn primitives, restyled, with the field error pattern (AC-7, AC-8, AC-21)
  - [x] Custom controls, icons, and the WhatsApp link builder (AC-9, AC-10, AC-17)
  - [x] Shells on the real storefront: header, menu sheet, footer, bottom bar, float, sidebar (AC-11 to AC-18, AC-20)
- [x] Verify it: `/check verify design system & UI foundation`
- [x] Test it: `/test design system & UI foundation`

### 5. Arabic language · in-progress
The shop is Arabic only, right to left, for both the interface and product content. What is left to decide: digit style (Arabic or Western numerals), how prices and dates read, and Arabic text rules for product content.
**Done when:** every screen reads cleanly in Arabic, right to left, from one messages file; digit style and price and date formats are decided and applied; and Arabic is required for product content.
spec [0005](../specs/0005-arabic-language/index.md) · code in `src/lib/` (`format.ts`, `money.ts`, `arabic.ts`, `text-schemas.ts`), `src/language-rules.test.ts`
- [x] Design it (spec): `/architect arabic language`
- [x] Build it: `/develop arabic language`
  - [x] Thin thread: format functions and the shop time zone, proven on the gallery in a foreign browser (AC-1 to AC-8, AC-16)
  - [x] Arabic text rules: digit conversion, tidying, the Arabic letter check, search folding (AC-9 to AC-12)
  - [x] Wired into the spec 0004 forms and pages (AC-8 to AC-11, AC-14); the admin product form (`Philips 60W` e2e) and admin orders page land with feature 6's last milestone
  - [x] The guard: the language rule test and the message file checks (AC-13, AC-15)
- [ ] Verify it: `/check verify arabic language`
- [ ] Test it: `/test arabic language`

## Slice 1: First order end to end

### 6. First order end to end · in-progress
The thinnest real path through the whole shop: you sign in to the dashboard and add one simple product; a guest sees it, adds it to a cart, fills a short form, and sends the order. The order is saved, WhatsApp opens with the order message, and it appears in your dashboard. Rests on the foundation specs; no options, search, or accounts yet.
**Done when:** one real order goes from a product page to the dashboard and to a prefilled WhatsApp message with its order number, on a phone, in Arabic.
spec [0004](../specs/0004-first-order-end-to-end/index.md) · code in `src/features/cart/`, `src/features/checkout/`, `src/features/catalog/`, `src/features/orders/`, `src/features/admin-auth/`, `src/server/auth/admin.ts`, `src/app/[locale]/`, `src/app/admin/`, `scripts/admin-*.ts`, `drizzle/0004_first_order.sql`
- [x] Design it (spec): `/architect first order end to end`
- [x] Build it: `/develop first order end to end`
  - [x] Pure rules and the orders migration: money, cart and placed cookies, checkout and product schemas, W5 builder (AC-6, AC-9, AC-12, AC-14)
  - [x] Thin thread: one guest order on the dev seed, from `/` to the WhatsApp link (AC-3 to AC-9, AC-11, AC-12, AC-15)
  - [x] Admin sign in with TOTP, `requireAdmin()`, and the promote and reset scripts (AC-1)
  - [x] Owner adds the product and sees the order, with the rate limit and the full phone flow (AC-2, AC-10, AC-13, AC-16)
- [ ] Verify it: `/check verify first order end to end`
- [ ] Test it: `/test first order end to end`
