# Verify: Home category cards with products · spec 0031 · updated 2026-11-18
_Steps derived from spec 0031 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Open `/` at 390 wide → under the hero (and under the banners when one is on) the section `#categories` keeps the heading "تسوّق حسب القسم" with no subline; inside it the cards row, then a heading row with the selected category's name and "عرض الكل", then the grid → AC-1
- [ ] Untick every main for Home in `/admin/homepage` and open `/` → the whole categories section is gone and "تسوّق الآن" is hidden → AC-1
- [ ] Look at the cards → one portrait 4:5 card per main ticked for Home, in category order, each with its photo (or the dark placeholder), a black band with the name and the owner's line (else the first three sub names), and no product count → AC-2
- [ ] Tick a main that has no listed product → it gets no card; hide a main → it gets no card → AC-2
- [ ] Press Tab into the row → focus lands on the selected card only; press the left arrow (right to left page) → the next card in the list is selected and focused, the heading changes at once; press the right arrow, Home, and End → previous, first, and last; at the ends the keys wrap → AC-3
- [ ] Hold the left arrow down for a second with DevTools Network open → at most one `home-products` request fires, about 150ms after the last key → AC-3
- [ ] Inspect the row and panel → `role="tablist"` with `aria-label="أقسام المتجر"`, each card `role="tab"` with `aria-selected`, `aria-controls="category-panel"`, `id="category-tab-<slug>"`; the panel `role="tabpanel"`, `aria-labelledby` the selected tab, `tabIndex=0`, `aria-busy="true"` while loading → AC-3
- [ ] At 390 → about two and a half cards show, the row scrolls sideways with snap, the page never scrolls sideways; pressing a card half off screen scrolls it into view → AC-4
- [ ] At 820 and 1280 → the cards wrap into centred rows with no scrolling; cards are 180 and 200 wide; no card's scale, yellow edge, or focus outline is clipped → AC-4
- [ ] Press a card → it faces you at scale 1.06 with a yellow edge and no tint; the other cards in its own row turn toward it; cards in other rows rest flat; unselected cards carry the black tint → AC-5
- [ ] With a mouse, move over a card → it tilts toward the pointer and its tint drops; leave → it settles back. On a touch tablet a finger never tilts → AC-5
- [ ] Emulate `prefers-reduced-motion: reduce` and press a card → the selection, turn, and scale land at once with no transition and no tilt → AC-5
- [ ] Count the grid → at most eight product cards, the same first eight `/c/<slug>` shows unfiltered (in stock first, then newest), subcategory products included, hidden and archived left out → AC-6
- [ ] Sign in as an electrician and open `/` → each product card in the grid offers "add to draft" → AC-6
- [ ] Hide the last listed product of a category after Home loaded, then press its card → the grid shows "لا توجد منتجات في هذا القسم الآن" and "عرض الكل" stays → AC-6
- [ ] Hover a card with the mouse (DevTools Network open) → its products are fetched once; pressing it after swaps the grid at once with no skeleton; pressing an uncached one shows the eight block skeleton until the answer lands → AC-7
- [ ] Press card B, then quickly card C while B is loading → the panel shows C only; B's late answer never replaces it → AC-7
- [ ] Block `/api/catalog/home-products` (or answer 503 or 429) and press a card → an inline notice "تعذّر تحميل المنتجات" with "إعادة المحاولة"; the heading and "عرض الكل" stay; unblock and press retry → the grid shows → AC-8
- [ ] Throttle the network and reload `/` → the loading skeleton shows three card blocks, a heading block, and a grid of four blocks (two below md, three below lg) → AC-9
- [ ] Search the code for `CategoryCircles`, `CircleShelf`, `circleSubline`, `carouselFrom`, `pauseAuto`, `--dur-carousel-auto` → none left in `src/` → AC-10

## Value sourcing
- [ ] Reorder two ticked mains in `/admin/categories` → the cards follow the new order, and the first card is the one selected on load → cards order, selection on load
- [ ] Give a main a photo and a line in the category dialog → the card shows that photo and line; clear the line → the card shows its first three menu sub names → card photo, name, line
- [ ] Press each card in turn → only the pressed card's row turns; resize from 1280 to 820 → the rows rewrap and the turn follows the new rows → rest turn, scale, tint, edge
- [ ] Switch the page to left to right (or flip `dir` in DevTools) → the arrow keys and the turn still name the physical side → keys, turn direction
- [ ] Mouse over the right half of a card → its right edge comes forward; the lower half → its bottom edge → hover tilt
- [ ] Compare a card's grid with `/c/<slug>` unfiltered → same first eight, same order → grid products, category ids, order and listing rule
- [ ] Press "عرض الكل" → it opens `/c/<slug>` of the selected card → grid heading link
- [ ] Untick a main for Home, then call `/api/catalog/home-products?category=<that slug>` → 404, while a ticked main answers 200 → "on Home" rule shared by cards and route
- [ ] Load `/` and count `home-products` requests before any interaction → two (the cards beside the first one); a touch tap on an unpressed card sends one only on press → prefetch
- [ ] Press a card twice within a minute with DevTools Network open → the second press sends no request (component cache); reload and press → the browser answers from its one minute cache → cache life

## Commands
- [ ] `pnpm typecheck` → no errors → AC-11
- [ ] `pnpm vitest run src/features/home "src/app/[locale]/(home)"` (from PowerShell) → all pass, `category-products.db.test.ts` runs against the local database → AC-6, AC-7, AC-11
- [ ] `curl -sD - "http://localhost:3000/api/catalog/home-products?category=<ticked slug>"` → 200, `Cache-Control: private, max-age=60`; `?category=nope` → 404 `no-store`; `?category=` and `?category=a&x=1` → 400 `no-store` → AC-7
- [ ] `pnpm exec playwright test e2e/home-category-cards.spec.ts e2e/storefront-layout.spec.ts e2e/hero-coverflow.spec.ts --project=phone --project=desktop --project=tablet` → all pass → AC-11
- [ ] `pnpm exec playwright test e2e/homepage.spec.ts --project=homepage --no-deps` → passes → AC-2, AC-11

## Acceptance-criteria coverage
- AC-1: UI steps 1, 2 · AC-2: UI steps 3, 4; Value sourcing 1, 2 · AC-3: UI steps 5 to 7; Value sourcing 4 · AC-4: UI steps 8, 9 · AC-5: UI steps 10 to 12; Value sourcing 3, 5 · AC-6: UI steps 13 to 15; Value sourcing 6, 7 · AC-7: UI steps 16, 17; Value sourcing 8 to 10; command 3 · AC-8: UI step 18 · AC-9: UI step 19 · AC-10: UI step 20 · AC-11: commands 1 to 5
