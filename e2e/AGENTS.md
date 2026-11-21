# End to end flows (Playwright)

## Overview

Browser flows for every user facing path, in Arabic right to left, against the local Supabase. Locally they run on `pnpm dev`; in CI (or with `E2E_TARGET=preview`) they run on `pnpm preview`, the real Workers runtime. Shared helpers live beside the specs as plain `*.ts` files.

## Key files

| File | Owns |
|---|---|
| `../playwright.config.ts` | The projects (`phone`, `desktop`, `tablet`, `small-phone`, `landscape`, `monitor`, then `homepage`, `settings`, `rate-limit` in order) and the two web servers |
| `width-sweep.spec.ts` | The only spec on `small-phone` (320 by 568), `landscape` (844 by 390), and `monitor` (2560 by 1440): every storefront page at the widths spec 0029 left open (scope feature 39) |
| `admin-setup.ts` | Global setup: makes the test accounts on the local Supabase, promotes admins with `pnpm admin:promote`, enrolls their authenticator |
| `admin-auth.ts` | `adminAccounts()`, `signInAdmin()`, `totpCode()`, `serviceClient()`, `loadLocalEnv()` |
| `a11y.ts` | `usePhoneWidth()`, `expectNoAxeViolations()`, `expectTouchTargets()`, `expectNoSidewaysScroll()`, `expectFocusOutline()` |
| `own-ip.ts` | `ownIpHeaders()`: a random `cf-connecting-ip` per browser context |
| `local-db.ts` | `localSql()`: a direct client on the local database, refuses any other URL |
| `accounts.ts`, `orders.ts`, `categories.ts` | Unique customers (reset emails from Mailpit on port 54324), orders written straight to the database, seeded products |
| `stubs/cf-graphql.ts` | Stand in for Cloudflare Web Analytics, read by the stats page |

## Commands

```bash
pnpm exec playwright test                          # on pnpm dev
E2E_TARGET=preview pnpm exec playwright test       # on workerd, as CI does
pnpm exec playwright test --project=phone e2e/cart.spec.ts
pnpm exec playwright test --project=small-phone --project=landscape --project=monitor   # the width sweep
```

## Conventions

- A new spec runs on `phone` and `desktop` by default. Add it to the `tablet` project's `testMatch` only if it covers the storefront layout between md and lg.
- Call `usePhoneWidth()` so the phone project tests at 390 by 844, the width the design was drawn for.
- Any flow that places or looks up orders opens its own context with `ownIpHeaders()`, so parallel flows never spend each other's rate limit allowance.
- Check each screen with the `a11y.ts` helpers (axe WCAG AA, 44 by 44 targets, no sideways scroll, visible focus).
- Make unique data (`uniqueEmail()`, `uniquePhone()`) and clean up only what this worker made.

## Gotchas

- Dashboard and account flows skip themselves unless the local Supabase is running and `admin-setup.ts` made the accounts.
- A flow that changes shared shop data (Home banners, WhatsApp number, delivery zones, policy pages) must run in its own serial project after the others and put the data back when it ends. Add it to the chain in `playwright.config.ts`, and to every parallel project's `testIgnore`.
- `rate-limit.spec.ts` runs last and sends its own IP. The local limiter counts in wall clock minute windows, so it waits for a fresh window when the current one is nearly over; six submits across a boundary would never be refused.

## Related specs

- [0001 Stack architecture](../docs/specs/0001-stack-architecture/index.md) (testing on workerd)
- [0003 Design system](../docs/specs/0003-design-system-ui-foundation/index.md) (accessibility checks)
- [0029 Storefront desktop layout](../docs/specs/0029-storefront-desktop-layout/index.md) (desktop and tablet projects)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
