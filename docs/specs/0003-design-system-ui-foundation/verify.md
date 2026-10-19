# Verify: Design system and UI foundation · spec 0003 · updated 2026-10-19

_Steps derived from spec 0003 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones. Run with `DESIGN_SYSTEM_PAGE=1` and `NEXT_PUBLIC_WHATSAPP_NUMBER=970500000000` (see `.env.example`). Widths: 390x844 (phone) and 1280 (desktop)._

## UI / manual

- [ ] Open `docs/design/` → `design.md`, `handoff.md`, `pages/*.md`, `tokens.css` are there; no `UI/` folder at the root; handoff section 2 lists the real paths and section 10.2 items 9 to 13 the spec 0003 deviations → AC-1
- [ ] Visit `/design-system` → Arabic, right to left, Almarai; the colours section shows 18 pairs with ratios; the type section shows 14 roles; every component and shell part appears with its states → AC-4, AC-19
- [ ] On `/design-system`, view the page source → `<meta name="robots" content="noindex, nofollow">` → AC-19
- [ ] Turn off `DESIGN_SYSTEM_PAGE` (unset it, restart) and visit `/design-system` → 404 → AC-19
- [ ] Emulate dark mode in DevTools → the page stays light (page colour `#F5F5F3`) → AC-4
- [ ] On `/`, press Tab → the skip link "تخطي إلى المحتوى" appears first; Enter → focus moves to `main` with no outline; Tab again → the menu button shows a 3px yellow outline → AC-5, AC-11
- [ ] Tab to a button on a light surface → 3px ink outline, 2px offset, never clipped → AC-5
- [ ] Tab into the header search field → the white search box (not the field) shows the yellow outline; Tab to the yellow search button → ink outline → AC-5
- [ ] In the gallery forms section → the phone field in error has a red border, `aria-invalid="true"`, and the message "أدخل رقم هاتف صحيح." below it with an icon, `role="alert"`, linked by `aria-describedby` → AC-8
- [ ] Gallery size chips → "60 سم" shows a check and `aria-pressed="true"`; "80 سم" is struck through with "· غير متوفر" and cannot be chosen → AC-9
- [ ] Gallery applied filters → each chip is named "إزالة <label>" and removes itself on click → AC-9
- [ ] Gallery radio cards → choosing "توصيل" fills it yellow tint with a 2px ink border and the card does not change size → AC-9
- [ ] Gallery stepper → minus at 1 has `aria-disabled` and keeps focus; type 150 then Enter → 99; type `abc` then leave → value unchanged; type 0 then leave → 1 → AC-9
- [ ] Gallery error card → `role="alert"`, a retry button and a green WhatsApp link opening `wa.me/970500000000` with message W2 → AC-9, AC-17
- [ ] Gallery icons → chevrons and arrows point toward the reading direction (flipped); cart, search, WhatsApp, trash, check, close, filter, play do not flip → AC-10
- [ ] On `/` at 390 and 1280 → one centered 480px column; scroll to the very end → no footer link sits under the float or the bottom bar → AC-11
- [ ] On `/` → header has the menu button, the logo link to `/` named "S.K.F lighting", the cart link to `/cart` named "السلة" with no badge; the yellow delivery strip shows above it → AC-12, AC-14
- [ ] Type "ثريا ذهبية" in the header search and press Enter → URL is `/search?q=ثريا ذهبية` (404 page until search is built); submit empty → `/search` → AC-12
- [ ] Open the menu → sheet from the right edge titled "القائمة"; focus on "إغلاق"; links in order: الرئيسية, الأقسام, السلة, بحث, حسابي, the three policies, then WhatsApp (W1); Tab stays inside; Escape closes and focus returns to the menu button → AC-13
- [ ] With reduced motion on (DevTools rendering), open the menu → it appears without sliding; the gallery skeleton does not pulse → AC-13, AC-21
- [ ] Gallery header with a count → the cart is named "السلة، 3 منتجات" and shows a yellow "3" badge hidden from screen readers → AC-14
- [ ] On `/` → the bottom bar has five tabs; الرئيسية is bold ink with a yellow underline and `aria-current="page"`; حسابي goes to `/account/orders` → AC-16
- [ ] On `/` → the green float (52px, white border) is named "واتساب" and opens `wa.me/970500000000` with W1 in a new tab → AC-17
- [ ] Gallery dashboard frame at 1280 → sidebar beside the content, "الطلبات" active with the 4px yellow bar and `aria-current="page"`, "عرض المتجر" links to `/`; at 390 → the sidebar sits above the content → AC-18
- [ ] Run Lighthouse accessibility on `/design-system` and `/` → 95 or more (handoff item 19) → AC-20

