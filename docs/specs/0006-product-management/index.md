# 0006. Product management in the dashboard

**Date**: 2026-10-21
**Status**: In Progress

## Summary

This spec turns the four field product form from slice 1 into the full product editor and adds the products list. You add photos (shrunk in the browser before upload), one optional video, a description, specifications, sizes with a price each, colours from the shared list, and a small grid that marks any size and colour pair in or out of stock. One save writes everything in a single database transaction (all or nothing), and a save is refused if the product changed since you opened it. Products that were never ordered can be deleted. Ordered ones are archived instead, so old orders stay correct.

## Requirements

**User stories**:
- As the owner, I want to add a chandelier with its photos, sizes, colours, and prices in one form, so that it is on sale the moment I save.
- As the owner, I want to mark one size and colour pair, or the whole product, out of stock, so that customers cannot order what I do not have.
- As the owner, I want to find any product by name or code and see its price, options, and status at a glance, so that I can keep the catalog tidy.
- As the owner, I want old orders to stay exactly as they were when I edit, archive, or delete a product, so that my records never change behind my back.

**Acceptance criteria**:
- **AC-1**: Products list. `/admin/products` shows 50 products per page, newest first (`created_at desc, id desc`, so equal times never repeat or skip across pages), with the orders list paging (`page` in the address, next and previous links; a missing, invalid, or too high page behaves as the orders list does). Columns: main photo (first image by `sort`, else `ImagePlaceholder`), name (link to the editor), code (`dir="ltr"`), category (`<main> › <sub>`, or the main alone), price (lowest `price` among the product's variants with `archived_at is null`, available or not, which deliberately differs from the shop's list price over sellable variants; shown `₪X`, or `من ₪X` when those prices differ), options (`N أحجام · N ألوان`, each part only when above 0, empty for a simple product), status badge, and an "تعديل" button. Status for both the badge and the chips: `archived` → مؤرشف; `hidden` → مخفي; `active` with a sellable variant (spec 0002: product `is_available`, variant `is_available` and `archived_at is null`) → متوفر; `active` without one → غير متوفر. Filter chips: الكل (everything but archived, the default), متوفر, غير متوفر, مخفي, مؤرشف. The search box `q`, the category select (a main category includes its sub categories), and the chip are all in the address and combine. Search: after `tidyText` and `toWesternDigits`, a match is a code that starts with the uppercased query, or a name that contains the query (case insensitive, `%` and `_` escaped). A query that is empty after tidying means no search, and a `categoryId` that is not a uuid or names no category means all categories. No match shows an empty state with a "clear filters" link.
- **AC-2**: Create. `/admin/products/new` opens an empty editor whose product id is a fresh uuid chosen by the server when the page renders. Required fields are name (2 to 120 characters) and code (trimmed and uppercased, must match `^[A-Z0-9][A-Z0-9-]{0,29}$`, unique, and a taken code shows "this code is used" on the field), plus a category (AC-18) and a price (AC-3 or AC-4). Description is optional, at most 4,000 characters, and tidied per spec 0005. "حفظ المنتج" creates the product with that id and `slug = buildProductSlug(name, code)`. The address then becomes `/admin/products/<id>`, showing "تم الحفظ", a "view in shop" link (only when the product is `active`), and "+ إضافة منتج آخر".
- **AC-3**: Simple product. With no sizes and no colours, the editor shows one "السعر" field (shekels as typed, parsed by `parseShekels`, above 0 and at most ₪1,000,000). The product then has exactly one live variant (no size, no colour, `is_default = true`) carrying that price, always `is_available = true`. The product level "متوفر" switch (AC-10) is its only availability control, so the editor shows no second tick. Removing the last size brings the single price field back holding the value it had before the first size was added (empty if none).
- **AC-4**: Sizes. "+ إضافة حجم" adds a row with a label (1 to 40 characters, tidied) and a price (rules as AC-3). There are at most 12 sizes. Two labels that are equal after `tidyText` and lowercasing are rejected on the second row. Rows have "move earlier" and "move later" buttons and a remove button, and their order becomes `size_sort` (0, 1, 2…). As soon as one size exists, the single price field of AC-3 is gone. Price is set per size only: every pair of a size carries that size's price.
- **AC-5**: Colours. "+ إضافة لون" opens a search over the shared `colours` list. Typing a name not in the list offers "add «name»", which creates the colour on save (name tidied, `hex` null, `sort` 0). Names compare after `tidyText` and lowercasing: a typed name matching a listed colour selects that colour instead of offering "add", and if a matching colour exists by save time, that row is reused. There are at most 12 colours per product. A colour (or new name) already on the product is rejected on the second row. Rows can be reordered (the order becomes variant `sort`) and removed. With colours and no sizes, the product has one price (the AC-3 field).
- **AC-6**: Availability. With both sizes and colours, a grid (sizes as rows, colours as columns, inside its own horizontal scroll box) shows one checkbox per pair, labelled `<size> <colour>` for screen readers. With only sizes or only colours, each row has its own "متوفر" checkbox. A simple product has none (AC-3). A new pair starts ticked, and a restored pair takes the tick from the form. Unticking every pair is allowed: the product then lists as غير متوفر. Unticking sets that variant's `is_available = false`, and the shop then refuses to add that pair (spec 0004 AC-5 rule).
- **AC-7**: Saving options keeps history intact.
  - *Matching*: each wanted pair is matched to a live row by size identity (`originalLabel`, the label when the editor loaded it, so a rename updates the same rows; a new size row has none and never matches a live row) and `colour_id`. Moving between a simple product and one with options keeps the plain row: it becomes the first wanted pair (first size, first colour), and on the way back the first live pair becomes the plain row. Either way the id is kept, so carts survive.
  - *Plan*: matched rows are updated (label, `size_sort`, `sort`, price, availability). New pairs are inserted, or, when an archived row with the same size label and colour exists, that row is restored (`archived_at = null`). Pairs no longer wanted are deleted when no `order_lines` or `draft_lines` row references them, else archived (`archived_at = now()`, `is_default = false`). An archived row whose (label, colour) a renamed or inserted live row needs is first relabelled `__archived_<variantId>` (order lines keep their own copy of the label).
  - *Default*: exactly one live variant is `is_default`: the first available live pair by size order then colour order, else the first live pair.
  - Every existing order line reads the same before and after the save.
