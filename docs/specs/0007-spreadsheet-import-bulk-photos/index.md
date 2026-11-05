# 0007. Spreadsheet import and bulk photos

**Date**: 2026-10-21
**Status**: In Progress

## Summary

This spec adds `/admin/products/import`. You fill a spreadsheet template (one row per size), drop it on the page, and drop a folder of photos named by product code (`CH-100.jpg`, `CH-100_2.jpg`). The browser reads both and shows a review: what will be created, what will be updated, and every bad row with its fix. Pressing confirm saves each good product in its own transaction, through the same save code as the product editor, so one bad product never blocks the rest. Then the photos upload and replace each matched product's photos.

## Requirements

**User stories**:
- As the owner, I want to load hundreds of products from one spreadsheet, so that I do not type each one into the editor.
- As the owner, I want to change prices for many products by uploading the sheet again, so that a price list update takes minutes.
- As the owner, I want to drop a folder of photos named by code, so that each product gets its photos without opening it.
- As the owner, I want every bad row listed with what to fix, so that I can correct the sheet and upload it again without breaking what already worked.

**Acceptance criteria**:
- **AC-1**: Page and entry. `/admin/products/import` (`routes.admin.productImport`) shows the board's three cards: "1. جدول المنتجات", "2. صور المنتجات", "3. مراجعة النتيجة". The products list header gets an outline button "استيراد من جدول" that links here. Card 3 is hidden until a sheet or a photo has been read. Either card can be used alone: a sheet with no photos, or photos with no sheet.
- **AC-2**: Template. "تحميل قالب الجدول" builds `skf-products-template.xlsx` in the browser with three sheets. **المنتجات**: only the header row, with exactly these headers in this order: الكود, الاسم, القسم الرئيسي, القسم الفرعي, الحجم, السعر, الألوان, الوصف, القطر (سم), الارتفاع (سم), نوع القاعدة, القدرة, لون الإضاءة, ظاهر, متوفر. **مثال**: the same headers with two example products (one with 2 sizes and 2 colours, one simple). **القوائم**: the current categories and colours, read through `getImportLookups`, in three columns headed القسم الرئيسي, القسم الفرعي, الألوان (one row per main with an empty sub, then one row per sub with its main), so each cell can be copied as is into the matching column. The الكود column of المنتجات is formatted as text, so a code like `00123` keeps its zeros. Only the first sheet of an uploaded file is ever read, so the example rows are never imported.
- **AC-3**: Reading the file. The sheet input accepts `.xlsx` and `.csv` up to 5 MB. Any other extension is `file_type`, and a corrupt or password protected file is `file_unreadable`. Row 1 is the header row. Headers are matched after `tidyText`. الكود, الحجم, السعر, and الألوان must be present (their cells may be empty, else `missing_column` naming the header), the other headers are optional, unknown columns are ignored, and a repeated header is `duplicate_column` naming it. A CSV is read as UTF‑8 (a leading BOM is dropped), its delimiter is detected among `,`, `;`, and tab (Excel in Arabic locales exports `;`), and text containing the replacement character `U+FFFD` is refused as `csv_encoding` ("save as CSV UTF‑8 or use xlsx"). Rows whose every cell is empty are ignored. More than 500 products or 5,000 data rows is `too_many_rows`. Each of these file errors shows in the notice banner, and nothing else from the file is listed. Every cell is read as text: a number cell is first rounded to 2 decimals (so formula noise like `0.30000000000000004` reads `0.3`), then `String(value)`, and a boolean or date cell reads as its text. The row number shown everywhere is the spreadsheet row (header = 1).
- **AC-4**: Grouping by code. A code is `toWesternDigits`, `tidyText`, then uppercased, and must match `PRODUCT_CODE` (spec 0006). Rows with the same code form one product wherever they sit in the sheet. The product's first row (by row number) holds the product cells (الاسم, القسم الرئيسي, القسم الفرعي, الألوان, الوصف, the five spec columns, ظاهر, متوفر). On a later row of the same code these cells must be empty or equal to the first row's (after `tidyText`), else `conflicting_value` on that row. A row with any non empty cell and no code is `code_missing`.
- **AC-5**: Sizes, prices, colours. Each row's السعر is required and parsed by the shared `priceField` (spec 0006, which turns Arabic digits and separators to Western ones before `parseShekels`; above 0, at most ₪1,000,000), else `price_invalid`. Either every row of a product has a الحجم (one size per row, label 1 to 40 characters tidied, at most 12, no two equal after `optionKey`), or the product has exactly one row and no size, else `size_mixed` (this includes a second row with no size), `size_invalid`, `size_duplicate`, or `too_many_sizes`. الألوان is split on `,` and `،`, each name tidied (1 to 40 characters), at most 12, none repeated after `optionKey`, else `colour_invalid`, `colour_duplicate`, or `too_many_colours`. Every size is offered in every colour, as in the editor.
- **AC-6**: Other cells. الوصف at most 4,000 characters, each spec value at most 120 (tidied, spec 0005), and ظاهر and متوفر are empty, نعم, or لا. Anything else is a row problem (`description_too_long`, `spec_too_long`, `yes_no_invalid`).
- **AC-7**: New products. A code with no product row creates one. الاسم (2 to 120 characters) and القسم الرئيسي are required (`name_missing`, `category_missing`). ظاهر empty means hidden, متوفر empty means available. Specs are the filled spec cells in column order, labelled by their header. Every pair starts ticked. Id, slug, and version follow spec 0006 (`crypto.randomUUID()` on the server, `buildProductSlug`, version 1).
- **AC-8**: Existing products. A code that matches a live product (status `active` or `hidden`) updates it. An empty cell keeps the stored value for الاسم, the category, الوصف, each spec label, ظاهر, and متوفر. A filled spec cell replaces the value of the first stored spec row whose label equals the header after `tidyText`, or is appended after the stored rows. An append past 30 rows is `too_many_specs`, and an empty cell never deletes a spec. Sizes, prices, and colours always follow the sheet exactly, in sheet order (sizes in row order become `size_sort`, colours in cell order become `sort`): a size whose label matches a stored size (`optionKey`) keeps its rows and ids, a stored live pair that survives (same size `originalLabel` and `colourId`) keeps its availability tick, any other pair starts ticked (including an archived pair that `planVariants` restores), and removed pairs are deleted or archived by spec 0006 AC-7. Photos, video, code, and slug are never changed by the sheet. Products whose code is not in the sheet are never touched. Each written product's `version` grows by 1.
- **AC-9**: Categories. القسم الرئيسي matches a top level category by tidied name, and القسم الفرعي matches a child of that main by tidied name (the input is `tidyText`ed and compared with `btrim(name)`, since stored names were tidied on insert). A name with no match is created (slug unique across all categories by the editor's `nextFreeSlug` rule, `sort` 0, visible, as spec 0006 AC-18) and listed in the review under "أقسام جديدة". On an update with القسم الرئيسي empty and القسم الفرعي filled, the sub is looked up or created under the product's stored main. The stored `category_id` is the sub when given, else the main.
- **AC-10**: Colours. Each colour name matches the shared list by `optionKey`. An unknown name is created as in the editor (`hex` null, `sort` 0) and listed in the review under "ألوان جديدة".
- **AC-11**: A product is all or nothing. If any row of a product has a problem, none of it is written, and every one of its rows is listed (rows with no problem of their own show "skipped with row N"). A code that belongs to an archived product is listed as `archived` ("restore it in the editor first") and is never restored by the import.
- **AC-12**: Photo names. Photos come from a multiple file input (`accept` the four image types) or a drop, where a dropped folder is flattened to its files (any depth). A photo file name, case ignored, is `<code>.<ext>` (position 1, the main photo) or `<code>_<n>.<ext>` with `n` from 1 to 99, where `ext` is `jpg`, `jpeg`, `png`, or `webp`. Every photo is stored as WebP or JPEG after resizing, whatever its name says. "By file name" below means the names compared after uppercasing, character by character. The code part is normalised as AC-4. A photo matches a live product found by code, or a product the sheet will create in this run. Problems, each listed with the file name: name not in that shape, including `.heic` and other extensions (`photo_name_invalid`, with "save as JPEG"), no matching product (`photo_no_product`), an archived product (`photo_archived`), the product skipped by AC-11 (`photo_product_skipped`), two files with the same code and position (the first by file name is used, the other `photo_duplicate_number`), more than 8 for one code (the first 8 by position are used, the rest `photo_over_limit`), a file above 30 MB (`photo_too_large`), and files past the first 1,000 by name (`photo_run_limit`, "import them in a second run").
- **AC-13**: Photos replace. For each matched product, the imported photos become its whole photo set in position order (`sort` 0 is the main photo), and its video stays, stored after the photos. Each photo is resized and encoded exactly as spec 0006 AC-8 (`resizeImage`, one photo at a time so an older phone never holds several decoded bitmaps), uploaded through `createMediaUpload` and `uploadFile` with up to 4 uploads at a time, then attached in one `setProductPhotos` call per product, which bumps `version` by 1. `setProductPhotos` carries no version: the import's photos win over an editor tab open on the same product, which then gets `stale` on its next save. A photo the browser cannot decode is `photo_unreadable`, and a failed upload is retried once, then `photo_upload_failed`. Those are left out of the set. If none of a product's photos upload, no call is made and its stored photos and version stay unchanged. Replaced files are removed by the spec 0006 AC-15 cleanup.
- **AC-14**: Review. Card 3 shows the board's three chips: صفوف سليمة (rows of products that will be written), تحتاج إصلاحاً (rows of products with a problem), صور بلا منتج (photos with `photo_no_product`, `photo_archived`, or `photo_product_skipped`; other photo problems appear only in the table). Under them: "جديد: N · تحديث: N", the new categories and new colours (AC-9, AC-10, using each matched product's stored main for a sub given alone), a list of the products to write, each marked جديد or تحديث with its photo count, and the problems table (الصف, المشكلة, الإجراء) with one table row per sheet row problem ordered by row, then one per photo problem by file name (the file name in the الصف column), each with its fix text. "تأكيد الاستيراد" is enabled when at least one product or photo will be written, so the problem rows are skipped rather than blocking the rest (this replaces the board's "confirm disabled while rows need repair"). Choosing a new sheet or new photos reruns the review. "إلغاء" clears both cards.
- **AC-15**: The run. On confirm, products are sent to `importProducts` 25 at a time, one batch after another, and each product is saved in its own transaction. Then photos run as AC-13, only for products whose run outcome was `created` or `updated`, and for live products not in the sheet. A sheet product that ended `skipped` turns its photos into `photo_product_skipped`. A `role="status"` line shows progress ("جارٍ الاستيراد: 40 من 120", then the photo count). While it runs, closing or reloading the tab triggers the browser's leave warning, and both cards are disabled. At the end a result line reads "تم: N جديد · N محدّث · N صورة · لم يُستورد: N" (صورة counts attached files, لم يُستورد counts sheet products not written), counted from run outcomes, not from the review. Problems found during the run (`code_taken`, `changed_during_import`, `save_failed`, photo failures) join the table, one table row for each of that product's sheet rows. "تنزيل المشاكل" saves the problems as `.xlsx` with columns الصف, الكود, الملف, المشكلة, الإجراء. Running the same sheet and photos again is safe: it updates the same products and replaces the same photos, so nothing is doubled. If the tab is closed mid run anyway, the products already saved stay, and the same files can simply run again.
- **AC-16**: Authorization and limits. `getImportLookups`, `readImportContext`, `importProducts`, and `setProductPhotos` each call `requireAdmin()` first and return `forbidden`, doing nothing otherwise. The server never trusts the browser's checks: `importProducts` validates every product again with the shared Zod schema and builds the editor payload itself, then parses it with `productEditorSchema`. Payload caps: at most 25 products per `importProducts` call and 1,500 distinct codes per `readImportContext` call (the page removes repeats before sending), else `invalid`. `setProductPhotos` accepts only image keys under that product's folder, at most 8, each once, each present in Storage with metadata that fits (spec 0006 AC-16), else `media_invalid`, and it never touches an archived product (`archived`).
- **AC-17**: On a phone sized right to left screen, a Playwright flow passes: the admin downloads the template, uploads a fixture `.xlsx` with 3 products (one new with 2 sizes and 2 colours, one simple, one update of an existing product's price) plus 1 product with a bad price, and 3 photos (two for the new product, one named for no product). The review shows 3 products to write, the bad price row, and the unmatched photo. After confirm, the new product appears hidden in the products list with `من ₪X` and 2 photos, the updated product shows its new price, and the bad product does not exist. Uploading the same files again changes nothing but versions. The import page passes the axe check in each state (empty, review, done).

## Decision

**Chosen option**: Option 1: Read in the browser, save each product through the editor's save code

The browser reads the sheet and photo names into plain rows and shows the review. The server rebuilds each product's full editor payload (merging the sheet with the stored product) and saves it with spec 0006's `saveProductInDb`, one transaction per product. Photos upload through the existing signed upload action and are attached by one small new action.

**Implementation skills**: `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`) for signed uploads and the Storage listing · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the code lookups and the photo replace transaction · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the drop zones, chips, and problems table · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for the run state and loading the sheet libraries on demand · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for AC-17

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

Design source: [admin-import.md](../../design/pages/admin-import.md), with the shell from spec 0003. This spec closes open item O-22 (columns, and update rather than skip for an existing code). Additions to the board: the "استيراد من جدول" button, the new and update counts, new categories and colours, the product list, the progress line, the result line, and "تنزيل المشاكل" (wording follows O-13, the owner reviews it). Strings go in `src/i18n/messages/ar.json`, including one problem text and one fix text per problem code.

### Data model sketch

No new tables, no migration. The import writes only through spec 0006's paths:

| Table | Use |
|---|---|
| `products` | looked up by `code`; created or updated by `saveProductInDb`; `version` bumped on every write (the spec 0006 follow-up) |
| `product_variants` | written only by `planVariants` through `saveProductInDb` |
| `product_media` | image rows replaced by `setProductPhotos`; the video row kept |
| `categories` | find or create by tidied name: a top level one (`findOrCreateTopCategory`, moved out of `save-product.ts` into an exported `server/categories.ts` that the editor's save then imports), or a child of a given main (new `findOrCreateSubCategory` in the same file, same slug rule) |
| `colours` | find or create by name, as the editor (`resolveColours`) |

The import run itself is not stored. Its review and result live in the page until you leave it, and "تنزيل المشاكل" is how you keep them.

### State transitions

The import page (client state only): `empty → reading → reviewed → running → done`. A file error returns to `empty` with the banner. From `reviewed` or `done`, a new file returns to `reading`, and "إلغاء" returns to `empty`. `running` cannot be left by the page's own controls.

Products follow spec 0006: an import creates `hidden` or `active` products, flips `active ⇄ hidden` by ظاهر, and never creates, enters, or leaves `archived`.

### Sheet columns

| Header | Required header | Cell | Read from |
|---|---|---|---|
| الكود | yes | every row | every row |
| الاسم | no | new product | first row |
| القسم الرئيسي | no | new product | first row |
| القسم الفرعي | no | optional | first row |
| الحجم | yes | every row, or the only row empty | every row |
| السعر | yes | every row | every row |
| الألوان | yes | optional, `,` or `،` separated | first row |
| الوصف | no | optional | first row |
| القطر (سم), الارتفاع (سم), نوع القاعدة, القدرة, لون الإضاءة | no | optional | first row |
| ظاهر, متوفر | no | empty, نعم, لا | first row |

An optional header left out of the file reads as an empty cell in every row, so a price update sheet needs only الكود, الحجم, السعر, and الألوان.

### API surface

Server code lives in `src/features/catalog/server/` and imports `server-only`. The client sends typed objects, not `FormData`. Shared Zod schemas live in `src/features/catalog/import-schemas.ts`.

| Name | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getImportLookups` | Server Action | none | `requireAdmin()`, then `readEditorLookups(db)` (categories with children, colours), for the template's القوائم sheet and the review. Not `getEditorLookups`, which is a page guard | `requireAdmin()` | `forbidden` |
| `readImportContext` | Server Action | `codes: string[]` (≤ 1,500 distinct, normalised) | `{ products: { code, id, status, mainCategoryId }[] }` from the new query `readProductsByCodes(db, codes)`, for the codes that exist, plus the lookups | `requireAdmin()` | `forbidden`, `invalid` |
| `importProducts` | Server Action | `products: ImportProduct[]` (≤ 25), each `{ code, rows: number[], name?, mainCategory?, subCategory?, description?, specs: { label, value }[], visible?: bool, available?: bool, sizes: { label, price }[], colours: string[], price? }` | `{ results: { code, outcome: "created" \| "updated" \| "skipped", id?, problem? }[] }` | `requireAdmin()` | `forbidden`, `invalid`; per product `archived`, `code_taken`, `changed_during_import`, `save_failed`, or a validation problem code |
| `setProductPhotos` | Server Action | `productId: uuid`, `images: { storageKey, width, height }[]` (1 to 8, in position order) | `{ version }` | `requireAdmin()` | `forbidden`, `invalid`, `media_invalid`, `not_found`, `archived` |
| `createMediaUpload` | Server Action (spec 0006, reused) | `productId`, `kind: "image"`, `contentType`, `size` | `{ storageKey, token, signedUrl }`, passed to `uploadFile` | `requireAdmin()` | as spec 0006 |

`importProducts`, per product, in order:
1. `importProductSchema` parse (the AC-4 to AC-6 rules again). A failure is that product's problem, the batch goes on.
2. `readProductsByCodes` for this code. Archived → `archived`. Live → `readProductEditor(db, id)`, whose `version` is the one checked in step 5 (no separate version read).
3. `ensureImportCategories` for this product's names (one short transaction, find or create).
4. `toEditorData(sheetProduct, stored, categoryIds, crypto.randomUUID)` builds the full editor payload (AC-7, AC-8): sizes and colours in sheet order, `pairs` as every size index times every colour index against those new arrays, each tick looked up in the stored `pairs` by (stored size `originalLabel`, stored `colourId`), and the stored `media` forwarded unchanged (saveProductInDb always reconciles media). Then `productEditorSchema.parse`.
5. `saveProductInDb` (one transaction, `planVariants`, version check). `stale` → repeat steps 2 to 5 once, then `changed_during_import`. On create, `products_code_unique` (a concurrent create of the same code) → `code_taken`. A throw → `save_failed`, logged with the code.
6. After the batch, `revalidatePath` for the products list once. The storefront renders on each request (spec 0001), so it needs nothing, after this action or after `setProductPhotos`.

`setProductPhotos`: `requireAdmin()`, Zod, `isKeyForProduct` on every key, one listing of `products/<id>/` (as `saveProduct`) with `storedObjectFits` per key, then one transaction: `select … for update` on the product (not found or archived → refuse), delete its `image` rows, insert the new ones with `sort` 0 to n − 1, set the video row's `sort` to n, `version = version + 1`. After commit, schedule the spec 0006 AC-15 leftover cleanup with `after()`, using that listing.

Pure modules (Vitest, no mocks), all in `src/features/catalog/`:
- `import-sheet.ts`: `mapHeaders(headerRow)` (AC-3), `groupRows(rows)` and `checkProduct(group)` returning `ImportProduct` or row problems (AC-4 to AC-6, AC-11).
- `import-plan.ts`: `toEditorData(sheet, stored, categoryIds, newId)` (AC-7, AC-8), and `reviewImport(products, context, photos)` giving chips, counts, new categories and colours, the product list, and the problems table (AC-9, AC-10, AC-14).
- `photo-names.ts`: `parsePhotoName(name)` and `matchPhotos(names, knownCodes, maxPerProduct, maxPerRun)` (AC-12).
- `import-template.ts`: the three sheets of the template as plain data (AC-2), and the problems sheet for "تنزيل المشاكل".

Browser only, in `src/features/catalog/components/import/`: `read-sheet.ts` loads `read-excel-file` or `papaparse` with a dynamic `import()` only when a file is chosen, and `write-sheet.ts` loads `write-excel-file` the same way. These three libraries are never imported by server code, so they stay out of the Worker bundle. The run reuses `resizeImage` and `uploadFile` from the editor.

### Value sourcing

| Action | Value | Source |
|---|---|---|
| Read | row number | spreadsheet row index (header = 1) |
| Read | product code | الكود cell, `toWesternDigits` + `tidyText` + uppercase |
| Review | create or update | `readImportContext`: a live product with that code means update |
| Review | new categories, new colours | sheet names minus `getImportLookups` names, compared by tidied name and `optionKey` |
| Import | product `id` | stored id on update; `crypto.randomUUID()` on the server on create |
| Import | stored product | `readProductsByCodes` (id, status) then `readProductEditor(db, id)` |
| Import | `version` for the check | `readProductEditor(...).version` from step 2 of `importProducts` |
| Import | `name`, `description` | sheet cell if filled, else stored (update) |
| Import | `category_id` | AC-9 from القسم الرئيسي and القسم الفرعي, else the stored main and sub |
| Import | `specs` | stored rows with filled cells replacing or appending by label (update); filled cells in column order (create) |
| Import | `status` | ظاهر: نعم → `active`, لا → `hidden`, empty → stored (update) or `hidden` (create) |
| Import | product `is_available` | متوفر: نعم / لا, empty → stored (update) or `true` (create) |
| Import | sizes, `originalLabel` | الحجم rows in row order; `originalLabel` is the stored label with the same `optionKey`, else none |
| Import | variant `price` | that row's `parseShekels(السعر)`; the single row's price for a product with no sizes |
| Import | colours | الألوان names; `colourId` of the listed colour with the same `optionKey`, else `newName` |
| Import | pair `available` | the stored pair's tick when that size (`originalLabel`) and colour existed live, else `true` |
| Import | media | stored media, unchanged |
| Photos | product for a file | `parsePhotoName` code → the id returned by `importProducts` (`created` or `updated`) for a sheet product, or the `readImportContext` id for a live product not in the sheet |
| Review | main for a sub given alone | `readImportContext` `mainCategoryId` of the matched product |
| Photos | photo `sort` | position from the file name, ranked, from 0 |
| Photos | video `sort` | the number of photos set |
| Photos | `width`, `height` | `resizeImage` result |
| Photos | `storage_key` | `createMediaUpload` (spec 0006) |
| Result | counts | `importProducts` outcomes and photo outcomes, summed in the page |

### Key invariants

- Every product write goes through `saveProductInDb`, so every spec 0006 invariant holds after an import (one default variant, equal prices per size, ordered rows archived not deleted, version + 1).
- A product is written whole or not at all. A problem in one product never stops another.
- The import never changes a product whose code is not in the sheet (photos aside), never changes a code or slug, and never touches an archived product.
- After a photo replace, a product has at most 8 image rows and its video row sorts after them.
- Running the same files twice leaves the same products and photos (only versions and Storage keys change).

### Security model

- Admin only: the page sits under the dashboard layout's `requireAdmin()`, and each of the four actions calls it again (role `admin`, `aal2`).
- The server repeats every check the browser made, and builds the editor payload itself. A crafted request can only do what the editor's save can do.
- Storage keys are still chosen only by `createMediaUpload`, and `setProductPhotos` accepts only keys proven to exist under that product's folder.
- No customer data is touched. Logs carry codes, ids, and counts, never file names or cell text.

### Configuration required

No new env vars, secrets, or bindings. Three new browser dependencies, pinned to exact versions at build time: `read-excel-file`, `write-excel-file`, `papaparse` (with `@types/papaparse` as a dev dependency).

### Critical test scenarios

- Happy path: a fixture sheet creates a 2 × 2 product and a simple one, updates another's price, and three photos attach; the list and shop reflect it, verifies **AC-1**, **AC-7**, **AC-8**, **AC-13**, **AC-15**, **AC-17**
- Headers (unit): required headers missing, a repeated header, unknown columns ignored, optional headers absent, verifies **AC-3**
- Grouping (unit): rows of one code apart in the sheet, a conflicting name on a later row, a row with no code, codes in Arabic digits and lowercase, verifies **AC-4**
- Row rules (unit table): bad price, mixed size rows, repeated size, 13 sizes, both comma kinds in الألوان, 13 colours, bad نعم/لا, long description, verifies **AC-5**, **AC-6**
- Merge (unit table for `toEditorData`): empty cells keep, a spec replaces by label or appends, a size matched by label keeps its `originalLabel`, a surviving pair keeps its tick, a removed size, create defaults, verifies **AC-7**, **AC-8**
- History (DB test): import a price change and a removed size on a product with an ordered pair; the pair is archived, ids are kept, the order line reads the same, version + 1, verifies **AC-8**
- All or nothing: a product with one bad row writes nothing and lists all its rows; an archived code is listed and unchanged, verifies **AC-11**
- Categories and colours: unknown main, unknown sub under a known main, a sub alone on an update, an unknown colour; each created once and shown as new, verifies **AC-9**, **AC-10**
- Photo names (unit table): `CH-100.jpg`, `ch-100_3.WEBP`, `CH-100_0.jpg`, `IMG_2231.jpg`, a duplicate position, 9 photos, 1,001 files, verifies **AC-12**
- Photo replace (DB test): a product with 3 photos and a video gets 2 new photos; images are replaced, the video sorts last, version + 1; a product whose uploads all fail keeps its photos, verifies **AC-13**
- Race: a product edited in the editor between steps 2 and 5 gets one retry, then `changed_during_import`; a concurrent create of the same code gives `code_taken`, verifies **AC-15**
- Rerun: the same sheet and photos run twice give the same products and photo count, verifies **AC-15**
- Auth/permission: as a customer and as an admin at `aal1`, all four actions return `forbidden` and change nothing; 26 products in one call, a key from another product's folder, and a 9th photo are refused, verifies **AC-16**

## Build plan

Tracer Bullet: first one simple product travels sheet → review → `importProducts` → products list, end to end, then each part thickens (options and the update merge, then photos, then the finish).

1. **Thin thread: one simple product.** The page at `/admin/products/import` with the sheet card, `read-sheet.ts` for `.xlsx` only, `mapHeaders` and `groupRows` for the required headers, the simple product rules, `readImportContext`, `importProducts` creating new simple products through `toEditorData` and `saveProductInDb`, the bare result line, and the "استيراد من جدول" link on the products list. Vitest for the pure parts. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-7**, **AC-16**
2. **Options, updates, categories, colours.** Sizes, prices, and colours rules, the update merge (empty keeps, options follow the sheet, ticks kept), specs, ظاهر and متوفر, `server/categories.ts` (moved `findOrCreateTopCategory`, new `findOrCreateSubCategory`) and `ensureImportCategories`, colours, archived skip, all or nothing per product, the retry on `stale`; CSV through `papaparse`; the history DB test. Satisfies **AC-5**, **AC-6**, **AC-8**, **AC-9**, **AC-10**, **AC-11**
3. **Review.** `reviewImport`, the three chips, counts, new categories and colours, the product list, the problems table with fix texts, the confirm rule, cancel, and the 25 per batch run with progress and the leave warning. Satisfies **AC-14**, **AC-15**
4. **Photos.** The photos card, `photo-names.ts`, matching against the sheet and `readImportContext`, the resize and upload queue (4 at a time, one retry), `setProductPhotos` with its key checks and the video sort, the cleanup after commit, photo problems in the review and result. Satisfies **AC-12**, **AC-13**, **AC-16**
5. **Finish.** The template download with its three sheets, "تنزيل المشاكل", the full Playwright flow on a phone screen with committed fixtures under `e2e/fixtures/import/`, and axe on each page state. Satisfies **AC-2**, **AC-15**, **AC-17**

## Consequences

**Positive**:
- One save path: the import cannot write a product the editor could not, and every rule from spec 0006 (archiving, the default pair, the version check) comes for free.
- A bad product never blocks the rest, and a rerun is safe, so the owner can fix and upload the same sheet again without fear.
- No new tables, services, or secrets; the Worker never parses a file, so its CPU limit is not a concern.
- The same sheet doubles as a bulk price update tool.

**Negative / tradeoffs**:
- One transaction per product makes a 500 product import take roughly a minute or two of sequential batches; the page must stay open while it runs.
- An update with sizes in the sheet replaces the size list exactly, so a sheet that leaves out a size removes it (archived if ordered). The review's تحديث marking is the only warning.
- Renaming a size by import is a remove plus an add, not a rename, so an ordered pair under the old name is archived.
- A category created in step 3 stays even if that product's save then fails (rare, it was already validated). It shows up empty in feature 9's category list.
- A code typed as a number in a sheet that was not made from the template loses its leading zeros (`00123` reads `123`). The template's text formatted الكود column avoids it.
- The retry on `stale` reapplies the sheet over a save made a moment earlier in the editor, so the sheet's filled cells and prices win.
- The 5 MB cap is checked on the file, not on its unpacked size; a crafted `.xlsx` could still slow the admin's own browser. Accepted for an admin only page.
- The import result is not stored. Once the page closes, only the downloaded problems file remains.
- Per pair availability and extra spec rows cannot be set by import; they stay editor only.
- Three new browser libraries to keep current; they load only on this page.

**Neutral**:
- The board's "confirm disabled while rows need repair" is replaced by "import the good products, list the rest" (scope "Done when").
- `findOrCreateSubCategory` is new shared code that feature 9 can reuse or replace.
- Photo replace by import and the editor's own media reconcile write the same rows; whichever saves later wins, and the other gets `stale`.

## Follow-up

- [ ] Quoted messages in this spec are meaning, not copy: `/develop` writes the Arabic strings into `ar.json` for every problem code (problem text and fix text), the counts, progress, and result lines.
- [ ] Owner to review the wording this spec adds (per design open item O-13), and the template's example products.
- [ ] Mark O-22 closed in [handoff.md](../../design/handoff.md) and the open item in [admin-import.md](../../design/pages/admin-import.md), pointing to this spec.
- [ ] Record in `AGENTS.md` (`/sync`) that Agent Skills for `read-excel-file`, `write-excel-file`, and `papaparse` were declined, so they are not offered again.
- [ ] Dashboard home quick action "استيراد" (admin-home board) links to `routes.admin.productImport` when that page is built.
