# Verify: Search & filters · spec 0010 · updated 2026-10-25
_Steps derived from spec 0010 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual (phone width, 390 × 844)
- [ ] Open `/search` → `h1` "البحث", the hint "اكتب اسم المنتج أو الكود", the help card, the header field focused, the بحث tab current, no product read → AC-1
- [ ] Open `/search?q=ث` → the prompt with "اكتب حرفين على الأقل"; the header field shows `ث` → AC-1, AC-2
- [ ] Search `انارة حديقه` for a product named "إنارة حديقة" → it is found; the header field holds the query and is not focused → AC-2, AC-3
- [ ] Search a product name with Persian `ی` or `ک` typed in place of `ي` or `ك` → the same product is found → AC-2
- [ ] Search two words in reverse order (`حديقه انارة`) → still found; add a word the name lacks → not found → AC-3
- [ ] Search a hidden product's name, an archived product's name, and a product in a hidden category → none appear → AC-3
- [ ] Search an exact product code in lower case → that product is the first card, ahead of a newer product whose code only starts with it → AC-4
- [ ] Search a query with more than 24 matches → "تم عرض 24 من M نتيجة"; "عرض المزيد" → `?q=…&page=2#p-25`, focus on card 25's name link → AC-5
- [ ] Results page: "M نتيجة للبحث عن «q»" in a `role="status"` region; the query chip's × (named "إزالة البحث q") goes to the prompt → AC-5
- [ ] Search `zz-nothing` → "لا توجد نتائج لـ «zz-nothing»", the green WhatsApp button, no filter button; add `&available=1` to a search with results that has none available → the yellow "مسح التصفية" appears → AC-6
- [ ] Throttle the network to slow 3G and search → six skeleton cards with the hidden text "جارٍ تحميل النتائج" → AC-6
- [ ] Stop the local database and search → "تعذّر تحميل المنتجات" with retry and WhatsApp, no toolbar or chips; the server log shows `{"event":"search_read_failed",…}` with no query text → AC-6
- [ ] View the source of `/search?q=…` → title "نتائج البحث | S.K.F للإنارة", `noindex, follow`, no canonical → AC-14
- [ ] On a category with sizes and colours, open "تصفية" → full screen dialog, close button focused first, page does not scroll behind it; price placeholders are the lowest price rounded down and the highest rounded up; sizes ordered by their number (`2.5سم`, `60سم`, `60x40`, `120سم`, then `صغير`, `كبير`); colours by their sort with a dot (outlined when no hex) → AC-10, AC-11
- [ ] In the screen, pick a size, then a colour → "عرض N منتج" changes after each pick, and a screen reader hears the new N → AC-12
- [ ] Apply → the address is `?size=…&colour=…` in that order, the list shows M = the N you saw, the badge shows the chip count, focus is on "تصفية" → AC-8, AC-11, AC-12, AC-13
- [ ] Pick 60 cm and gold on a category where one product has 60 cm only in black and gold only in 80 cm → that product is not in the list → AC-9
- [ ] Turn on "المتوفر فقط" → products whose matching option is out of stock leave the list; its chip "المتوفر فقط" appears → AC-9, AC-13
- [ ] Type `١٠٠` in "من" and `٢٠٠` in "إلى" → applied as `min=100&max=200`; a product priced exactly ₪200 stays; the chip reads "من ₪100 إلى ₪200" → AC-8, AC-9, AC-13
- [ ] Copy the filtered address into a new tab → the same list and chips → AC-8
- [ ] Remove one chip with its × → the other filters stay; focus returns to "تصفية"; "مسح الكل" clears every filter → AC-11, AC-13
- [ ] On a filtered list, tap a sub category chip and "عرض المزيد" → both keep the filters in their links → AC-11
- [ ] Open a filtered address that matches nothing (`?size=80سم&max=1`) → "لا توجد منتجات مطابقة", the yellow "مسح التصفية", the WhatsApp button; breadcrumb, `h1`, and sub chips stay → AC-13
- [ ] Open `?colour=بنفسجي&min=500&max=100` on a category → a working list, the unknown colour dropped, the prices swapped (chip "من ₪100 إلى ₪500"); `?min=abc` alone → an unfiltered list → AC-8
- [ ] View the source of a filtered category page → `noindex, follow` and a canonical to the unfiltered page 1; an unfiltered page 1 keeps its own canonical → AC-14
- [ ] On a category with no listed products → spec 0008's empty state and no toolbar → AC-13
- [ ] Open the screen, block `/api/catalog/count` in the browser's network panel, pick a chip → the button reads "عرض النتائج" and applying still works → AC-12
- [ ] Open the screen and press Escape → the address is unchanged → AC-11