- **AC-8**: Photos and video. "+ إضافة صورة" accepts images the browser can decode. Each is scaled so its longest edge is at most 2,000 px (never enlarged) and encoded as WebP at quality 0.85, or JPEG at 0.85 when the browser cannot encode WebP. A result above 10 MB, or a file the browser cannot decode, shows "this image cannot be used" on its tile. "+ إضافة فيديو" accepts `video/mp4` up to 50 MB, uploaded as is. A product holds at most 8 photos and 1 video, counting tiles not removed (failed ones included until removed), and the add buttons hide at the limit; removing a tile frees its slot at once. The video tile sits apart after the photos, with no move or make main buttons, and is always stored after the photos in `sort`. Photo `width` and `height` are measured from the resized bitmap. Each file uploads at once to Storage through a signed upload URL, showing progress on its tile. A failed upload shows "retry" and "remove", and "حفظ المنتج" is disabled while any upload is running or failed. Photo tiles have "move earlier", "move later", "make main" (moves it first), and "remove photo N". The saved order becomes `sort` (0 is the main photo). Removing a tile takes effect on save.
- **AC-9**: Specifications. A new product (create only, never an existing one with empty specs) opens with empty rows labelled القطر (سم), الارتفاع (سم), نوع القاعدة, القدرة, and لون الإضاءة. "+ إضافة مواصفة" adds a row with a free label. Rows can be reordered and removed. A row with an empty value is dropped on save, a value with an empty label is a field error, and repeated labels are allowed. A label is 1 to 40 characters, a value 1 to 120 (both tidied), at most 30 rows, and they are stored in order in `products.specs` as `{ label, value }`.
- **AC-10**: Status switches. "إظهار المنتج في المتجر" sets `status` to `active` (ticked) or `hidden`, and "متوفر" sets `products.is_available`. After a save, the very next storefront request shows the change: a hidden product's page returns not found and it leaves the home grid, and an unavailable product shows out of stock with add to cart disabled.
- **AC-11**: Stale save. The editor loads `products.version` and sends it with the save. If the stored version differs, nothing is written (no row, no storage delete) and the form shows "this product changed since you opened it, reload to see the latest" with a reload button. Your typed values stay on screen until you press it, and pressing it replaces the form with the stored product. A successful save sets `version = version + 1`, and the save button is disabled while a save is pending. Outcomes when the update matches no row, checked in this order: no product row → `not_found` (message and a link to the list); `status = archived` → `archived` (the page reloads into the read only view); else → `stale`. A create whose id already exists (a repeated submit) → `stale`.
- **AC-12**: Delete, archive, restore. "حذف المنتج" opens a confirm dialog that says which will happen. A product that no `order_lines` or `draft_lines` row references is deleted, along with its variants and media rows (cascade) and its Storage folder `products/<id>/` (after commit; the weekly sweep removes the folder if that fails), and its code becomes free again. A product that one references gets `status = archived` and leaves the shop. An archived product opens in the editor read only: a "مؤرشف" banner, every field and tile disabled, no save, delete, or "view in shop", and a single "استعادة" button that sets `status = hidden`. `deleteProduct` on an archived product returns `archived`. Both actions check the version as in AC-11.
- **AC-13**: Fixed identity. On edit, the code is shown read only, and a save that sends a different code is rejected as `invalid`. Renaming never changes `slug`, so shared links keep working.
- **AC-14**: Unsaved changes. When the form differs from what was loaded or last saved, closing or reloading the tab triggers the browser's leave warning, and "إلغاء" asks "leave without saving?" before returning to the list. A successful save clears the warning. Uploaded but unsaved media counts as a change. Links in the dashboard sidebar are not guarded.
- **AC-15**: Leftover files. After a successful save, the server deletes objects in `products/<id>/` that no `product_media` row references and that were created more than 1 hour ago. A failure here is logged and does not fail the save. A weekly GitHub Actions job runs `pnpm media:sweep`, which deletes every `products/<id>/` folder whose `<id>` has no `products` row and whose newest object is more than 24 hours old.
- **AC-16**: Authorization and key safety. Every action in this spec calls `requireAdmin()` (role `admin` and `aal2`) first, and returns `forbidden` and does nothing otherwise. Only the server chooses storage keys (`products/<productId>/<uuid>.<webp|jpg|mp4>`), and a signed upload URL is issued only for an allowed type and declared size, with `upsert: false` so a key is never overwritten. Any uuid is accepted as `productId` (a new product has no row yet). On save, every media key must match that pattern for this product id, appear once, and exist in Storage with a real `metadata.mimetype` matching its extension and a real `metadata.size` within its limit (10 MB image, 50 MB video), otherwise the save returns `media_invalid` and writes nothing. The payload is also rejected as `invalid` unless `pairs` are exactly every size combined with every colour (each once, indexes in range), `sizes` and `colours` have at most 12 rows, `specs` at most 30, `media` at most 9, and each photo's `width` and `height` are whole numbers from 1 to 2,000.
- **AC-17**: On a phone sized right to left screen, a Playwright flow passes: the admin creates a product with 2 sizes, 2 colours, and one photo, unticks one pair, and saves. The product appears in the list with `من ₪X` and `2 أحجام · 2 ألوان`. The admin hides it (its shop page returns not found), shows it again, edits a price, and a second tab's stale save is refused. A product that was never ordered is deleted, and one ordered through the slice 1 guest checkout flow is archived and restored. The slice 1 flow (`Philips 60W`) still passes through the new editor. The list, the new editor, the edit editor, and the archived view each pass the axe check.
- **AC-18**: Category. Two selects: "القسم الرئيسي" (top level categories) and "القسم الفرعي" (optional, listing the children of the chosen main, disabled when it has none). A "new main category name" field (2 to 60 characters) stays until feature 9 ships. It wins over the main select (and the sub select is then ignored), and it reuses an existing top level category with the same tidied name; its slug and `sort` follow spec 0004. On edit, the editor preselects the main (the category, or its parent when it is a sub) and the sub. The stored `category_id` is the sub when one is chosen, else the main. A sub that does not belong to the chosen main, or no category at all, gives `category_required`.

