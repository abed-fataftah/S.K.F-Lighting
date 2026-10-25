# Catalog

Part of the [S.K.F Lighting scope](index.md). Getting products in, and helping customers find them.

## Slice 2: Catalog

### 7. Product management · in-progress
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

### 8. Spreadsheet import & bulk photos · in-progress
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
- [ ] Verify it: `/check verify categories & browsing`
- [ ] Test it: `/test categories & browsing`

### 10. Product page · in-progress
The full product page: photo gallery, optional video, description, dimensions, specifications, size and colour pickers, the price for the chosen size, and add to cart.
**Done when:** choosing a size updates the price, out of stock options cannot be added, and the page works well on a phone in both languages.
spec [0009](../specs/0009-product-page/index.md) · code in `src/features/catalog/` (product view, gallery, selection), `src/app/[locale]/p/[slug]/`
- [x] Design it (spec): `/architect product page`
- [x] Build it: `/develop product page`
  - [x] Thin thread: read all live variants and media, size and colour chips with the follow the size rule, live price, `?v` in the address, add the chosen pair, W3 with size and colour (AC-1 to AC-6, AC-8, AC-9)
  - [x] States: out of stock, stale add refresh, three level breadcrumb, real 404 with the shared cached read (AC-7, AC-8, AC-14, AC-16, AC-17)
  - [x] Gallery, video, full screen, and share (AC-10 to AC-13)
  - [x] Search engines and finish: description, canonical, Product and BreadcrumbList JSON-LD, full phone flow and axe (AC-15, AC-18, AC-19)
- [ ] Verify it: `/check verify product page`
- [ ] Test it: `/test product page`

### 11. Search & filters · in-progress
Search by product name or product code, and filter by price, size, and colour.
**Done when:** a product code finds the exact product, Arabic product names match, filters combine and show in the page address so a filtered list can be shared, and no results shows a helpful empty state.
spec [0010](../specs/0010-search-filters/index.md) · code in `src/features/catalog/` (search text, list filters, list query, toolbar and filters screen), `src/app/[locale]/search/`, `src/app/api/catalog/count/`
- [x] Design it (spec): `/architect search & filters`
- [ ] Build it: `/develop search & filters`
  - [ ] Thin thread: migration with `search_text` and `size_key`, Persian folds, `refreshSearchKeys` in the save, backfill script and CI step, `/search` with the prompt and every word matching (AC-1, AC-2, AC-3, AC-7)
  - [ ] Search done properly: code first tiers, paging, query chip, no results, error and loading, header field, metadata (AC-4, AC-5, AC-6, AC-14)
  - [ ] Filters in the address: parse, resolve, serialize, shared list query, toolbar, applied chips, filtered empty state (AC-8, AC-9, AC-13, AC-14)
  - [ ] Filters screen and live count: choices, full screen dialog, count route with its rate limit and proxy changes (AC-10, AC-11, AC-12, AC-15)
  - [ ] Finish: remaining database tests, full phone flow, axe, limiter on preview (AC-16)
- [ ] Verify it: `/check verify search & filters`
- [ ] Test it: `/test search & filters`

## Slice 8: Shop content

### 25. Homepage, banners & featured products
A homepage you control: banners and featured products chosen in the dashboard, plus quick links to the main categories.
**Done when:** you can add, order, and remove banners and featured products, and the homepage shows them in both languages.
- [ ] Build it: `/develop homepage, banners & featured products`
