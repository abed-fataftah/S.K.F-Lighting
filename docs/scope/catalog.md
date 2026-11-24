# Catalog

Part of the [S.K.F Lighting scope](index.md). Getting products in, and helping customers find them.

## Slice 2: Catalog

### 7. Product management · done
Add and edit products in the dashboard: photos, optional videos, description, dimensions, technical specifications (such as wattage and light colour), size and colour options with a price per size, and availability per product and per option.
**Done when:** you can create a product with or without options, set prices per size, mark the product or any single option out of stock, and see the change on the site right away.
spec [0006](../specs/0006-product-management/index.md) · code in `src/features/catalog/`, `src/app/admin/(dashboard)/products/`
- [x] Design it (spec): `/architect product management`
- [x] Build it: `/develop product management`
  - [x] Pure rules and the migration: editor schema, `planVariants`, media rules, list helpers, `products.version` and the one video index (AC-3, AC-4, AC-5, AC-7, AC-9, AC-13)
  - [x] Thin thread: products list and the simple editor replace the slice 1 form, with the version check (AC-2, AC-3, AC-10, AC-11, AC-13, AC-16, AC-18)
  - [x] Sizes, colours, and the pair grid, with archive and restore of ordered pairs (AC-4 to AC-7)
  - [x] Photos and video: signed uploads, browser resize, tiles, cleanup after save (AC-8, AC-15, AC-16)
  - [x] Finish: specs rows, delete, archive and restore, list filters and paging, unsaved guard, weekly sweep, full phone flow (AC-1, AC-9, AC-12, AC-14, AC-15, AC-17)
- [x] Verify it: `/check verify product management`
- [x] Test it: `/test product management`

### 8. Spreadsheet import & bulk photos · done
A ready made spreadsheet template you (or a helper) fill in, uploaded once to create many products, then photos uploaded in bulk and matched by product code in the file name.
**Done when:** a filled template creates products with options and prices, any bad rows are listed clearly without breaking the rest, and bulk photos attach to the right products.
spec [0007](../specs/0007-spreadsheet-import-bulk-photos/index.md) · code in `src/features/catalog/` (import files `import-*.ts`, `photo-names.ts`, `components/import/`, `server/import-*.ts`)
- [x] Design it (spec): `/architect spreadsheet import & bulk photos`
- [x] Build it: `/develop spreadsheet import & bulk photos`
  - [x] Thin thread: one simple product from an .xlsx through `importProducts` to the products list (AC-1, AC-3, AC-4, AC-7, AC-16)
  - [x] Options, updates, categories, colours, all or nothing per product, CSV (AC-5, AC-6, AC-8, AC-9, AC-10, AC-11)
  - [x] Review and the batched run with progress (AC-14, AC-15)
  - [x] Photos: name matching, resize and upload queue, `setProductPhotos` (AC-12, AC-13, AC-16)
  - [x] Finish: template download, problems download, full phone flow and axe (AC-2, AC-15, AC-17)
- [x] Verify it: `/check verify spreadsheet import & bulk photos`
- [x] Test it: `/test spreadsheet import & bulk photos`

### 9. Categories & browsing · in-progress
Manage categories in the dashboard, and let customers browse a category's products as a list with photo, name, code, price, and availability.
**Done when:** you can add, rename, reorder, and hide categories; customers can open any category and see its products, with clear empty and out of stock states.
spec [0008](../specs/0008-categories-browsing/index.md) · code in `src/features/catalog/` (category rules, card, category pages), `src/app/[locale]/c/`, `src/app/admin/(dashboard)/categories/`
- [x] Design it (spec): `/architect categories & browsing`
- [x] Build it: `/develop categories & browsing`
  - [x] Pure rules: shown, navigation, category order, reorder plan, card view, sellable gains "category shown" (AC-4, AC-6, AC-7, AC-10, AC-12, AC-14)
  - [x] Thin thread: add a category, its page at `/c/<main>` and `/c/<main>/<sub>`, hidden means hidden across home, product page, cart, and orders (AC-1, AC-2, AC-4a, AC-6 to AC-10, AC-18)
  - [x] The card: photo, spec chips, prices, out of stock look, add and WhatsApp buttons, on home too (AC-12)
  - [x] Dashboard: edit, reorder, delete when empty, states, and the product editor change (AC-1, AC-3, AC-4, AC-4a, AC-5, AC-17)
  - [x] Storefront: menu list, `/c`, paging, states, search engine tags, and the full phone flow (AC-9, AC-11, AC-13 to AC-16, AC-19)
- [x] Verify it: `/check verify categories & browsing`
- [ ] Test it: `/test categories & browsing`