## Decision

**Chosen option**: Option 1: One whole form save with server side reconciliation

The editor sends the full wanted state of a product to one admin Server Action, which checks the version, reconciles sizes, colours, pairs, specs, and media against the stored rows in one Drizzle transaction (keeping ordered rows by archiving them), and only then deletes unused files from Storage.

**Implementation skills**: `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`) for signed uploads and Storage admin calls · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the migration and the reconcile queries · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the editor and list components · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for the client editor state · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for AC-17

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

Design source: [admin-products.md](../../design/pages/admin-products.md) and [admin-product-editor.md](../../design/pages/admin-product-editor.md), with the shell from spec 0003. This spec settles the board's open items: video is an upload (O-21), photos reorder with buttons, paging is numbered pages like orders (O-10), and the "متوفر" switch, the pair grid, the archived view, and the delete dialog are additions (their wording follows O-13, the owner reviews it). Strings go in `src/i18n/messages/ar.json`. Routes come from `routes.admin.products`, `productNew`, and `product(id)`.

### Data model sketch

No new tables. One additive migration on spec 0002's catalog tables:

| Change | Rule |
|---|---|
| `products.version` | `integer not null default 1`. The save and delete actions compare it and increment it in the same `UPDATE … WHERE id = $1 AND version = $2`. Zero rows updated means stale. Feature 8's import must increment it too. |
| `product_media_one_video_idx` | partial unique index on `product_media (product_id) where kind = 'video'` |

