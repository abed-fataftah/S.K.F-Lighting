# Verify: product page · spec 0009 · updated 2026-10-25
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run them on a phone sized screen (390 wide), with `pnpm dev` and the local database (`pnpm db:start`). A good test product has 2 sizes at different prices, 2 colours, one pair unticked, 2 photos, and a video.

## UI / manual
- [ ] Open `/p/<slug>` of a product in a shown category → the page shows; hide its category in `/admin/categories` and reload → the not found page with status 404 → AC-1, AC-16
- [ ] Archive a variant in the editor, reload the page → its size or colour chip is gone if no other live variant has it → AC-1
- [ ] Untick one pair in the editor, reload → that pair is never selectable, the product still shows → AC-1, AC-3
- [ ] Sizes appear in `size_sort` order and colours in the editor's colour order, each colour chip with its swatch dot → AC-2
- [ ] A product with one size still shows that one chip, pressed; a product with no options shows neither group → AC-2
- [ ] Press the chip that is already pressed → nothing changes, it stays pressed → AC-2
- [ ] Choose the size of the unticked pair → its colour chip is disabled, struck through, and reads "· غير متوفر" → AC-3
- [ ] From the other colour, choose that size → the colour moves to the first one that sells → AC-3
- [ ] Open the bare page → the default pair is pressed and the address has no `?v` → AC-4, AC-6
- [ ] Open with `?v=<another variant of this product>` → that pair is pressed; with `?v=abc`, another product's variant id, or an unticked pair's id → the default, no error → AC-4
- [ ] Change the size → the price and "· للحجم <size>" change at once with no network request, and the address becomes `?v=<id>` → AC-5, AC-6
- [ ] Reload → the same choice; press back once → you leave the product page → AC-6
- [ ] Set the product's own availability off → every chip disabled, no stepper, stock word "غير متوفر", photos at 45% with the black label, price muted with no size note, "غير متوفر" disabled button, both WhatsApp buttons read "اسأل عن توفره عبر واتساب" and open W4 with the bare link → AC-7
- [ ] Set the stepper to 3, change size → still 3; add → ink button "تمت الإضافة إلى السلة" for 2 seconds, then "عرض السلة" stays; the cart line shows that size, colour, and quantity → AC-8
- [ ] With the page open, untick the chosen pair in the database, press add → "هذا المنتج لم يعد متوفرًا." shows and the choice moves to a pair that sells, with the address updated → AC-8
- [ ] Open both WhatsApp buttons → W3 with name, code, the size and colour names, and the link with `?v`; change colour → the message follows → AC-9
- [ ] Gallery: swipe through the photos then the video; arrows loop at both ends; the counter and the pressed thumbnail follow; the video thumbnail shows the first photo with a play icon → AC-10
- [ ] Network tab: no `.mp4` request until you press play; swipe away from the playing video → it pauses → AC-11
- [ ] Press a photo → full screen on black, opened on that photo; arrows and counter work over photos only; pinch zoom works; Esc and ✕ close it; focus returns to the photo button; the strip shows the photo you last saw → AC-12
- [ ] Share on a phone → the share sheet; cancel → nothing; on desktop (no share sheet) → "تم نسخ الرابط" and the clipboard holds the link with `?v` → AC-13
- [ ] A product in a sub category → the breadcrumb reads الرئيسية, the main, the sub, the product; both category links open their pages → AC-14
- [ ] Description keeps its line breaks; specs rows keep their order; the help card's WhatsApp button follows the choice → AC-14
- [ ] Change a price in the dashboard, reload the product page → the new price shows → AC-17
- [ ] Tab through the page → every control reachable with a visible focus outline; all controls are at least 44×44 → AC-18

