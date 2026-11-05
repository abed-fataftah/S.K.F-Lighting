# Verify: product management · spec 0006 · updated 2026-10-21
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run against local Supabase (`pnpm db:start`, `pnpm db:migrate`) with `pnpm dev`, signed in as an admin with a code (`aal2`). Phone width 390 unless a step says otherwise.

## UI / manual
- [x] Open `/admin/products` → 50 rows a page, newest first; next and previous links keep the filters; `?page=abc` reads as page 1 and a page past the end shows the "no match" card → AC-1
- [x] Type a code start in lower case (`e2e-`) and press بحث → rows whose code starts with it; type part of a name → rows whose name contains it; type `50%` → matches the literal text only → AC-1
- [x] Pick a main category → its products and its sub categories' products; put a random uuid in `categoryId=` → the list is not filtered → AC-1
- [x] Each chip (الكل, متوفر, غير متوفر, مخفي, مؤرشف) sets `filter=` in the address and combines with search and category; الكل never shows archived products → AC-1
- [x] A product with sizes priced 100 and 150 (one size unticked) shows `من ₪100` and `2 أحجام · 2 ألوان`; a simple product shows `₪X` and an empty options cell; the first photo by order shows as the tile, else the lamp placeholder → AC-1
- [x] `/admin/products/new` → empty editor with the five suggested spec rows; save with name, code ` ch-x1 `, a new category, price `١٢٥٫٥` → "تم الحفظ", address becomes `/admin/products/<id>`, code stored `CH-X1`, price ₪125.50, "عرض في المتجر" and "+ إضافة منتج آخر" shown → AC-2
- [x] Save again from that same screen (change the name) → saves, version goes up, the main category select shows the category just created → AC-2, AC-11
- [x] Reuse a taken code → "هذا الرمز مستخدم لمنتج آخر" on the code field with focus on it, nothing saved → AC-2
- [x] Add a size, then remove it → the single price field comes back with the value it had → AC-3
- [x] Add 12 sizes → the add button disappears; type `XL` and ` xl ` → the second row says the value repeats → AC-4
- [x] Move a size up and down, save, reload → the order holds; every pair of a size has that size's price → AC-4
- [x] "+ إضافة لون": typing a listed colour's name offers that colour, not "إضافة «…»"; typing a new name offers add; a colour already on the product says it is already added; save creates the new colour (hex empty) → AC-5
- [x] Sizes and colours together → the grid scrolls inside its own box; each tick reads `<size> <colour>` to a screen reader; untick one pair, save → the shop cannot add that pair; untick all → the list shows غير متوفر → AC-6
- [x] Sizes only (or colours only) → each row has its own "متوفر" tick; a simple product has none → AC-6
- [x] Order a pair as a guest, then rename its size, change its price, remove it, and add it back → the admin order page shows the line exactly as ordered every time → AC-7
- [x] Pick a large photo (for example 4000 by 3000 JPEG) → the tile shows progress, then the photo; the stored file is WebP (or JPEG on Safari) with its longest edge 2,000 → AC-8
- [x] Pick a file the browser cannot read (a renamed text file) → "لا يمكن استعمال هذه الصورة" on its tile; 8 photos → the add tile hides; removing one frees its slot → AC-8
- [x] Turn the network off during an upload → "تعذّر الرفع" with retry and remove; save is disabled until it is retried or removed → AC-8
- [x] Move photos earlier and later, "make main" on the third → after save and reload the order holds and the first is marked رئيسية; the video tile always sits after the photos → AC-8
- [x] Leave a spec value empty → that row is gone after save; a value with an empty label → "هذا الحقل مطلوب" on the label → AC-9
- [x] Untick "إظهار المنتج في المتجر" and save → `/p/<slug>` is not found on the very next request and the product leaves the home grid; untick "متوفر" instead → the product page shows out of stock with add to cart disabled → AC-10
- [x] Open the same product in two tabs; save in tab 1, then save in tab 2 → banner "تغيّر هذا المنتج منذ فتحته" with "إعادة التحميل"; typed values stay until you press it; pressing it shows the stored product → AC-11
- [x] Delete a product nobody ordered → the dialog says it will be deleted for good; confirm → back on the list, its Storage folder `products/<id>/` is gone, its code can be reused → AC-12
- [x] Delete an ordered product → the dialog says it will be archived; confirm → "مؤرشف" banner, every field disabled, no save, delete, or view; "استعادة" → editor opens with "إظهار المنتج في المتجر" unticked (hidden) → AC-12
- [x] On edit the code field is read only; a rename keeps the same `/p/<slug>` address → AC-13
- [x] Type in any field, then close or reload the tab → the browser's leave warning; press "إلغاء" → "المغادرة دون حفظ؟"; after a save neither appears → AC-14
- [x] Remove a photo and save → its file stays in Storage until it is more than an hour old, then a later save removes it → AC-15
- [x] axe passes on the list, the new editor, the edit editor, and the archived view, with no sideways page scroll at 390 → AC-17
- [x] Sub category under the wrong main (edit the request) or no category → "اختر فئة أو اكتب اسم فئة جديدة"; a product saved with a sub opens with both selects filled → AC-18