Both are declared in `src/server/db/schema/catalog.ts` (`version` column, `uniqueIndex(...).where(...)`) so `pnpm db:generate` produces the migration and shows no drift afterwards.

The weekly sweep connects as a new login role `media_sweep` with only `select (id) on public.products`, created in the same migration without a password. Its password is set by hand in each environment (production runbook), so CI never holds the `postgres` login.

How this feature uses the existing tables:

| Table | Use |
|---|---|
| `products` | `name`, `code` (fixed after create), `slug` (set once), `category_id`, `description`, `specs`, `status` (`active` / `hidden` / `archived`), `is_available`, `version` |
| `product_variants` | one row per pair; `size_label`, `size_sort` = size position, `sort` = colour position, `colour_id`, `price` = the size's price (or the single price), `is_available` = grid tick, `is_default` per AC-7, `archived_at` for removed but ordered pairs, `code` stays null |
| `product_media` | `kind`, `storage_key`, `sort`, `width`/`height` (read in the browser after resizing; null for video), `alt` null (the shop uses the product name), `variant_id` null |
| `colours` | shared list; inline create inserts `(name)` with `on conflict (name) do nothing`, then selects by name |
| `categories` | read for the selects; inline create of a top level category as in spec 0004 |

Relationships are unchanged: product 1:N variants (cascade), product 1:N media (cascade), variant N:1 colour (restrict), product N:1 category (restrict), order line N:1 variant (restrict).

### State transitions

Product (spec 0002, now wired to actions):
- `active ⇄ hidden`: the "show in shop" switch on save.
- `active | hidden → archived`: delete, when the product has been ordered.
- `active | hidden → (deleted)`: delete, when it has never been ordered.
- `archived → hidden`: restore.
- An archived product cannot be saved (`archived` error). Only restore applies.

Variant: `live` (no `archived_at`) `→ archived` when removed after an order. `archived → live` when the same size label and colour are added back. A live variant that was never ordered `→ deleted` when removed.

### API surface

All Server Actions and queries live under `src/features/catalog/server/` and import `server-only`. Each action calls `requireAdmin()` first. The client calls the editor actions with a typed object (nested arrays do not fit `FormData`). The server parses that object with the shared Zod schema in `src/features/catalog/schemas.ts`, which replaces the slice 1 `productFormSchema`.

