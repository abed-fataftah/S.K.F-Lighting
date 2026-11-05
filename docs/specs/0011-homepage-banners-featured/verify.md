# Verify: Homepage, banners & featured products · spec 0011 · updated 2026-10-26
_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] With no active banner, open `/` on a 390 wide screen → yellow strip "توصيل: الضفة ₪20 · الداخل ₪70", header, black hero with the chandelier on the left, the only `h1` is "ثريات وإنارة / وكهربائيات", then circles, featured products, the four trust cards, footer, bottom bar → AC-1, AC-3
- [x] Tap "تسوّق الآن" → the page moves to "تسوّق حسب القسم" and focus lands on its heading; with reduced motion on it jumps without smooth scrolling → AC-3
- [ ] Untick every main in `/admin/homepage` and save → "تسوّق الآن" now goes to "منتجات مختارة"; with no products either it is hidden → AC-3, AC-4
- [x] In `/admin/homepage`, "+ إضافة بانر", pick a 700 wide picture → "الصورة صغيرة، اختر صورة بعرض 800 بكسل على الأقل", nothing uploads → AC-10
- [x] Pick a large picture → the preview shows the centred 16:9 crop with upload progress; "حفظ" stays disabled until the upload ends → AC-10, AC-13
- [x] Save a banner titled with the picture's words and linked to a sub category → the row shows "الرابط: <main> › <sub>"; Home shows the banner alone as a 16:9 picture whose link opens the sub page; the `h1` is the hidden "S.K.F للإنارة" → AC-2, AC-8, AC-10
- [x] Add a second banner with no link → Home shows a carousel: swipe snaps one per view, "البانر السابق" is disabled on the first, "البانر التالي" on the last, dots read "البانر N من M" with `aria-current`; Tab reaches only the shown banner's link; it never moves by itself → AC-2
- [x] Hide the linked sub category → the editor row shows "الرابط غير متاح" and Home shows that banner as a plain picture; show it again and the link comes back → AC-8, AC-10
- [x] Delete the linked category (after emptying it) → the banner row reads "الرابط: بدون رابط" → AC-8, AC-10
- [x] Tick six banners → the sixth checkbox is disabled with "خمسة بانرات فعّالة كحد أقصى"; add a banner while five are active → the page notice says it was saved inactive → AC-9, AC-10
- [x] Add ten banners → "+ إضافة بانر" is replaced by "عشرة بانرات كحد أقصى. احذف بانرًا لإضافة غيره." → AC-10
- [x] Edit a banner without a new picture and save → the picture stays; "حذف البانر" asks "حذف البانر؟ لا يمكن التراجع." then removes the row → AC-10
- [x] Reorder with ↑ ↓, untick one, then try to leave or reload → the browser asks first; "حفظ التغييرات" shows "تم حفظ التغييرات." and Home follows the new order → AC-9
- [x] Open the editor in two tabs; add a banner in tab A, then save in tab B → tab B shows "تغيّرت الصفحة الرئيسية منذ فتحتها" with "إعادة التحميل", which reloads with tab A's banner → AC-9
- [x] In "إضافة منتج", type one letter → "جارٍ البحث" then up to ten matches by name with tile, code, and a "مخفي" or "غير متوفر" badge; an archived product never appears; a picked one is left out of later searches; at eight picks the field becomes "ثمانية منتجات كحد أقصى." → AC-12
- [x] Pick a hidden product and an out of stock one, save → Home shows only the out of stock one, with its out of stock card and W4 button; the hidden row keeps its "مخفي" badge → AC-5, AC-8
- [x] Archive a picked product in another tab, then save the editor → its row shows "لم يعد هذا المنتج متاحًا. أزله ثم احفظ." and nothing is written; remove it and save again → AC-9
- [x] Remove every pick and save → Home's "منتجات مختارة" shows the 8 newest sellable products → AC-5
- [x] In `/admin/categories`, edit a main → "صورة الدائرة" and "السطر تحت الدائرة (اختياري)" with a hint of the line Home would build; edit a sub → neither field shows → AC-11
- [x] Give a main a square photo and a line → Home's circle shows the photo and the line; a main with no line shows its first three menu subs as "أ، ب و ج" → AC-4, AC-11
- [x] With four or more circles → the carousel loops, moves every 3.5 s until a touch or a focus inside, the pause button ("إيقاف التمرير التلقائي", `aria-pressed`) stops and restarts it, and with reduced motion it never moves and the pause button is gone → AC-4
- [x] With one to three circles → a still row of links, no arrows, no pause, no yellow button → AC-4
- [x] Untick a main for Home and save → its circle is gone; a hidden or empty main ticked in the editor ("(مخفي)", "(فارغ)") does not show until it qualifies → AC-4, AC-8
- [x] Trust cards → "توصيل لكل مكان" with "الضفة ₪20 · الداخل ₪70", "الدفع عند الاستلام" with its line, "رسالة جاهزة برقم الطلب" with no line, "استلام من المعرض" with "اسأل عن العنوان عبر واتساب" while no address is set → AC-6
- [x] Open any page other than `/` → no yellow strip → AC-6
- [x] Stop the local database and load `/` → the page still renders (hero, trust cards with fallbacks), and the log has `home_read_failed` lines naming each part and the error kind, no values → AC-7
- [x] Signed in as a customer, open `/admin/homepage` → redirected to the dashboard sign in → AC-15