## Value sourcing
- [x] New editor id: reload `/admin/products/new` twice → a different id each time; uploads land in `products/<that id>/` before the first save → Value sourcing: product `id`
- [x] `slug` = `buildProductSlug(name, code)` on create, unchanged after a rename → Value sourcing: `slug`
- [x] `code` trimmed and uppercased, typed with Arabic digits (`ch-١٠٢٠` → `CH-1020`) → Value sourcing: `code`
- [x] `category_id` is the sub when chosen, else the main, else the category found or made from the typed name (a typed name equal to an existing top level category reuses it) → Value sourcing: `category_id`
- [x] `status` follows the show switch; `is_available` follows the available switch → Value sourcing: `status`, `is_available`
- [x] `version` goes 1, 2, 3 across create, save, save; a stale save leaves it as is → Value sourcing: `version`
- [x] Variant `price` is the size's typed price (Arabic digits and `1,250` accepted) or the single price; `size_sort` and `sort` follow row order; `is_available` follows the tick → Value sourcing: variant columns
- [x] `is_default` is the first available pair by size then colour order; with all unticked, the first pair → Value sourcing: `is_default`
- [x] A removed pair is archived only when an order line points at it, else deleted → Value sourcing: archive or delete
- [x] Media `sort` follows tile order with the video last; `width` and `height` are the resized bitmap's → Value sourcing: media
- [x] `storage_key` is `products/<productId>/<uuid>.<webp|jpg|mp4>`, never a name the browser chose → Value sourcing: `storage_key`
- [x] List price is the lowest live variant price, available or not (it differs from the shop's list price when the cheapest pair is unticked) → Value sourcing: list price

## Commands
- [x] `pnpm exec vitest run src/features/catalog src/lib src/server/storage` → all pass (planVariants table, schema shape rules, media rules, list helpers, editor state, action guards) → AC-3 to AC-9, AC-13, AC-16
- [x] `pnpm exec vitest run src/features/catalog/server/save-product.db.test.ts src/server/db/schema` → all pass, including the order history test and the delete versus new order race → AC-7, AC-11, AC-12
- [x] `pnpm db:check-rls` → passes; `media_sweep` can read `products.id` and nothing else → AC-15
- [x] `pnpm media:sweep` → `media_sweep_done`; a folder with no product and files older than a day is removed, a fresh one is kept → AC-15
- [x] `pnpm exec playwright test e2e/product-management.spec.ts e2e/first-order.spec.ts --project=phone` → all pass → AC-17
- [x] `E2E_TARGET=preview pnpm exec playwright test e2e/product-management.spec.ts --project=phone` → passes on workerd (uploads, `after()` cleanup) → AC-8, AC-15, AC-17

## Acceptance-criteria coverage
- AC-1 list, search, chips, paging · AC-2 create · AC-3 simple price · AC-4 sizes · AC-5 colours · AC-6 ticks and grid · AC-7 history (DB tests) · AC-8 photos and video · AC-9 specs · AC-10 switches · AC-11 stale · AC-12 delete, archive, restore · AC-13 fixed code and slug · AC-14 leave warning · AC-15 cleanup and sweep · AC-16 admin only and key checks (unit tests) · AC-17 phone flow · AC-18 category