| Name | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `listAdminProducts` | query | `q?`, `categoryId?`, `filter` (`all`, `available`, `unavailable`, `hidden`, `archived`), `page` | `{ rows: { id, name, code, categoryPath, mainImageKey, minPrice, pricesDiffer, sizeCount, colourCount, statusLabel }[], hasNext }` | admin (page) | none; bad params read as defaults |
| `getProductEditor` | query | `id` | full editor state from live rows only (archived variants excluded): fields, `mainCategoryId`, `subCategoryId`, `version`, `sizes[] { originalLabel, label, price }` by `size_sort`, `colours[] { colourId, name }` by `sort`, `pairs[] { size: index \| null, colour: index \| null, available }`, `price` (simple or colours only), media (`storageKey`, `kind`, `width`, `height`) by `sort`, `isArchived` | admin (page) | not found |
| `getEditorLookups` | query | none | top level categories with their children, all colours `{ id, name }` by `sort, name` | admin (page) | none |
| `createMediaUpload` | Server Action | `productId: uuid`, `kind` (`image`, `video`), `contentType` (`image/webp`, `image/jpeg`, `video/mp4`), `size: int` | `{ storageKey, token }` for `uploadToSignedUrl` | `requireAdmin()` | `forbidden`, `invalid_type`, `too_large` (image above 10 MB, video above 50 MB) |
| `saveProduct` | Server Action | `id: uuid`, `version: int \| null` (null = create), `name`, `code`, `categoryId?`, `subCategoryId?`, `newCategoryName?`, `description?`, `specs[]`, `visible: bool`, `available: bool`, `price?` (no sizes), `sizes[] { originalLabel?, label, price }`, `colours[] { colourId?, newName? }`, `pairs[] { size: index \| null, colour: index \| null, available }` (sizes only: `colour` null; colours only: `size` null; simple: empty), `media[] { storageKey, kind, width?, height? }` in display order | `{ id, slug, version }` | `requireAdmin()` | `forbidden`, `invalid` + field errors, `code_taken`, `category_required`, `stale`, `not_found`, `archived`, `media_invalid`, `save_failed` |
| `deleteProduct` | Server Action | `id`, `version` | `{ outcome: "deleted" \| "archived" }` | `requireAdmin()` | `forbidden`, `stale`, `not_found` |
| `restoreProduct` | Server Action | `id`, `version` | `{ version }` | `requireAdmin()` | `forbidden`, `stale`, `not_found`, `not_archived` |
| `pnpm media:sweep` (`scripts/media-sweep.ts`) | script | none | count of folders removed (no ids logged beyond the uuid) | service role key, `DATABASE_URL_DIRECT` | exits non zero on a Storage or DB error |

Pure modules (Vitest, no mocks):
- `src/features/catalog/variant-plan.ts`: `planVariants(wanted, existing, orderedVariantIds)` returns `{ inserts, updates, restores, archives, deletes, defaultKey }`. All of AC-4 to AC-7 lives here.
- `src/features/catalog/media-rules.ts`: limits, allowed types, `mediaKey(productId, uuid, ext)`, `isKeyForProduct(key, productId)`, `orderMedia`.
- `src/features/catalog/admin-list.ts`: filter parsing, status label, the `من` rule, the option count text. Paging reuses the orders helpers, generalised to `src/lib/paging.ts` with the page size as an argument.
- Browser only: `src/features/catalog/components/resize-image.ts` (`createImageBitmap`, canvas, `toBlob('image/webp', 0.85)`, a JPEG fallback when the returned blob type is not WebP).

`saveProduct` order of work:
1. `requireAdmin()`, Zod parse (including the AC-16 shape rules), `isKeyForProduct` on every media key.
2. List `products/<id>/` in Storage once (service role, paginated with `limit: 100`). Every media key must be in it with valid metadata (AC-16), else `media_invalid`.
3. One transaction, in exactly this order:
   1. Create: insert the product with `version = 1`. Update: `UPDATE products … SET version = version + 1 WHERE id = $1 AND version = $2 AND status <> 'archived'`; 0 rows → one read decides `not_found`, `archived`, or `stale` (AC-11).
   2. Resolve the category, create new colours.
   3. Read live and archived variants and which are referenced by `order_lines` or `draft_lines`; run `planVariants`.
   4. Deletes, then archives, then `is_default = false` on every row of the product.
   5. Relabel colliding archived rows to `__archived_<variantId>`.
   6. Rename pass 1 (`__tmp_<variantId>`), rename pass 2 (final labels), so swaps never hit the unique index.
   7. Updates, restores, inserts.
   8. Set `is_default` on the chosen row.
   9. Media: delete the rows not wanted first (so a replaced video never trips the one video index), then upsert the wanted ones by `storage_key` with the new `sort`.
