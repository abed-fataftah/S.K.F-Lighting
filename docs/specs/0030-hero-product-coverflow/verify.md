# Verify: Hero product coverflow · spec 0030 · updated 2026-11-18

_Steps derived from spec 0030 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open `/` at 390 wide with picks → the yellow strip, the header, the black hero card with the one `h1` "ثريات وإنارة / وكهربائيات", then the categories, the trust cards, the footer; no "منتجات مختارة" section and no `#featured` target → AC-1
- [ ] Turn a banner on in `/admin/homepage` → the banner carousel sits under the hero; the `h1` is still the hero headline, no hidden shop name `h1` → AC-1, AC-12
- [ ] Pick two products in the editor → the coverflow shows them in pick order; untick them → the eight newest sellable products fill it instead → AC-2
- [ ] Hide every active product → the fallback card with the chandelier, the `h1`, the subline, and the buttons shows; from `md` it keeps the content width → AC-2, AC-11
- [ ] At 390 the hero is a rounded card with 16px side margins; at 820, 1280, and 1920 it is a black band across the whole screen whose words and cards stay inside the 1280 content box → AC-3, AC-10
- [ ] Below 1024 the words and buttons are start aligned; from 1024 they are centred → AC-3
- [ ] Inspect the region: `aria-roledescription="carousel"`, `aria-label="المنتجات المختارة"`, a `ul` `home-products` with one plain `li` per product and an inner `role="group"` slide labelled "N من M"; side `li` are `aria-hidden` → AC-4
- [ ] Look at the side cards: smaller, turned toward the centre, dimmed and tinted black; nearer cards stack over further ones; no shadow, blur, or gradient anywhere on the hero → AC-4
- [ ] At 390 and 820 one neighbour shows per side and the next card out is invisible; at 1280 two per side; at 390 at least a quarter of each neighbour is visible inside the hero card → AC-4, AC-10
- [ ] Measure the centre card: 220 wide at 390, 260 at 820, 300 at 1280; the page never scrolls sideways at 390, 768, 820, 1024, 1280, or 1920 → AC-10
- [ ] The centre card alone holds a link: image, name (two lines reserved, long names clipped at two, full name in the accessible name), and the price; the side cards show only the picture → AC-5
- [ ] Pick a product with differing variant prices → the centre price reads "من ₪X"; one out of stock → its image at 45%, the black "غير متوفر" label on every slide it sits on, and a muted price in the centre; one with no live variant → no price line text, and the dots and buttons do not move → AC-5
- [ ] Swipe left and right on a phone → one step each way, the cards following the finger; drag the centre card 60px → it steps and the product page does not open; tap a side card → it comes to the centre; drag a side card → one step only → AC-6
- [ ] From 1024 the arrows "المنتج السابق" and "المنتج التالي" sit at the content box edges level with the image, 44×44, and step one product; below 1024 they are absent → AC-6
- [ ] With focus on the centre link press ArrowLeft → the card on the physical left comes in and the new centre link has focus; ArrowRight brings the right card; Shift+ArrowRight does nothing → AC-5, AC-6
- [ ] Press the arrows eight times with eight products → it loops back to the first; nothing ever moves by itself and there is no pause button → AC-6
- [ ] Watch a step: cards slide over 0.7s with the carousel easing, the tint moving with each card; a card that would pass through the middle fades out where it was and in on its new side instead → AC-7
- [ ] Emulate `prefers-reduced-motion: reduce` and step → every card lands at once, no fade → AC-7
- [ ] Load `/` cold at 1280 → the cards are already in their desktop places with no jump; resize across 1024 → the places change without a flash → AC-7
- [ ] Tab through the hero: arrows (from 1024), the centre link, the dots, "تسوّق الآن", the WhatsApp button; the dots are named "المنتج N من M: <name>", the centred one yellow with `aria-current="true"`; press a dot four away in eight → it goes the shortest way; a screen reader hears "المنتج في المنتصف: <name>" after each move → AC-8
- [ ] One pick → the centre card alone with its link, name, and price; no arrows, dots, live text, or swipe → AC-9
- [ ] Two picks → the other one always on the inline end (left) side; every arrow, key, swipe, or tap swaps them; the dots show two → AC-9
- [ ] Banners on at 820 and 1280 → the carousel is centred at most 720 wide under the hero; no side card; the banner `img` `sizes` is `(min-width: 768px) 720px, (min-width: 480px) 448px, 100vw` → AC-12
- [ ] Inspect the images: the first centred image eager with `fetchpriority="high"`, the rest lazy, every `alt` empty, `sizes` `(min-width: 1024px) 300px, (min-width: 768px) 260px, 220px` → AC-13
- [ ] Throttle the network and open `/` → the loading skeleton shows the hero's shape (two lines, a card block, dots, two buttons) on black, then the circles and trust blocks; no grid block → AC-14
- [ ] Stop the database and open `/` → `home_read_failed` with part `featured` is logged and the fallback card shows; the rest of Home still renders → AC-14
- [ ] Run axe on `/` with the coverflow and with the fallback card → no violations → AC-15
- [ ] "تسوّق الآن" jumps to the categories heading; untick every main for Home → the button is hidden on both heroes → AC-3, AC-11
- [ ] Save a WhatsApp number in settings → the hero's green button opens that number with the general message → Value sourcing (WhatsApp button)

## Commands

- [ ] `pnpm exec vitest run home-rules page.test design-rules messages` → passes (placement, steps, crossing, keys, swipe, hero choice, page order) → AC-15
- [ ] `pnpm exec playwright test e2e/hero-coverflow.spec.ts e2e/storefront-layout.spec.ts --grep home` on `phone`, `tablet`, `desktop` → passes → AC-15
- [ ] `pnpm exec playwright test --project=homepage --no-deps` → passes (picks, two swap, one alone, newest fallback, fallback card, banners under the hero) → AC-2, AC-9, AC-11, AC-12, AC-15
- [ ] `pnpm exec playwright test e2e/guest-order.spec.ts e2e/checkout-delivery.spec.ts e2e/arabic-language.spec.ts e2e/policies.spec.ts e2e/first-order.spec.ts --project=phone` → passes unchanged (`shop-settings` and `rate-limit` in their own projects) → AC-15

## Acceptance-criteria coverage

- AC-1 Home order and the `h1` · AC-2 hero products · AC-3 hero layout · AC-4 the coverflow · AC-5 the centre card · AC-6 moving it · AC-7 motion · AC-8 position · AC-9 small counts · AC-10 widths · AC-11 fallback card · AC-12 banners under the hero · AC-13 images · AC-14 loading and errors · AC-15 tests: each covered by the steps tagged above.