### 10. Product page · done
The full product page: photo gallery, optional video, description, dimensions, specifications, size and colour pickers, the price for the chosen size, and add to cart.
**Done when:** choosing a size updates the price, out of stock options cannot be added, and the page works well on a phone in both languages.
spec [0009](../specs/0009-product-page/index.md) · code in `src/features/catalog/` (product view, gallery, selection), `src/app/[locale]/p/[slug]/`
- [x] Design it (spec): `/architect product page`
- [x] Build it: `/develop product page`
  - [x] Thin thread: read all live variants and media, size and colour chips with the follow the size rule, live price, `?v` in the address, add the chosen pair, W3 with size and colour (AC-1 to AC-6, AC-8, AC-9)
  - [x] States: out of stock, stale add refresh, three level breadcrumb, real 404 with the shared cached read (AC-7, AC-8, AC-14, AC-16, AC-17)
  - [x] Gallery, video, full screen, and share (AC-10 to AC-13)
  - [x] Search engines and finish: description, canonical, Product and BreadcrumbList JSON-LD, full phone flow and axe (AC-15, AC-18, AC-19)
- [x] Verify it: `/check verify product page`
- [x] Test it: `/test product page`

### 11. Search & filters · in-progress
Search by product name or product code, and filter by price, size, and colour.
**Done when:** a product code finds the exact product, Arabic product names match, filters combine and show in the page address so a filtered list can be shared, and no results shows a helpful empty state.
spec [0010](../specs/0010-search-filters/index.md) · code in `src/features/catalog/` (search text, list filters, list query, toolbar and filters screen), `src/app/[locale]/search/`, `src/app/api/catalog/count/`
- [x] Design it (spec): `/architect search & filters`
- [x] Build it: `/develop search & filters`
  - [x] Thin thread: migration with `search_text` and `size_key`, Persian folds, `refreshSearchKeys` in the save, backfill script and CI step, `/search` with the prompt and every word matching (AC-1, AC-2, AC-3, AC-7)
  - [x] Search done properly: code first tiers, paging, query chip, no results, error and loading, header field, metadata (AC-4, AC-5, AC-6, AC-14)
  - [x] Filters in the address: parse, resolve, serialize, shared list query, toolbar, applied chips, filtered empty state (AC-8, AC-9, AC-13, AC-14)
  - [x] Filters screen and live count: choices, full screen dialog, count route with its rate limit and proxy changes (AC-10, AC-11, AC-12, AC-15)
  - [x] Finish: remaining database tests, full phone flow, axe, and the count limiter on preview (AC-16)
- [ ] Verify it: `/check verify search & filters`
- [ ] Test it: `/test search & filters`

## Slice 8: Shop content

### 25. Homepage, banners & featured products · done
A homepage you control: banners and featured products chosen in the dashboard, plus quick links to the main categories.
**Done when:** you can add, order, and remove banners and featured products, and the homepage shows them in Arabic.
spec [0011](../specs/0011-homepage-banners-featured/index.md) · code in `src/features/home/`, `src/app/[locale]/(home)/`, `src/app/admin/(dashboard)/homepage/`, the category dialog in `src/features/catalog/`
- [x] Design it (spec): `/architect homepage, banners & featured products`
- [x] Build it: `/develop homepage, banners & featured products`
  - [x] Thin thread: migration, image keys and crop, upload, add a banner in `/admin/homepage`, new Home with banner or hero and the newest fallback (AC-1, AC-2, AC-3, AC-13, AC-14, AC-15)
  - [x] Banners and featured: edit, links and picker, delete, caps, full carousel, page save with the version check, featured list on Home (AC-2, AC-5, AC-8, AC-9, AC-10, AC-12)
  - [x] Category circles: photo and line in the category dialog, Home ticks, circle carousel with pause, a single circle alone (AC-4, AC-8, AC-11)
  - [x] Carousel from 2 circles (spec 0011 amended 2026-11-08): threshold 2, the side changing circle fades, the lone circle, tests (AC-4, AC-16)
  - [x] Fees, trust cards, states, sweep: strip and cards from `delivery_zones`, address fallback, per section failures, editor states, weekly sweep (AC-6, AC-7, AC-8, AC-13)
  - [x] Finish: remaining tests, phone flow, axe (AC-16)
- [x] Verify it: `/check verify homepage, banners & featured products`
- [x] Test it: `/test homepage, banners & featured products`