4. Map Postgres errors by constraint name: `23505` on `products_code_unique` → `code_taken`, on `products_pkey` during create → `stale`; `23503` from a delete that lost a race with a new order or draft line → rerun the whole save once (the plan then archives), then `save_failed`. Anything else → `save_failed`, logged.
5. Schedule the AC-15 cleanup with `after()` from `next/server`, using the listing from step 2 (best effort, so the Worker keeps it alive after responding). Then `revalidatePath` for the admin list and editor. The storefront renders on each request (spec 0001), so it needs nothing.

`deleteProduct` follows the same pattern: version and archived check, the reference check on `order_lines` and `draft_lines` (`draft_lines` exists from feature 21; until then only `order_lines`), delete or archive, the same one time rerun on `23503`, and the Storage folder removal in `after()`.

### Value sourcing

| Action | Value | Source |
|---|---|---|
| New editor | product `id` | `crypto.randomUUID()` on the server when `/admin/products/new` renders, carried in the form |
| Save (create) | `slug` | `buildProductSlug(name, code)` (spec 0002) |
| Save | `code` | input, trimmed and uppercased; on update must equal the stored code |
| Save | `category_id` | `subCategoryId` if given and a child of the main; else `categoryId`; else the category found or created from `newCategoryName` |
| Save | `status` | `visible ? 'active' : 'hidden'` |
| Save | `is_available` (product) | input `available` |
| Save | `version` | stored `version + 1` (create: 1) |
| Save | variant `price` | the size's `parseShekels(price)`; with no sizes the single `price` input |
| Save | variant `size_label`, `size_sort` | size row label (tidied) and its index |
| Save | variant `colour_id`, `sort` | the colour row's `colourId`, or the id created or found from `newName`; its index |
| Save | variant `is_available` | the pair's `available` input |
| Save | variant `is_default` | the first available live pair by size index then colour index, else the first live pair |
| Save | archive or delete a removed pair | `exists` on `order_lines.variant_id` or `draft_lines.variant_id` inside the transaction |
| Save | media `sort` | position in the `media[]` input |
| Save | media `width`, `height` | input, measured in the browser from the resized bitmap |
| Save | `specs` | input rows with a non empty value, in order |
| Upload | `storage_key` | `mediaKey(productId, crypto.randomUUID(), ext)` on the server; `ext` from the allowed `contentType` |
| Cleanup | files to remove | Storage listing of `products/<id>/` minus saved keys, `created_at` older than 1 hour |
| Delete | delete or archive | `exists` on `order_lines.product_id`, or on `draft_lines` joined to this product's variants, inside the transaction |
| List | main photo | `product_media` with `kind = 'image'` and the lowest `sort` |
| List | price and `من` | `min(price)` and `min <> max` over variants with `archived_at is null` |
| List | sizes and colours counts | `count(distinct size_label)` and `count(distinct colour_id)` over live variants |
| List | متوفر / غير متوفر | `isSellable` (spec 0004) expressed in SQL: product `active` and `is_available`, and some variant with `is_available` and `archived_at is null` |
| List | row order | `created_at desc, id desc` |
| List | category path | the category and its parent's `name` |
| Sweep | orphan folders | Storage listing of `products/` minus `select id from products`, newest object older than 24 hours |

### Key invariants

- A live product has at least one live variant, and exactly one live variant is `is_default`.
- Within a product, every live pair of a size has the same price.
- A variant or product that any order line references is never deleted, only archived. The database's `restrict` foreign keys back this up.
- `code` and `slug` never change after create.
- `version` grows by exactly 1 on each successful save, delete (archive), or restore. A stale version writes nothing.
- At most 8 `image` rows (checked in the action) and 1 `video` row (database index) per product. Every `storage_key` sits under `products/<its product_id>/`.
- Storage deletes happen only after the transaction commits, so a rolled back save never loses a file it still points at.

