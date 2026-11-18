# 0030. Hero product coverflow

**Date**: 2026-11-18
**Status**: In Progress
**Amended**: 2026-11-19. Amended by spec [0032](../0032-light-hero-orange-brand/index.md): the hero surface is white (AC-3), the side card tint is white (AC-4), the words are ink (AC-5), the arrows and dots are styled for white (AC-6, AC-8), and the fallback card (AC-11) and loading shape (AC-14) are light.

## Summary

Home's hero becomes a 3D coverflow (a row of cards where the middle one is large and facing you, and the ones beside it are smaller and turned inward) of the featured products, at every screen width. The headline sits above it, the two hero buttons below it. It replaces the "منتجات مختارة" grid lower on the page and the desktop side card beside the banners, and the banners move under the hero. It is built by hand with CSS 3D transforms, the same way the category circle carousel is built, with no new library, and it never moves by itself.

## Rationale

Reasoning, the options weighed, and the smaller calls settled while writing: see [rationale.md](rationale.md).

## Requirements

Replaces spec 0011 AC-1 (the order of Home and the `h1` rule), AC-3 (the hero shows only as a fallback now), and AC-5 (the featured grid is gone); replaces spec 0029 AC-13 (a) and (b) (the wide hero and the banner side card). Everything else in those specs stands: the banner carousel itself, the circles, the trust cards, the editor, and the reads. All new strings go in the `Home` namespace of `src/i18n/messages/ar.json`; every price through `formatPrice`; every link through `routes`; style only with the tokens.

**User stories**:
- As a customer on a phone, I want Home to open on the shop's picked products in a form I can flick through, so that I see real products before I scroll.
- As a shopper on a laptop, I want to move through the picked products with the arrows or the keyboard and open the one in the middle, so that the hero is a shop window, not a poster.
- As the owner, I want the products I pick in the dashboard to be the hero, so that choosing them is worth the effort.

**Acceptance criteria**:

- **AC-1**: Home order and the `h1`. `/` shows, top to bottom: the yellow info strip, the shared header, the hero (AC-2, or the fallback card of AC-11), the banner carousel when at least one banner is active (AC-12), the categories section, the trust section, then the footer, bottom bar, and WhatsApp float. The "منتجات مختارة" section (spec 0011 AC-5) is removed, with its `viewAll` link and its `id="featured"` jump target. The page has exactly one `h1`, the hero headline "ثريات وإنارة" / "وكهربائيات", at every width and whether or not banners are on; the hidden `h1` with the shop name is gone.
- **AC-2**: Hero products. The hero's products are the same list the featured grid used: the `featured_products` in `sort` order that are listed (spec 0011 AC-5 rules: hidden, archived, and hidden category products left out; out of stock kept), else the 8 newest sellable products, through the existing featured part of `getHomeSections`. With 1 or more products the coverflow hero (AC-3) shows. With none, or when that read failed or timed out (spec 0011 AC-7, the part is null), the fallback card (AC-11) shows.
- **AC-3**: Hero layout. A `section` with `data-testid="home-hero"`, labelled by the `h1`, on the black hero surface with the `on-dark` text colours: on phones (below `md`) a card with `rounded-hero` and `--page-pad` side margins as today; from `md` a black band across the whole screen whose content sits in a centred box of `--content-max` with `--page-pad`. The hero is rendered by `page.tsx` outside the `PageFrame` (which caps at `--content-max`), so the band reaches both screen edges at 1920 with no `w-screen` trick and no sideways scroll. Inside, top to bottom: the `h1` (line 2 yellow) and the subline "اختر ثم اطلب عبر واتساب", the coverflow (AC-4), the dots (AC-8), then the buttons row: the yellow "تسوّق الآن" (to `#categories`, the existing `SectionJump`; hidden when there are no circles) and the green "اطلب عبر واتساب" (W1), 52 high, as the hero card has them today. Below `lg` the words and buttons are start aligned (the phone design); from `lg` the words, the coverflow, and the buttons are centred. The chandelier drawing is not in the coverflow hero (it stays on the fallback card). The hero clips its own overflow, so a neighbour card is cut at the hero's edge on a phone.
- **AC-4**: The coverflow. A region with `aria-roledescription="carousel"` and `aria-label="المنتجات المختارة"`, holding a list `ul` with `data-testid="home-products"` and one plain `li` per product (every product renders once, no copies for the loop). Each `li` keeps its list item role and holds one inner `div` with `role="group"`, `aria-roledescription="slide"`, and `aria-label` from `Home.slideLabel` ("N من M", Arabic digits), as the banner carousel does, so axe's list rule passes. The list sits in a box with `perspective: var(--coverflow-depth)` so the side cards read as turned. Every card is the product's first image (`imageKey` through `next/image` and the Supabase loader, else `ImagePlaceholder`), portrait 4:5, `object-cover`, `rounded-card`, not draggable. The centred card is the largest and faces the viewer; the cards beside it are smaller, turned to face the centre with `rotateY` (a card on the physical right turns its right edge back, a card on the physical left its left edge back), and dimmed with lower opacity plus a black tint overlay that moves with its card (depth through scale and tint; no shadow, no blur, no gradient). Cards nearer the centre stack above cards further out (z index falls with the distance). Geometry in `## Feature design`. One neighbour shows on each side below `lg`, two on each side from `lg`; the next card out on each side sits at its own place at opacity 0, `visibility: hidden` once its transition ends, and takes no pointer events. The band clips its content, so at 1024 wide the outer neighbours are partly cut off, which is accepted. On a phone (390 wide) at least a quarter of each neighbour's width is visible inside the hero.
- **AC-5**: The centre card. Only the centred slide holds a link: an `a` to `routes.product(slug)`, not draggable, wrapping the image and, under it, the product name (`type-lead`, `text-white`, at most 2 lines, the full name in the accessible name) and the price: `formatPrice(listPrice)`, prefixed with `Catalog.from` ("من") when `pricesDiffer`, `text-on-dark-muted` when out of stock, and no price when `listPrice` is null (spec 0008 AC-12 rules). The words block always reserves two `type-lead` lines plus one price line, so the dots and buttons never move between a short and a long name. An out of stock product shows its image at 45% opacity and the black `Catalog.outOfStock` label at the image's start top corner on every slide where it appears. The side slides show the image only (no name, no price, no link) and are `aria-hidden="true"`, so the tab order inside the hero is: the arrows (AC-6), the centre link, the dots (AC-8), the buttons. When the centre link had focus before a step, focus moves to the new centre link after it (a layout effect), so the keyboard keeps working. The centre link is the only link inside `home-products`, so the e2e flows that open "the first link in `home-products`" open the centred product.
- **AC-6**: Moving it. The coverflow moves one product per step: a swipe (any pointer type; a pointer move of at least 40px with more sideways than up and down travel) moves toward the swipe; a tap or click on a side slide brings that product to the centre; the arrow buttons "المنتج السابق" and "المنتج التالي" (44×44, the hero's on dark outline style, chevrons that flip in RTL, shown from `lg` only, placed at the start and end edges of the content box and vertically centred on the image) move one step; with focus anywhere inside the hero, the keyboard's left arrow brings the card on the physical left to the centre and the right arrow the card on the physical right (the same in RTL, the key names a side of the screen); a key pressed with a modifier (Ctrl, Alt, Meta, Shift) is left to the browser. Tap and swipe are told apart on pointer up: a sideways move of 10px or more sets a `swiped` flag, and a capture phase click handler on the region cancels the click that follows and clears the flag, so a drag that starts on the centre link never opens the product and a drag that starts on a side slide never steps twice. The list has `touch-pan-y`, so the browser keeps the sideways gesture and still scrolls the page up and down. The coverflow never moves by itself (no auto advance, so no pause button) and it loops: from 3 products both sides always hold a neighbour and both arrows always work.
- **AC-7**: Motion. A step slides every card to its new place over `--dur-carousel-move` with `--ease-carousel` (transform, opacity, and visibility; the tint overlay transitions with its card). A card that crosses from one side of the centre to the other on a step does not slide through the middle: it fades out where it was and fades in on its new side through the Web Animations API, as the circles do (spec 0011 AC-4), and its overlay skips the transition on that step. Under `prefers-reduced-motion: reduce` nothing animates: cards take their new place at once, and no fade runs. The first centred product is the first in the list, and the server renders every card already in place for every width (the phone and desktop placements both sit on each card as custom properties, and `lg:` classes pick the desktop set), so nothing jumps or fades in when the page hydrates on a desktop, and a resize across `lg` is plain CSS.
- **AC-8**: Position. Under the coverflow, one dot button per product with the accessible name "المنتج N من M: <name>" (so a flow or a screen reader user can pick a product by name), `aria-current="true"` on the centred one, the centred dot `bg-yellow` and the others outlined in `on-dark-muted`; a tap moves there by the shortest way round (`circleSteps(index, centre, count)`; an even count's tie goes toward the inline end, as with 2 products). A visually hidden `aria-live="polite"` region reads "المنتج في المنتصف: <name>" after each move. Both are hidden with 1 product.
- **AC-9**: Small counts. With 1 product: the centre card alone (its link, name, and price), no arrows, no dots, no live text, no swipe. With 2 products: the other one always sits on the inline end side (the left in RTL), the start side stays empty, and each step swaps the two, so both arrows, a swipe either way, and a tap on the side card do the same swap; the arrows stay enabled and the dots show 2.
- **AC-10**: Widths. The centre card width is the token `--coverflow-card` in `tokens.css`: 220px below `md`, 260px from `md`, 300px from `lg`, set per breakpoint exactly as `--page-pad` is. So at 390 the centre card is 220 wide, at 820 it is 260 wide with one neighbour each side, at 1280 it is 300 wide with two neighbours each side, and the hero never scrolls the page sideways at 390, 768, 820, 1024, 1280, or 1920 wide. From `md` the hero band spans the screen and its content stays inside `--content-max` with `--page-pad`. No bracketed pixel class anywhere (the design rule test forbids them).
- **AC-11**: Fallback card. With no products (AC-2) the existing black hero card shows as today, with the chandelier drawing, the `h1`, the subline, and the buttons; from `md` it spans the content width as spec 0029 AC-13 (a) describes. Its "تسوّق الآن" goes to `#categories` or is hidden when there are no circles (there is no featured section to fall to).
- **AC-12**: Banners under the hero. When at least one banner is active, the banner carousel (spec 0011 AC-2, unchanged) shows under the hero: below `md` full column width as today; from `md` centred at most `--prose-max` (720px) wide at every larger width, and the banner image `sizes` becomes `(min-width: 768px) 720px, (min-width: 480px) 448px, 100vw` (the old 830px desktop value goes). The desktop two thirds row and the side card (spec 0029 AC-13 (b)) are removed, and `home-side-card.tsx` is deleted.
- **AC-13**: Images. The centred card's image loads eagerly with high priority (it is the largest picture above the fold); every other card loads lazily. `sizes` is `(min-width: 1024px) 300px, (min-width: 768px) 260px, 220px`. Images have an empty `alt` (the product name is the link's text).
- **AC-14**: Loading and errors. `loading.tsx` shows the hero's shape (two text lines, one block `--coverflow-card` wide at 4:5, a dots row, two button blocks) instead of the banner and side card blocks, and no featured grid block. A failed featured read is logged as today (`home_read_failed`, part `featured`) and only swaps the coverflow for the fallback card.
- **AC-15**: Tests. Vitest beside the source for every pure rule: the hero list rule (featured, else newest, else none), the signed steps from the centre for 1, 2, 3, and 8 products (reusing `circleSteps`), the placement for each step and width (translate, scale, angle, opacity, tint, hidden beyond the visible neighbours), the crossing rule, the key to step mapping, and the swipe threshold. Playwright flows (the `phone`, tablet, and desktop projects as `e2e/storefront-layout.spec.ts` uses them): at 390 the hero shows the picked products with a neighbour cut at each edge, a swipe moves it, a tap on a side card centres it, and the centre link opens its product page; at 1280 two neighbours show on each side, the arrows and the arrow keys move it, and the dots mark the centre; at 820 one neighbour on each side; with reduced motion emulated a step lands at once; with banners on, the carousel sits under the hero and there is no side card; with no picks the newest products fill the hero; with no products the fallback card shows. The flows that open the first link in `home-products` (`guest-order`, `checkout-delivery`, `arabic-language`, `policies`, `rate-limit`, `shop-settings`) pass unchanged. Three flows are retargeted, nothing else changes in them: `e2e/first-order.spec.ts` finds the product by name, which only works when it is centred, so it first presses the dot named for the product (AC-8) and then the centre link; `e2e/homepage.spec.ts` drops the hidden `h1` text checks (the `h1` is now the hero headline with banners on), the `home-side-card` checks, and the grid assertions (`product-card` count, the second product's name, which a side slide does not show) in favour of the slide count and the centred product; the `home` test in `e2e/storefront-layout.spec.ts` drops the hero width equation (the band is wider than the content box from `md`) and the `home-products` grid column counts. axe passes on `/` with the coverflow and with the fallback card.

## Decision

**Chosen option**: Option 1: Hand rolled coverflow on CSS 3D transforms, following the circle carousel

The featured products become a hand built 3D coverflow hero component in `src/features/home/components/` that reuses the circle carousel's step, crossing, swipe, and reduced motion patterns, with no new dependency.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Feature design

**Data model sketch**: no change. The hero reads `featured_products` and `products` through the existing featured part of `getHomeSections` (spec 0011), which already returns `CardProduct` rows (`slug`, `name`, `imageKey`, `listPrice`, `pricesDiffer`, `inStock`). No migration.

**Components**:

| File | Change |
|---|---|
| `src/features/home/components/hero-coverflow.tsx` | New client component: the hero section, the coverflow list, arrows, dots, live text, the buttons row. Takes `products: CardProduct[]`, `whatsappNumber`, `jumpTo: "categories" \| null`. |
| `src/features/home/home-rules.ts` | Add `coverflowPlacement(steps, visible, dir)` (translate as a multiple of the card width, scale, angle, opacity, tint, hidden, z index), `stepForKey(key, dir)`, and `shopNowTarget` becomes `circleCount > 0 ? "categories" : null`. `circleSteps` and `changesSide` are shared by both carousels (one function each). |
| `src/features/home/motion.ts` | New: `useReducedMotion` and `tokenMs` move here from `category-circles.tsx`, shared by both carousels. |
| `src/features/home/components/hero-card.tsx`, `section-jump.tsx`, `section-ids.ts` | `jumpTo` and the section union lose `"featured"`. The card stays the fallback (AC-11). |
| `src/features/home/components/home-sections.tsx` | `FeaturedSection` removed. |
| `src/features/home/components/home-side-card.tsx` | Deleted (AC-12). |
| `src/app/[locale]/(home)/page.tsx`, `loading.tsx` | New order (AC-1), hero choice (AC-2), banners centred from `md` (AC-12), new skeleton (AC-14). |
| `src/app/tokens.css` | Two new tokens in the motion and layout sections: `--coverflow-card` (220px, 260px from `md`, 300px from `lg`, set per breakpoint like `--page-pad`) and `--coverflow-depth: 1000px` (the perspective). Reuses `--dur-carousel-move`, `--ease-carousel`, `--radius-card`, `--radius-hero`, the ink, yellow, white, and on dark colours. |
| `src/i18n/messages/ar.json` | `Home`: `coverflowLabel`, `productPrev`, `productNext`, `productDot` (`{n}`, `{count}`, `{name}`), `centredProduct`. Reused as they are: `Home.slideLabel`, `Catalog.from`, `Catalog.outOfStock`. |

**Coverflow geometry** (the build may tune the angle and offsets by up to 10% after seeing it, within AC-4 and AC-10):

| Width | Centre card width (`--coverflow-card`) | Visible neighbours per side | Offset from the centre (× card width) | Scale | `rotateY` | Opacity | Tint (black overlay opacity) |
|---|---|---|---|---|---|---|---|
| below `lg` | 220px (260px from `md`) | 1 | first 0.78 (0.80 from `md`); next out 1.40 | first 0.74; next out 0.56 | first 35°; next out 45° | first 0.75; next out 0 | first 0.3; next out 0.5 |
| `lg` | 300px | 2 | first 0.82, second 1.40; next out 1.90 | first 0.74, second 0.56; next out 0.42 | first 35°, second 45°; next out 50° | first 0.75, second 0.5; next out 0 | first 0.3, second 0.5; next out 0.5 |

The centre card is scale 1, angle 0, opacity 1, no tint, z index highest; z index falls by one per step away. "Next out" is the first hidden card on each side, the place a card slides in from; anything further sits at the same place, hidden. Each card's transform is `translateX(calc(var(--coverflow-card) × side × offset)) rotateY(−side × angle) scale(s)`, where `side` is +1 for a card physically right of the centre and −1 for left (`side = dir × sign(steps)`, `dir` −1 in RTL resolved from the list's computed `direction`, as the circles do); the minus on the angle is what turns a right card's right edge back so it faces the centre. `coverflowPlacement` is pure and returns the offset as a multiple; the component writes the `calc`. For the crossing fade keyframes the card width is read once in px from `--coverflow-card` through `getComputedStyle` (custom properties inside keyframes are not reliable everywhere). Both the below `lg` and the `lg` placements are written on every card as custom properties (`--cf-x`, `--cf-r`, `--cf-s`, `--cf-o`, `--cf-t`, `--cf-z` and their `--cf-lg-*` twins) and the `lg:` variants of the transform, opacity, tint, and z index classes read the `lg` set, so the server markup is correct at every width without a media query hook. The list height is the centre card's height (4:5 of the card width) plus the reserved words block (two `type-lead` lines and one price line), so the hero does not resize while moving. No bracketed pixel class; the only pixel numbers live in `tokens.css`.

**State**: one client state `{ centre, from }` as the circles (`from` tells which cards crossed). Steps wrap modulo the count. The key handler and the arrows call `step(±1)`; a side tap calls `step(steps of that slide)`; a dot calls `step(circleSteps(index, centre, count))`.

**API surface**: no new endpoint or action.

| Read | Where | Inputs | Outputs | Auth | Errors |
|---|---|---|---|---|---|
| `getHomeSections().featured` | existing, `server/home.ts` | none | `CardProduct[] \| null` | public | null on failure or timeout (spec 0011 AC-7) |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Hero choice | coverflow or fallback card | `featured` from `getHomeSections`: null or empty gives the card (AC-2) |
| Coverflow | product order | `featured_products.sort`, else newest first (spec 0011 AC-5) |
| Card | image | `CardProduct.imageKey`, else `ImagePlaceholder` |
| Centre card | name, link | `CardProduct.name`, `routes.product(CardProduct.slug)` |
| Centre card | price text | `formatPrice(listPrice)`, "من" when `pricesDiffer`, muted when `!inStock`, none when null (spec 0008 AC-12) |
| Any slide | "غير متوفر" label and faded image | `CardProduct.inStock === false` |
| Slide label, dot label, live text | N, M, name | `Home.slideLabel`, `Home.productDot`, `Home.centredProduct` with slide index + 1 and the count through `formatNumber`; `CardProduct.name` |
| Placement | translate, scale, angle, opacity, tint, z index, hidden | `coverflowPlacement(steps, visible, dir)` from the geometry table, computed twice per card (`visible` 1 and 2) and written as the two custom property sets; the browser picks the `lg` set by the `lg:` classes; `dir` from the list's computed `direction` |
| Card width, perspective | px values | `--coverflow-card` and `--coverflow-depth` in `tokens.css` |
| Colours on black | name, muted price, dots, arrows | `text-white`; `text-on-dark-muted`; `bg-yellow` active dot, `on-dark-muted` outline for the rest; the hero card's on dark outline button style |
| Keyboard | which step a key makes | `stepForKey`: left key moves the physical left card in, right key the physical right card in; in RTL the physical left is the inline end, so left = `+1`, right = `−1`; a key with a modifier returns null (no step, no `preventDefault`) |
| Swipe | thresholds | 40px sideways and more sideways than up and down to step; 10px sideways to cancel the following click |
| Motion timing | duration, easing | `--dur-carousel-move`, `--ease-carousel` through `tokenMs` in `motion.ts`, as the circles do; the reduced motion flag from `useReducedMotion` (true on the server) |
| "تسوّق الآن" | target | `shopNowTarget(circles.length)`: `categories` or null |
| WhatsApp button | link | `whatsappUrl(getWhatsappNumber(), Shell.whatsappMessages.general)` (W1), as today |
| Hero words | headline, subline, button labels | existing `Home.heroLine1`, `heroLine2`, `heroText`, `shopNow`, `heroWhatsapp` |

**Key invariants**:
- At most 8 products (spec 0011's featured cap; the newest fallback is capped at 8 too). Every product renders exactly once.
- Exactly one link inside `home-products` at any time, on the centred slide.
- The coverflow never changes `centre` on its own: only a pointer, a key, an arrow, or a dot does.
- The hero never causes a horizontal page scroll: the hero clips, the list does not widen the page.
- Transforms, opacity, and a black overlay are the only depth cues (the design rule test forbids shadows, gradients, and blur).
- The server markup places every card for every width; no placement waits for a client media query.

**Security model**: public read only page; no new action, no new data. Nothing to add to RLS.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path, phone: two picked products plus six newest show in the coverflow at 390; a swipe moves one step; a tap on the side card centres it; the centre link opens the product page, verifies **AC-2**, **AC-4**, **AC-5**, **AC-6**, **AC-10**
- Desktop: at 1280 two neighbours on each side; the arrow buttons, the arrow keys, and a dot move it; the live text names the centred product, verifies **AC-4**, **AC-6**, **AC-8**, **AC-10**
- Motion: a step with reduced motion emulated lands at once; without it the crossing card does not pass through the centre, verifies **AC-7**
- Counts: 1 product shows alone with no controls; 2 swap on every move, verifies **AC-9**
- Fallbacks: no picks shows the newest products; no products or a timed out read shows the fallback card with the one `h1`, verifies **AC-2**, **AC-11**, **AC-14**
- Banners: with banners on, the carousel sits under the hero centred at 720 at 1280, no side card, and the `h1` is still the hero headline, verifies **AC-1**, **AC-12**
- Existing flows: every flow that opens a product from `home-products` passes unchanged; axe passes, verifies **AC-5**, **AC-15**

## Build plan

Tracer Bullet: the first task puts the coverflow in the real page end to end on a phone with the products already in place server side, so the existing flows prove the page still works, then each later task thickens one layer.

1. [x] **Thin thread: the hero in place.** The two tokens in `tokens.css`; `hero-coverflow.tsx` renders the section outside the `PageFrame`, the `h1`, the subline, the list (plain `li`, inner slide group) with the centre card link, the reserved words block, and still side cards placed for both widths from the geometry table (no movement yet), the buttons row; `page.tsx` takes the new order, chooses coverflow or fallback card, drops the hidden `h1`, removes `FeaturedSection`, moves banners under the hero, and updates the banner `sizes`; `shopNowTarget`, `hero-card.tsx`, `section-jump.tsx`, and `section-ids.ts` lose the featured target; `loading.tsx` takes the new shape. Run the e2e flows that open the first link in `home-products`, and retarget `first-order`, `homepage`, and the `home` test of `storefront-layout` as AC-15 says. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-14**
2. [x] **Movement on a phone.** `motion.ts`, `coverflowPlacement` with z index and the next out place, `circleSteps` reuse, the state, swipe and tap telling (40px and 10px thresholds, the capture phase click guard, `touch-pan-y`, no dragging), the side slide tap, the transition with visibility and the overlay, the crossing fade through the Web Animations API with the width read in px, reduced motion, focus following the centre link, the live text and the named dots, the 1 and 2 product rules; Vitest for every rule. Satisfies **AC-4**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
3. [x] **Tablet and desktop.** The band from `md`, centring from `lg`, the `lg:` placement classes on every card, the arrows from `lg` at the content box edges, the keyboard handler with the modifier rule, delete `home-side-card.tsx`; no sideways scroll at every test width. Satisfies **AC-6**, **AC-10**, **AC-12**
4. [x] **Finish.** The Playwright flows of AC-15 on the phone, tablet, and desktop projects, reduced motion emulation, axe on both hero versions, the amendment notes in specs 0011 and 0029 if not yet added. Satisfies **AC-15**

## Consequences

**Positive**:
- The hero shows real products the owner picked, at every width, and each one is one tap from its page.
- No new dependency; the movement code shares its rules and tests with the circle carousel.
- Home gets shorter: the featured grid and the desktop side card go, and the headline shows once.

**Negative / tradeoffs**:
- The add to cart and WhatsApp buttons leave Home: a shopper now goes through the product page to buy, one more tap than the old grid.
- A side product is reachable to screen reader users only by moving the coverflow (arrows, dots), not by reading through the list.
- Two carousels on one phone screen (hero and circles) and 3D transforms cost some paint time on old phones; the product images are limited to 8 and sized small.
- Three e2e flows must be retargeted (AC-15), and any future flow that picks a product by name from Home presses its named dot first.
- Two new tokens in `tokens.css` and a `tokens.css` edit to every later change of the card sizes.

**Neutral**:
- Spec 0011 AC-1, AC-3, AC-5 and spec 0029 AC-13 (a) and (b) are replaced by this spec; both get an amendment line pointing here.
- `home_version` and the editor do not change; the owner's featured picks now have a much more visible home.

## Follow-up

- [ ] The `Home.viewAll` key and the "عرض الكل" link go with the grid; check nothing else uses them before removing the key.
- [ ] The design folder (`docs/design/pages/home.md`) still draws the old hero; when the design board is next updated, add the coverflow to it.
- [ ] After launch, watch whether shoppers miss the add to cart button on Home (a product grid could return lower on the page if they do).