### 37. Hero product coverflow · in-progress
A 3D coverflow of the featured products as the Home hero at every width: the headline above, one large product card in the centre, smaller angled cards on each side, arrows on desktop, finger swiping on phones, and a smooth slide that brings the chosen product to the centre. Uses the shop's tokens and type (depth through scale and tint, since the design rules allow no shadows). The banner carousel moves below it when banners are on.
**Done when:** the featured products show as the coverflow at 390, 820, and 1280px with the neighbours partly visible on a phone, arrows and keyboard move it on desktop, a swipe moves it on a phone, the centre card opens its product page, motion stops under reduced motion, and the existing Home tests still pass.
spec [0030](../specs/0030-hero-product-coverflow/index.md) · code in `src/features/home/components/hero-coverflow.tsx`, `src/features/home/home-rules.ts`, `src/features/home/motion.ts`, `src/app/[locale]/(home)/`, `src/app/tokens.css`, `e2e/hero-coverflow.spec.ts`
- [x] Design it (spec): `/architect hero product coverflow`
- [x] Build it: `/develop hero product coverflow`
  - [x] Thin thread: the two tokens, the hero in place outside the page frame with still cards for every width, the new Home order, the grid and side card gone, banners under the hero, the three flows retargeted (AC-1, AC-2, AC-3, AC-5, AC-10, AC-11, AC-12, AC-13, AC-14)
  - [x] Movement on a phone: swipe and tap, the crossing fade, reduced motion, focus following the centre, named dots and live text, the 1 and 2 product rules, unit tests (AC-4, AC-6, AC-7, AC-8, AC-9)
  - [x] Tablet and desktop: the black band, two neighbours each side, arrows, keyboard, no sideways scroll (AC-6, AC-10, AC-12)
  - [x] Finish: Playwright at 390, 820, and 1280, reduced motion, axe on both hero versions (AC-15)
- [ ] Verify it: `/check verify hero product coverflow`
- [ ] Test it: `/test hero product coverflow`

### 42. Home category cards & their products · in-progress
Under the hero, the category circles become a row of 3D photo cards that work like tabs: the pressed card's category shows its first eight products in a grid right under it, with a link to the full category page. The first category in the owner's order opens selected and its products come with the page; the others load on press and are kept for the visit. The cards turn to face the pressed one and tilt under a mouse; nothing moves by itself.
**Done when:** the ticked mains show as photo cards at 390, 820, and 1280px, the first category's products are on the page without JavaScript, pressing or arrow keying to another card swaps the heading and the eight products, "عرض الكل" opens the category page, a failed load shows a retry notice, and the existing Home tests still pass.
spec [0031](../specs/0031-home-category-cards-products/index.md) · code in `src/features/home/`, `src/app/api/catalog/home-products/`, `src/app/[locale]/(home)/`, `src/app/tokens.css`
- [x] Design it (spec): `/architect home category cards with products`
- [x] Build it: `/develop home category cards with products`
  - [x] Thin thread: the route under `/api/catalog/`, the eight product read, the tab cards with keys, the server rendered first grid, press and swap with the skeleton, the circles gone, the flows retargeted (AC-1, AC-2, AC-3, AC-6, AC-7, AC-9, AC-10)
  - [x] The 3D cards: the tokens, the turn toward the pressed card within its row, scale and yellow edge, tint, mouse tilt, the padded snap row and the wrapped rows, reduced motion, unit tests (AC-4, AC-5, AC-11)
  - [x] Resilience: prefetch on hover and focus and the neighbours after first paint, the key wait, the stale guard, the failure notice with retry, the route and read tests (AC-7, AC-8, AC-11)
  - [x] Finish: Playwright on phone, tablet, and desktop, the no JavaScript check, axe (AC-11)
- [ ] Verify it: `/check verify home category cards with products`
- [ ] Test it: `/test home category cards with products`

### 44. Whole product photos in every frame · in-progress
Product photos are uploaded whole, but the Home hero cards, product cards (Home, category, search, and related lists), and the cart, order, and draft thumbnails zoom and crop them to fill a fixed frame, so a box or bulb photo loses its edges. Show the full photo inside each frame on the product background instead; category cards and banners keep their chosen crop. Decided 2026-11-24: show the whole photo, no crop tool, no blurred fill.
**Done when:** every product photo shows complete, uncropped, in the hero coverflow, every product card, and every line thumbnail at 390, 820, and 1280px, the hover zoom still stays inside the card, the product page gallery is unchanged, and the existing Home, catalog, and cart tests pass.
code in `src/features/catalog/components/product-card.tsx`, `src/features/home/components/hero-coverflow.tsx`, and the cart, order, draft, picker, and admin table thumbnails
- [x] Build it: `/develop whole product photos in every frame`
  - [x] Hero coverflow and product card: the photo fits whole inside the frame on the product background, the hover zoom stays clipped
  - [x] Line thumbnails (cart, order summary, draft combobox, homepage product picker, admin products table): same fit
  - [x] Self check: typecheck, lint, unit tests, and the Home, catalog, and cart flows on phone, tablet, and desktop