## Value sourcing

- [ ] Footer contact from `shop_settings`: set `contact_phone = '0599 123 456'`, `address = null` in the local database, reload `/` → only the phone shows, left to right; set both → "phone · address"; clear both → no contact line → AC-15
- [ ] Footer with the database down (`pnpm db:stop`), reload `/` → the page renders within about 1.5 seconds with no contact line, and the server log says the read failed without any phone or address → AC-15
- [ ] WhatsApp number edge: set `NEXT_PUBLIC_WHATSAPP_NUMBER=+97050` and run `pnpm dev` or `pnpm build` → it stops with "must be 8 to 15 digits"; unset it → it stops with "must be set" → AC-17
- [ ] Bottom bar source: the active tab follows `activeTab(pathname)`; once later pages exist, `/cart` marks السلة (not الأقسام), `/p/<slug>` marks الأقسام, `/policies/terms` marks الرئيسية → AC-16
- [ ] Info strip source: shows only on `/` (exact path), with the fixed `Shell.infoStrip` copy → AC-12

## Commands

- [ ] `pnpm exec vitest run src/design-rules.test.ts` → passes; planting `ml-2`, `#ffffff`, `[13px]`, `shadow-md`, `dark:bg-ink`, `text-sm`, `outline-none`, `rounded-tl-card`, or شيك in a storefront namespace makes it fail → AC-2, AC-3, AC-6
- [ ] `pnpm exec vitest run src/app/tailwind-lock.test.ts` → `bg-red-500`, `rounded-lg`, `shadow-md`, `text-sm`, `leading-tight`, `max-w-md`, `animate-pulse` produce no CSS; `font-bold`, `font-extrabold`, `bg-transparent`, `text-current` still do → AC-3
- [ ] `pnpm exec vitest run src/app/tokens-contrast.test.ts` → all 18 pairs recompute and meet their minimum → AC-20
- [ ] `pnpm exec vitest run src/features/shell src/lib` → nav rules, footer line, contact timeout, WhatsApp URL, public env, stepper clamping pass → AC-9, AC-15, AC-16, AC-17, AC-18
- [ ] `pnpm exec playwright test e2e/design-system.spec.ts e2e/shell.spec.ts` → all pass on phone and desktop (axe WCAG 2.1 A/AA, 44px targets, no sideways scroll, focus) → AC-5, AC-7 to AC-21
- [ ] `E2E_TARGET=preview pnpm exec playwright test` → the same on workerd, as CI runs it → AC-20
- [ ] `grep -rn "#[0-9a-fA-F]\{6\}" src --include=*.ts --include=*.tsx --include=*.css | grep -v tokens.css` → only the colour row in `src/server/db/testing.ts` (catalog data) → AC-2

## Acceptance-criteria coverage

- AC-1 docs step 1 · AC-2 rule test, grep · AC-3 lock test · AC-4 gallery steps, dark mode step · AC-5 focus steps · AC-6 rule test · AC-7 gallery, e2e · AC-8 field error step · AC-9 chip, removable chip, radio card, stepper, error card steps · AC-10 icons step · AC-11 column and footer clearance steps · AC-12 header, search, info strip steps · AC-13 menu and reduced motion steps · AC-14 cart steps · AC-15 footer value steps · AC-16 bottom bar steps · AC-17 float, error card, env edge steps · AC-18 dashboard frame step · AC-19 gallery, noindex, flag off steps · AC-20 axe e2e, contrast test, Lighthouse · AC-21 reduced motion step
