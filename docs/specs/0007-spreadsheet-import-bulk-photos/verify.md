# Verify: spreadsheet import & bulk photos · spec 0007 · updated 2026-10-21
_Steps derived from spec 0007 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] On `/admin/products`, press "استيراد من جدول" → lands on `/admin/products/import` with cards 1 and 2, card 3 hidden → AC-1
- [ ] Press "تحميل قالب الجدول" → `skf-products-template.xlsx` with sheets المنتجات (headers only, الكود column formatted as text), مثال (two example products), القوائم (current categories and colours) → AC-2
- [ ] Upload a `.xls` or `.txt` → banner "نوع الملف غير مدعوم", nothing listed; a sheet without الألوان → banner naming the column; a repeated السعر header → duplicate banner → AC-3
- [ ] Upload a CSV saved in Windows Arabic encoding → `csv_encoding` banner; the same as CSV UTF-8 with `;` → reads like the xlsx → AC-3
- [ ] A sheet with rows of one code apart, codes in Arabic digits and lower case → one product; a different name on a later row → `conflicting_value` on that row; a filled row with no code → "صف بلا كود" → AC-4
- [ ] Bad price, a mixed size row, a repeated size, 13 sizes, 13 colours, both comma kinds → each listed with its fix; the rest of the sheet still imports → AC-5, AC-6, AC-11
- [ ] A new code with no الاسم or no القسم الرئيسي → listed, nothing written; a new product lands hidden and available, version 1 → AC-7
- [ ] Re-upload an existing code with only الكود, الحجم, السعر → prices change, name, description, specs, ظاهر and متوفر keep their stored values; an unticked pair that survives stays unticked; a removed ordered size is archived, not deleted → AC-8
- [ ] An unknown main, an unknown sub, a sub alone on an update, an unknown colour → listed under أقسام جديدة / ألوان جديدة, created once → AC-9, AC-10
- [ ] An archived product's code → listed "مؤرشف", product unchanged → AC-11
- [ ] Photos `CODE.jpg`, `code_3.WEBP`, `IMG_2231.jpg`, `.heic`, a repeated position, 9 photos for one code → matched or listed with the right problem → AC-12
- [ ] After confirm, a product with 3 photos and a video shows only the imported photos in order, video last; a photo that fails to upload is listed and left out → AC-13
- [ ] Review chips, "جديد: N · تحديث: N", the product list, and the problems table (rows first, then files) match the sheet; "إلغاء" clears both cards → AC-14
- [ ] Confirm a 60 product sheet → progress "جارٍ الاستيراد: 25 من 60…", the leave warning on reload while running, then "تم: …" line counted from the run; "تنزيل المشاكل" saves an xlsx with الصف, الكود, الملف, المشكلة, الإجراء → AC-15
- [ ] Run the same sheet and photos again → same products, same photo count, only versions change → AC-15
- [ ] As a customer and as an admin at `aal1`, the four import actions answer `forbidden`; 26 products in one call or a key from another product's folder are refused → AC-16
- [ ] Phone sized RTL screen: the full flow passes axe in the empty, review, and done states → AC-17

## Value sourcing (one step per value)
- [ ] Row number: a sheet with an empty row 3 → a problem on the next row reads its real spreadsheet number
- [ ] Product code: `ch-١٠٠` in the sheet and `CH-100.jpg` match the same product
- [ ] Create or update: a code that exists live → marked تحديث; one that does not → جديد
- [ ] New categories and colours: a name that differs only in spacing or case from an existing one is not listed as new
- [ ] Product id: an updated product keeps its id and editor URL; a created one gets a new id
- [ ] Version check: save the product in the editor between review and confirm → the import still succeeds once (retry), the editor then meets "stale"
- [ ] Name and description: empty cells keep the stored text; filled cells replace it
- [ ] Category: main and sub empty on an update → stored category kept; main filled, sub empty → the product moves to the main
- [ ] Specs: a filled القدرة cell replaces the stored القدرة row; a new label is appended after the stored rows
- [ ] Status: ظاهر empty keeps the stored visibility on update, makes a new product hidden; نعم → active, لا → hidden
- [ ] Availability: متوفر empty keeps the stored value on update, `true` on create
- [ ] Sizes and originalLabel: `xl` in the sheet keeps the stored `XL` size's rows and ids
- [ ] Variant price: `٤٥٠` and `450.5` read as ₪450 and ₪450.50; a product with no sizes takes its single row's price
- [ ] Colours: a listed colour by name reuses its id; an unknown one is created
- [ ] Pair availability: an unticked stored pair stays unticked; a new size or colour starts ticked
- [ ] Media: an update by sheet alone keeps the stored photos and video
- [ ] Photo target: a live product not in the sheet receives its photos; a sheet product that ended skipped does not
- [ ] Main for a sub alone: a sub given alone on an update is shown and created under the product's stored main
- [ ] Photo sort: `CODE_3.jpg` and `CODE.jpg` → `CODE.jpg` is the main photo, the video sorts after both
- [ ] Width, height, storage key: an attached photo row carries the resized size and a key under `products/<id>/`
- [ ] Result counts: a run where one product fails mid run → "لم يُستورد" counts it, the review's numbers are not reused

## Commands
- [ ] `pnpm exec vitest run src/features/catalog` → all pass (import sheet, plan, run, photo names, and the database tests with local Supabase) → AC-3 to AC-15
- [ ] `pnpm exec playwright test e2e/product-import.spec.ts --project=phone` → 3 passed → AC-1, AC-2, AC-3, AC-12 to AC-15, AC-17
- [ ] `pnpm lint && pnpm typecheck && pnpm format:check` → clean

## Acceptance-criteria coverage
- AC-1 UI step 1, e2e · AC-2 UI step 2, e2e · AC-3 UI steps 3 and 4, unit, e2e · AC-4 UI step 5, unit · AC-5, AC-6 UI step 6, unit · AC-7 UI step 7, unit, DB · AC-8 UI step 8, unit, DB · AC-9, AC-10 UI step 9, unit, DB · AC-11 UI steps 6 and 10, unit, DB · AC-12 UI step 11, unit · AC-13 UI step 12, unit, DB · AC-14 UI step 13, unit, e2e · AC-15 UI steps 14 and 15, unit, DB, e2e · AC-16 UI step 16 · AC-17 UI step 17, e2e
