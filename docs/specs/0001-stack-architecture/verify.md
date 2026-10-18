# Verify: Stack & architecture · spec 0001 · updated 2026-10-17 (Arabic only)
_Spec 0001 is a decision spec with no numbered acceptance criteria. These steps come from the scope's **Done when** (DW) and the spec's Proposed stack table. `/check verify` runs these; `/test` locks the durable ones._

DW-1: the stack is recorded in a spec. DW-2: the empty project starts locally. DW-3: it builds cleanly.

## Commands
- [x] `pnpm install` → completes with no errors (flat `node-linker=hoisted`, see `.npmrc`) → DW-2
- [x] `pnpm typecheck` → route types generated, `tsc` reports no errors → DW-3
- [x] `pnpm lint` → no errors → DW-3
- [x] `pnpm build` → succeeds; `/[locale]` is listed as `ƒ (Dynamic)` (rendered on each request, no ISR) and `ƒ Proxy` is present → DW-3
- [x] `pnpm exec opennextjs-cloudflare build` → ends with "OpenNext build complete" and writes `.open-next/worker.js` → DW-3
- [x] `pnpm db:start` (Docker running) → local Supabase starts, output lists "Creating Storage bucket: product-media" (or it already exists) → DW-2
- [x] `pnpm cf-typegen` → `cloudflare-env.d.ts` contains `HYPERDRIVE: Hyperdrive` → DW-2

## UI / manual (run with `pnpm dev`, then again with `pnpm preview` on workerd)
- [x] Open `/` → `<html lang="ar" dir="rtl">`, heading "S.K.F للإنارة" → DW-2
- [x] Open `/en` → 404 with the Arabic not found page ("الصفحة غير موجودة"), `<html lang="ar" dir="rtl">` (there is no English site) → DW-2
- [x] Open `/ar` → redirects (307) to `/` (Arabic has no prefix) → DW-2
- [x] Open `/` with an English browser language and a `NEXT_LOCALE=en` cookie → still 200 in Arabic, no redirect; the page has no "English" link → DW-2
- [x] Open `/admin` → not rewritten by locale routing (no `x-middleware-rewrite` header); a 404 is expected until the admin feature exists → DW-2
- [x] Open `/favicon.ico` → served directly, proxy does not run → DW-2
- [x] `pnpm preview` log shows `env.HYPERDRIVE ... local` and "Ready on" → DW-2

## Spec settings spot checks
- [x] `wrangler.jsonc` has `nodejs_compat`, placement `{ "mode": "targeted", "region": "aws:eu-central-1" }`, and a `HYPERDRIVE` binding → DW-1
- [x] `next.config.ts` has `images.loader: "custom"` and no `cacheComponents` → DW-1
- [x] `src/server/db/index.ts` builds the Drizzle client inside `getDb()` (no module level client) and imports `server-only` → DW-1

## Acceptance-criteria coverage
- DW-1 covered by the spec itself plus the settings spot checks · DW-2 covered by `db:start`, `cf-typegen`, and all UI steps · DW-3 covered by install, typecheck, lint, `build`, and the OpenNext build.
- Not yet exercisable: a real database query through `getDb()` (first used by the data model, feature 3), and Supabase sign in (accounts features).