## Commands
- [ ] `pnpm exec vitest run src/features/catalog/product-view.test.ts src/features/catalog/product-seo.test.ts src/features/catalog/seo.test.ts src/lib/routes.test.ts src/lib/media-url.test.ts` → all pass → AC-2 to AC-10, AC-15, AC-19
- [ ] `pnpm exec vitest run src/features/catalog/server/storefront.db.test.ts` → the product page read tests pass → AC-1, AC-19
- [ ] `pnpm exec playwright test e2e/product-page.spec.ts --project=phone` → 4 pass, axe included → AC-2 to AC-13, AC-16, AC-18, AC-19
- [ ] `pnpm exec playwright test e2e/first-order.spec.ts` → the slice 1 first order flow still passes → AC-19
- [ ] `curl -s "<site>/p/<slug>?v=<id>"` → `<link rel="canonical">` is the bare `/p/<slug>`; the meta description is the first 155 characters of the description (or the shop description); the `Product` JSON-LD has `sku`, `offers` (`Offer` for one price, `AggregateOffer` for several, prices like `"19.90"` and `"1250"`, `ILS`, InStock or OutOfStock), and a `BreadcrumbList` with absolute URLs → AC-15
- [ ] `curl -s -o /dev/null -w "%{http_code}" "<site>/p/missing"` → `404`; there is no `loading.tsx` under `src/app/[locale]/p/` → AC-16

## Value sourcing
- [ ] Listed or not: a product `hidden`, or in a hidden main's sub → 404 → `listedProduct`
- [ ] Sellable per variant: product `is_available` off makes every variant not sellable even with ticked pairs → `isSellable`
- [ ] Selected id: `?v` of a sellable pair wins; else the default if it sells; untick the default → the first sellable by `sort` → `pickVariantToAdd`
- [ ] Size order: swap two sizes' `size_sort` in the database → the chips swap → `size_sort`
- [ ] Colour order: change the variants' `sort` so the second colour comes first → its chip moves first → lowest `sort` per colour
- [ ] Colour dot: change a colour's `hex` → the dot follows; a colour with no hex shows an empty outlined dot → `colours.hex`
- [ ] Shown price: two sizes at different prices → each pair shows its own price, never a size level guess → the variant's `price`
- [ ] Muted price: out of stock, change the default variant's price → the muted price follows; with no default → the first live variant's by `sort` → `mutedPrice`
- [ ] Size note: a colour only product shows no "للحجم" note → the variant's `size_label`
- [ ] Stock word: untick every pair → "غير متوفر" muted → `inStock`
- [ ] Absolute link: W3, share, and canonical all start with `NEXT_PUBLIC_SITE_URL`; a product with no options never gets `?v` → `productLink`
- [ ] W3 size and colour text: a sizes only product → only the size; no options → nothing between the code and the link → `selectionText`
- [ ] Photo URL: photos load through `/storage/v1/render/image/public/product-media/...` → `src/image-loader.ts`
- [ ] Photo alt: a photo with an `alt` uses it; without → "<name>، صورة N" with Western digits → `galleryItems`
- [ ] Counter: reads "1 / 3" with Western digits inside a left to right span → `formatNumber`
- [ ] Video source and poster: source is `/storage/v1/object/public/product-media/<key>`; poster is the first photo at width 828; no photo → no poster → `mediaObjectUrl`, the image loader
- [ ] Meta description: a description with line breaks and 200 characters → collapsed to one line, 155 characters → `metaDescription`
- [ ] JSON-LD images: absolute public object URLs, at most 8 → `mediaObjectUrl`
- [ ] JSON-LD prices: a pair at 19.90 → `"19.90"`; out of stock → prices of all live pairs with OutOfStock → `toShekelsInput`, counted variants
- [ ] Quantity: kept across chip changes and a refresh, back to 1 when the product becomes out of stock → the provider's reducer

## Acceptance-criteria coverage
- AC-1: UI 1 to 3, Commands 2, Value sourcing 1 to 3
- AC-2: UI 4 to 6, Commands 1 and 3
- AC-3: UI 3, 7, 8, Commands 1 and 3
- AC-4: UI 9 and 10, Commands 1 and 3
- AC-5: UI 11, Commands 1 and 3
- AC-6: UI 9, 11, 12, Commands 1 and 3
- AC-7: UI 13, Commands 3
- AC-8: UI 14 and 15, Commands 3
- AC-9: UI 16, Commands 1 and 3
- AC-10: UI 17, Commands 1 and 3
- AC-11: UI 18
- AC-12: UI 19, Commands 3
- AC-13: UI 20, Commands 3
- AC-14: UI 21 and 22
- AC-15: Commands 1 and 5
- AC-16: UI 1, Commands 3 and 6
- AC-17: UI 23
- AC-18: UI 24, Commands 3
- AC-19: Commands 1 to 4
