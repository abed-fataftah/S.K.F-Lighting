# Verify: Storefront desktop and tablet layout · spec 0029 · updated 2026-11-10
_Steps derived from spec 0029 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones. Slice 1 (tasks 1 to 7) so far; later slices append theirs._

## UI / manual
- [ ] At 390 wide, open `/`, a category, a product, the cart, and `/orders/track` → each looks exactly as before: 480 column, phone header, bottom bar, float → AC-1
- [ ] At 1280, open `/` → the strip, header, and footer black run edge to edge; the home content stays a centred 480 column (not converted yet) → AC-3
- [ ] At 1280 → the header is one row: logo, search (at most 640 wide), `حسابي`, cart; no menu button; Tab from the logo goes search, search button, `حسابي`, cart → AC-4, AC-21
- [ ] At 1280 → `حسابي` goes to `/account/orders`; the cart badge shows the line count → AC-4
- [ ] At 1280, under the header → a black `nav` "الأقسام" with the navigation mains in the menu sheet's order; open one → its link has `aria-current="page"`, also on its sub category pages → AC-5
- [ ] At 1280 with more than 6 navigation mains → `المزيد` lists the rest, then `كل الأقسام` (to `/c`); Enter opens it, Escape closes it and focus returns to the button → AC-5
- [ ] Make the navigation read fail (stop the database) at 1280 → no category bar, the header still renders → AC-5
- [ ] At 1280 → no bottom bar, and the footer is the last thing on the page (no empty room under it) → AC-6
- [ ] At 820 and 1280 → the WhatsApp float sits 24px from the screen's left edge (end, in Arabic); 84px above the bottom at 820, 24px at 1280; at page end it covers no footer link → AC-7
- [ ] At 1280 → the footer is one row: logo and contact on the right, the four links on the left, each 44 high → AC-8
- [ ] Open the seeded `ثريات` category at 390, 820, 1280 → 2, 3, 4 grid columns; content inside a centred box at most 1280 wide with 16, 24, 32px side padding → AC-3, AC-9
- [ ] A category with sub chips at 820 → the chips wrap onto more lines instead of scrolling sideways → AC-9
- [ ] At 1280 with a mouse, hover a product card → its border turns ink; on a touch tablet nothing changes → AC-19
- [ ] Inspect a product card photo → `sizes` is `(min-width: 1024px) 300px, (min-width: 768px) 33vw, (min-width: 480px) 240px, 50vw`; at 1280 the loaded file is about 300px wide, not a stretched phone one → AC-20
- [ ] At 768, 820, 1024, 1280, 1920 on `/` and a category → no sideways scroll → AC-3

## Value sourcing
- [ ] Category bar names, slugs, order: reorder or hide a main in `/admin/categories` → the bar follows the menu sheet's list exactly → AC-5
- [ ] Current category: open a sub (`/c/<main>/<sub>`) and an Arabic slug main → the parent main is marked; a product page marks none → AC-5
- [ ] `المزيد`, `كل الأقسام`, nav label: read from `Shell.more`, `Shell.allCategories`, `Shell.menuCategories` → AC-5
- [ ] Header account link: same label and target as the bottom bar's `حسابي` tab (`routes.accountOrders`) → AC-4
- [ ] Header cart count: add two different products → both cart links (only one visible at a time) say 2 → AC-4
- [ ] Widths and breakpoints: resize across 767/768 and 1023/1024 → layout switches exactly there; `sm:`/`xl:` classes produce no CSS → AC-2

## Commands
- [ ] `pnpm exec vitest run src/app/tailwind-lock.test.ts src/design-rules.test.ts src/components/page-frame.test.ts src/features/shell/nav.test.ts` → all pass → AC-2, AC-3, AC-5
- [ ] `pnpm exec playwright test e2e/shell.spec.ts e2e/storefront-layout.spec.ts --project=phone --project=tablet --project=desktop` → all pass → AC-1, AC-3 to AC-9, AC-19, AC-21, AC-22
- [ ] `pnpm exec playwright test --project=phone` → passes with no phone assertion changed → AC-1

## Acceptance-criteria coverage
- AC-1 phone steps, full phone run · AC-2 breakpoint step, lock test · AC-3 shell width steps · AC-4 header steps · AC-5 category bar steps (overflow measuring arrives in task 8) · AC-6 bottom bar step · AC-7 float step · AC-8 footer step · AC-9 grid steps (category page only so far) · AC-19 hover step · AC-20 card sizes step (other images in later slices) · AC-21, AC-22 partly (category page and shell)
- Not yet built: AC-10 to AC-18, AC-23, and the rest of AC-9, AC-20, AC-21, AC-22 (slices 2 to 4 and the finish)