## Commands
- [x] `pnpm db:migrate` then `psql … -c "select name, short_name from delivery_zones"` → "الضفة" and "الداخل"; checkout still shows the full names → AC-14
- [x] `pnpm db:check-rls` → passes with `banners` and `featured_products` → AC-15
- [x] `pnpm exec vitest run src/features/home src/features/catalog/media-rules.test.ts src/features/catalog/components/resize-image.test.ts src/features/catalog/schemas.test.ts` → all pass → AC-16
- [x] `pnpm exec vitest run src/features/home/server/homepage.db.test.ts src/features/catalog/server/categories.db.test.ts` (local database) → all pass → AC-9, AC-10, AC-16
- [x] `pnpm exec playwright test --project=homepage --no-deps` → the owner and customer flow passes with axe on Home (banner and hero) and the editor → AC-16
- [x] `pnpm media:sweep` → logs `pictures` and `removedPictures`; a `banners/` file no row points at and older than a day is removed → AC-13
- [x] As the `media_sweep` login: `select image_key from banners` works, `select name from categories` is refused → AC-13

## Value sourcing
- [ ] Home banners and order: set `sort` by hand to put an inactive banner first → it is not shown; the active ones show by `sort, id`, at most five
- [x] Banner link address: rename the linked category's slug → the banner follows the new slug with no edit
- [x] Hero copy and WhatsApp: "اطلب عبر واتساب" opens `wa.me/<NEXT_PUBLIC_WHATSAPP_NUMBER>` with the W1 text
- [x] Circle order and line: change `sort` between two mains → the circles swap; clear a `home_subtitle` → the built line appears
- [ ] Featured order: reorder picks in the editor → Home follows the new order
- [x] Featured fallback: with picks that are all hidden → Home shows the newest 8 sellable instead
- [ ] Strip and delivery card: change a zone's `fee` and `short_name` in the database → Home and checkout both show the new fee; set `is_active = false` on both zones → the strip is hidden and the card has no line
- [x] Pickup card: set `shop_settings.address` → the card shows it instead of the fallback
- [ ] Editor badges: hide a picked product's category → its row shows "القسم مخفي"
- [x] Editor mains: a main whose only products are in a hidden sub → "(فارغ)"
- [x] New banner `sort` and `is_active`: add a banner with five active → it goes last and inactive
- [ ] Version check: every banner save, delete, and page save raises `shop_settings.home_version` by exactly one; a category dialog save leaves it alone
- [x] Storage keys: every new upload is `banners/<uuid>.<webp|jpg>` or `categories/<uuid>.<webp|jpg>`; a banner saved with a key that is not in Storage is refused with "تعذّر حفظ الصورة. ارفعها مرة أخرى."
- [x] Crop and size: a 4000×3000 photo is stored at 1600×900; a 3000×3000 circle photo at 800×800

## Acceptance-criteria coverage
- AC-1 layout and h1 · UI step 1, `(home)/page.test.ts`, phone flow
- AC-2 banners on Home · UI steps 6, 7, phone flow, `homepage.db.test.ts`
- AC-3 hero fallback · UI steps 1 to 3, phone flow
- AC-4 circles · UI steps 20 to 23, `home-rules.test.ts`, phone flow
- AC-5 featured · UI steps 16, 18, `homepage.db.test.ts`, `home.test.ts`
- AC-6 fees and trust cards · UI steps 24, 25, `fees.test.ts`
- AC-7 each section stands alone · UI step 26, `home.test.ts`
- AC-8 the editor · UI steps 6, 8 to 10, 16, 23
- AC-9 page save · UI steps 10, 13, 14, 17, `homepage.db.test.ts`, `editor-state.test.ts`
- AC-10 banner dialog · UI steps 4 to 12, `homepage.db.test.ts`
- AC-11 category circle fields · UI steps 19, 20, `categories.db.test.ts`
- AC-12 product picker · UI step 15
- AC-13 storage files · Commands 6, 7, Value sourcing "Storage keys", `media-rules.test.ts`
- AC-14 short names · Command 1, `schema.db.test.ts`
- AC-15 access · UI step 27, Command 2
- AC-16 tests · Commands 3 to 5