## Commands
- [ ] `pnpm db:migrate` → `products.search_text` (text, not null, default `''`) and `product_variants.size_key` (text, null) exist → AC-7
- [ ] `pnpm db:backfill-search` twice → the second run prints "0 products and 0 options changed" → AC-7
- [ ] Rename a product in the editor, then `select search_text from products where code = '<code>'` → holds the new folded name in the same save → AC-7
- [ ] Relabel a size from "60 سم" to "70 سم" in the editor → that option's `size_key` is `70سم` → AC-7
- [ ] Import a spreadsheet row with a new name → its `search_text` updates in the same import → AC-7
- [ ] `curl -i '/api/catalog/count?q=ثريا'` → 200, `{"count":N}`, `Cache-Control: no-store` → AC-12
- [ ] `curl -i '/api/catalog/count'`, `?main=a&q=ab`, `?sub=b` → 400 each; `?main=nope` → 404; `?q=ث` → `{"count":0}` → AC-12
- [ ] For one category and filter set, the count route's N equals the page's "M منتج" (with no filter, with a dropped colour, with `available=1`) → AC-12
- [ ] `E2E_TARGET=preview pnpm exec playwright test e2e/rate-limit.spec.ts --project=rate-limit --no-deps` → the count route answers 429 after 60 calls in a minute → AC-15
- [ ] `pnpm dev` with no limiter binding → count calls still answer, and the log shows `{"event":"catalog_count_rate_unchecked"}` once → AC-15
- [ ] `curl -i '/api/catalog/count?q=ab'` → no `Set-Cookie` from a session refresh, and no locale rewrite → AC-15
- [ ] `pnpm exec vitest run` and `pnpm exec playwright test e2e/search-filters.spec.ts --project=phone` → all pass → AC-16

## Value sourcing
- [ ] `search_text` = folded name, code, live option codes in `sort` order: give a product two option codes, archive the first → only the second stays in `search_text` → Value sourcing
- [ ] `size_key` = folded label without spaces: label `٦٠ X ٤٠` → `60x40` → Value sourcing
- [ ] Backfill count = rows whose value differs: set one product's `search_text` to `stale` by SQL → the backfill reports 1 product changed → Value sourcing
- [ ] Shown query = first `q`, cut to 100 code points, tidied: `/search?q=<150 characters>&q=other` → the chip shows the first 100 characters of the first `q` → Value sourcing
- [ ] Folded query and words: `إنارةُ  إنارة` → one word `اناره` (duplicates removed) → Value sourcing
- [ ] Code query = folded query upper cased: search a code typed in full width `ＤＥＭＯ-２` → that product first → Value sourcing
- [ ] Prompt vs results by folded length: `ثُ` (a letter and a mark) → the prompt with the note → Value sourcing
- [ ] Tier SQL vs code: an exact option code puts its product first even when newer products match by name → Value sourcing
- [ ] M = filtered count, else the tree count: a category with 30 products, filtered down to 3 → "3 منتج" and no "عرض المزيد" → Value sourcing
- [ ] N = `min(page × 24, M)` with the page clamped: `?page=99` on a filtered list of 3 → "تم عرض 3 من 3" → Value sourcing
- [ ] Known colours = colours used by the list's live options: a colour used only by an archived option never shows in the screen → Value sourcing
- [ ] Size label = most common label: two options labelled `60سم` and one `60 سم` share the key → the chip reads `60سم` → Value sourcing
- [ ] Price placeholders from live options only: an archived option priced ₪5 does not lower "من" → Value sourcing
- [ ] Option match on one option (`exists`): see the 60 cm and gold step above → Value sourcing
- [ ] Resolved filters decide "active": `?colour=بنفسجي` alone → no chips, no badge, an indexable page with its own canonical → Value sourcing
- [ ] Chip text through `money.ts`: `?min=1250` → "من ₪1,250" → Value sourcing
- [ ] Badge = chip count: two sizes and a price → badge 3 → Value sourcing
- [ ] Count route scope through the cached tree: a hidden category's slug → 404, the same as its page → Value sourcing
- [ ] Rate key = `cf-connecting-ip`, else `local`: two IPs on preview get separate allowances → Value sourcing
- [ ] Card unchanged: a filter for ₪100 to ₪200 can show a card "من ₪50" (the product's lowest price) → Value sourcing
- [ ] Canonical from `NEXT_PUBLIC_SITE_URL` + `routes.categoryPage(main, sub)` on a filtered page → Value sourcing

## Acceptance-criteria coverage
- AC-1 prompt steps · AC-2 hamza, Persian, too short · AC-3 every word, hidden · AC-4 exact code first · AC-5 results, paging · AC-6 empty, loading, error · AC-7 migrate, backfill, save, import · AC-8 address, round trip, bad link · AC-9 one option, available, bounds · AC-10 choices order and placeholders · AC-11 screen, focus, Escape · AC-12 live N, count route, fallback · AC-13 toolbar, chips, empty · AC-14 search and filtered metadata · AC-15 limiter, fail open, proxy · AC-16 Vitest and the phone flow