### Security model

- The dashboard is admin only: every page calls `requireAdmin()` in the layout, and every action and query here calls it again.
- Signed upload URLs are minted only by `createMediaUpload` with the service role key, for one server chosen key, one allowed type, and a checked size. The browser never chooses a path. The bucket's own limits (50 MB, the four types) stay as the outer wall.
- `saveProduct` accepts only keys under the product's own folder that exist in Storage, so a crafted request cannot attach another product's file or an arbitrary URL.
- The service role key is read only on the server, through `src/server/storage/env.ts` (Zod, fails fast), and is never sent to the browser. The Storage admin client is created per call in `src/server/storage/admin.ts`.
- No customer data is touched. Logs carry the product code and id, never file names typed by the user.

### Configuration required

- `SUPABASE_SERVICE_ROLE_KEY`: already listed in spec 0001. This feature is its first use in the app. Parse it in `src/server/storage/env.ts` and add it to `.dev.vars.example` and the Worker secrets.
- GitHub Actions secrets for the weekly sweep: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `MEDIA_SWEEP_DATABASE_URL` (the `media_sweep` role over the session pooler, production values). The sweep lists folders with pagination and at most 5 Storage calls at a time.
- No new Worker bindings.

### Critical test scenarios

- Happy path: create a product with 2 sizes × 2 colours, one pair unticked, one photo, then edit a size price; the list and the shop reflect it, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**, **AC-8**, **AC-10**, **AC-17**
- Reconcile (unit table for `planVariants`): add a size, remove an unordered pair (delete), remove an ordered or drafted pair (archive), add it back (restore), rename a size, swap two labels, rename into a label an archived row holds, go from simple to sizes and back keeping the plain row's id; default lands on the first available pair, verifies **AC-3**, **AC-4**, **AC-7**
- Race (DB test): a delete of a pair loses to a concurrent order line insert; the save reruns once and archives, verifies **AC-7**
- Shape: a payload with a missing or duplicated pair, a 13th size, a repeated media key, or a photo width of 0 gets `invalid`; a file whose real size or type in Storage breaks the limits gets `media_invalid`, verifies **AC-16**
- History (DB test): place an order on a pair, then rename its size, change its price, remove it, and archive the product; the order line reads the same throughout, verifies **AC-7**, **AC-12**
- Stale: two editors on one product; the second save gets `stale` and nothing changes, including Storage, verifies **AC-11**
- Media failure: an upload fails and save stays disabled; a forged key from another product folder gets `media_invalid`; a 9th photo and a 2nd video are refused, verifies **AC-8**, **AC-16**
- Cleanup: a removed photo's file is gone after save; a file younger than 1 hour survives; the sweep removes a folder with no product and keeps a fresh one, verifies **AC-15**
- Delete: an unordered product is deleted with its folder and its code can be reused; an ordered one is archived, opens read only, and restores to hidden, verifies **AC-12**, **AC-13**
- Validation: a duplicate size label, a duplicate colour, a 13th size, a changed code on edit, and a sub category under the wrong main are each refused with a field error, verifies **AC-4**, **AC-5**, **AC-13**, **AC-18**
- Auth/permission: as a customer and as an admin at `aal1`, `saveProduct`, `createMediaUpload`, `deleteProduct`, and `restoreProduct` return `forbidden` and change nothing, verifies **AC-16**
- Unsaved: an edited form triggers the leave warning, and a saved one does not, verifies **AC-14**
- Specs: suggested rows appear, blank rows drop, order is kept, verifies **AC-9**

## Build plan

Tracer Bullet: first one real edit travels list → editor → save → shop for a simple product, replacing slice 1's form. Then each part of the editor thickens end to end (options, then media, then the rest).

