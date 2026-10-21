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
- [ ] Verify it: `/check verify product management`
- [ ] Test it: `/test product management`

### 8. Spreadsheet import & bulk photos · needs a decision
A ready made spreadsheet template you (or a helper) fill in, uploaded once to create many products, then photos uploaded in bulk and matched by product code in the file name.
**Done when:** a filled template creates products with options and prices, any bad rows are listed clearly without breaking the rest, and bulk photos attach to the right products.
- [ ] Design it (spec): `/architect spreadsheet import & bulk photos`

### 9. Categories & browsing
Manage categories in the dashboard, and let customers browse a category's products as a list with photo, name, code, price, and availability.
**Done when:** you can add, rename, reorder, and hide categories; customers can open any category and see its products, with clear empty and out of stock states.
- [ ] Build it: `/develop categories & browsing`

### 10. Product page · needs a decision
The full product page: photo gallery, optional video, description, dimensions, specifications, size and colour pickers, the price for the chosen size, and add to cart.
**Done when:** choosing a size updates the price, out of stock options cannot be added, and the page works well on a phone in both languages.
- [ ] Design it (spec): `/architect product page`

### 11. Search & filters · needs a decision
Search by product name or product code, and filter by price, size, and colour.
**Done when:** a product code finds the exact product, Arabic product names match, filters combine and show in the page address so a filtered list can be shared, and no results shows a helpful empty state.
- [ ] Design it (spec): `/architect search & filters`

## Slice 8: Shop content

### 25. Homepage, banners & featured products
A homepage you control: banners and featured products chosen in the dashboard, plus quick links to the main categories.
**Done when:** you can add, order, and remove banners and featured products, and the homepage shows them in both languages.
- [ ] Build it: `/develop homepage, banners & featured products`