1. **Rules and migration.** The editor Zod schema (replacing `productFormSchema`), `planVariants`, `media-rules`, `admin-list` helpers, and `src/lib/paging.ts` (orders switched to it), each with Vitest tables; the migration adding `products.version` and `product_media_one_video_idx`, with a DB test for both. Satisfies **AC-3**, **AC-4**, **AC-5**, **AC-7**, **AC-9**, **AC-13**
2. **Thin thread: list and simple editor.** `listAdminProducts` (no filters yet), `getProductEditor`, `getEditorLookups`, `saveProduct` for basic info, category selects, description, both switches, the single price, and the version check; `/admin/products`, `/admin/products/new` (server chosen id), `/admin/products/[id]`; retire the slice 1 `createProduct` and update the `Philips 60W` e2e to the new editor. Precondition: Hyperdrive caching is off in every environment (spec 0002 follow-up), or AC-10 cannot pass. Satisfies **AC-2**, **AC-3**, **AC-10**, **AC-11**, **AC-13**, **AC-16**, **AC-18**
3. **Sizes, colours, and the pair grid.** Size rows with prices and order buttons, the colour picker with inline create, the grid or row ticks, and `saveProduct` applying `planVariants` (two pass renames, default reset, archive, restore); the history DB test. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**
4. **Photos and video.** `src/server/storage/env.ts` and `admin.ts`, `createMediaUpload`, browser resize, tiles with progress, retry, move, make main, and remove, video upload, media reconcile and key checks in `saveProduct`, cleanup after commit. Satisfies **AC-8**, **AC-15**, **AC-16**
5. **Finish: specs, delete, list filters, sweep, full flow.** Spec rows with suggestions; delete with the confirm dialog, archive, read only view, restore; search, category, chips, and paging in the list; the unsaved changes guard; `scripts/media-sweep.ts`, `pnpm media:sweep`, and the weekly workflow; the AC-17 Playwright flow and axe on every page. Satisfies **AC-1**, **AC-9**, **AC-12**, **AC-14**, **AC-15**, **AC-17**

## Consequences

**Positive**:
- One save, one transaction: the shop never shows half an edit, and a stale tab cannot undo a newer price.
- Orders stay exact through renames, price changes, removals, and archiving.
- Browser side resizing makes phone uploads fast and keeps storage and image transformation costs low.
- `planVariants` is pure, so the trickiest rules are unit tested without a database.

**Negative / tradeoffs**:
- The save action is the biggest piece of server code so far (variants, colours, media, and Storage in one place); it must stay split into small helpers to stay readable.
- A size price lives on every pair row of that size. The editor and `planVariants` keep them equal, but the database does not enforce it, so a direct SQL edit could break it.
- Removed pairs that were ordered pile up as archived rows; they are invisible but never cleaned.
- Photos cannot be linked to a colour yet, so the product page shows all photos for every colour.
- Cleanup is best effort: a file can linger up to a week if the after commit delete fails.
- Safari and some Android browsers may produce JPEG instead of WebP, so file types in the bucket are mixed.
- Admin name search is a plain `ilike`. It does not forgive hamza or tashkeel differences, which the shop search (feature 11) will.

**Neutral**:
- Slice 1's `createProduct` action and four field form are removed. Their e2e moves to the new editor.
- Feature 8's import must write the same shapes (one row per pair, the same default rule) and bump `version`; it should reuse `planVariants`.
- Feature 9 removes the inline "new main category" field once category management ships.
- Feature 10 adds the size and colour pickers that make per pair availability visible to customers.

## Follow-up

- [ ] Quoted messages in this spec are meaning, not copy: `/develop` writes the Arabic strings into `ar.json` for every error (`code_taken`, `category_required`, `stale`, `not_found`, `archived`, `media_invalid`, `forbidden`, `save_failed`) and state.
- [ ] Owner to review the wording this spec adds (delete dialog, stale message, unsaved warning, archived view), per design open item O-13.
- [ ] Spec 0001's Hyperdrive caching follow-up (`caching.disabled: true`) must be done in every environment, or AC-10's "next request shows the change" fails for up to a minute.
- [ ] Feature 8: reuse `planVariants` and `media-rules` for the import and the bulk photos, and bump `products.version` on every import write.
- [ ] Feature 10: decide whether to add colour tagged photos (a nullable `colour_id` on `product_media`), which this spec left out.
- [ ] Add the weekly media sweep workflow and its three secrets to the production runbook.
