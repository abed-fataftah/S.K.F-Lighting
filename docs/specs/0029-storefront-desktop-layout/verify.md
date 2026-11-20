# Verify: Storefront desktop and tablet layout · spec 0029 · updated 2026-11-20
_Steps derived from spec 0029 acceptance criteria. Ticked by `/check verify` on 2026-11-15, 2026-11-20, and 2026-11-21 where the runs proved them._ `/check verify` runs these; `/test` locks the durable ones. Slices 1 and 2 (tasks 1 to 12) so far; later slices append theirs._

## UI / manual
- [x] At 390 wide, open `/`, a category, a product, the cart, and `/orders/track` → each looks exactly as before: 480 column, phone header, bottom bar, float → AC-1
- [x] At 1280, open `/` → the strip, header, and footer black run edge to edge; the home content sits in the centred content box → AC-3
- [x] At 1280 → the header is one row: logo, search (at most 640 wide), `حسابي`, cart; no menu button; Tab from the logo goes search, search button, `حسابي`, cart → AC-4, AC-21
- [x] At 1280 → `حسابي` goes to `/account/orders`; the cart badge shows the line count → AC-4
- [ ] At 1280, under the header → a black `nav` "الأقسام" with the navigation mains in the menu sheet's order; open one → its link has `aria-current="page"`, also on its sub category pages → AC-5
- [x] At 1280 with more than 6 navigation mains → `المزيد` lists the rest, then `كل الأقسام` (to `/c`); Enter opens it, Escape closes it and focus returns to the button → AC-5
- [x] Make the navigation read fail (stop the database) at 1280 → no category bar, the header still renders → AC-5
- [x] At 1280 → no bottom bar, and the footer is the last thing on the page (no empty room under it) → AC-6
- [x] At 820 and 1280 → the WhatsApp float sits 24px from the screen's left edge (end, in Arabic); 84px above the bottom at 820, 24px at 1280; at page end it covers no footer link → AC-7
- [x] At 1280 → the footer is three columns: logo, contact, and `تواصل معنا عبر واتساب` on the right, `تسوّق` (six mains, then `كل الأقسام`) in the middle, `مساعدة` (the four links, each 44 high) on the left; the copyright line under them → AC-8
- [x] Open the seeded `ثريات` category at 390, 820, 1280 → 2, 3, 4 grid columns; content inside a centred box at most 1280 wide with 16, 24, 32px side padding → AC-3, AC-9
- [x] A category with sub chips at 820 → the chips wrap onto more lines instead of scrolling sideways → AC-9
- [x] At 1280 with a mouse, hover a product card → its border turns ink and its photo zooms in a little inside the frame; on a touch tablet nothing changes → AC-19
- [x] Inspect a product card photo → `sizes` is `(min-width: 1024px) 300px, (min-width: 768px) 33vw, (min-width: 480px) 240px, 50vw`; at 1280 the loaded file is about 300px wide, not a stretched phone one → AC-20
- [x] At 768, 820, 1024, 1280, 1920 on `/` and a category → no sideways scroll → AC-3

### Slice 2: browsing
- [x] At 1024 with about 16 navigation mains → the row holds only whole links, the rest sit in `المزيد` in the same order, then `كل الأقسام`; Space opens it → AC-5
- [ ] Widen that window to 1280 → more links move into the row; narrow it again → they move back; with few mains that all fit → no `المزيد` button → AC-5
- [x] A category at 1280 → a 260 wide filter column on the right, the grid in 3 columns beside it; no `تصفية` button → AC-9, AC-10
- [x] In the column, press a size chip → the address gains `size=`, the count and grid reload, the page does not jump, focus stays on the chip → AC-10
- [x] Type `١٥٠` in `من` → nothing applies yet; press Enter (or `تطبيق`) → `min=150` joins the chip in the address → AC-10
- [x] Remove a chip from the applied chips row → the column's chip unpresses; `مسح الكل` → the plain category address and empty price fields → AC-10
- [x] At 900, open `تصفية`, then widen to 1100 → the filters screen closes; same with the menu sheet → AC-11
- [x] Search a word at 390, 820, 1280 → 2, 3, then 3 columns beside the filter column (4 if the results offer no filters) → AC-9, AC-10
- [ ] `/c` at 390, 820, 1280 → category cards 1, 2, 3 across; hover a card at 1280 → ink border → AC-9, AC-19
- [x] A product at 820 → one centred column at most 720 wide; at 1280 → gallery on the right (main image 520 high), purchase box on the left, breadcrumb above both, description and specs across below → AC-12
- [x] At 1280 by 800, scroll a long product page → the purchase box stays 16px from the top; at 1280 by 640 → it scrolls away → AC-12
- [ ] Home with no banners at 820 and 1280 → the hero spans the content width, words on the right, chandelier on the left; circles in one row of the same size, centred with no arrows when they fit, with no pause or yellow button; trust cards 2 by 2, then 4 in a row at 1280; featured 3, then 4 across → AC-9, AC-13
- [ ] Home with a banner at 820 → the banner centred at most 720 wide; at 1280 → the banner in the right two thirds, a black side card in the left third with an `h2` headline, `تسوّق الآن`, and WhatsApp; the page `h1` is still the hidden shop name → AC-13
- [ ] Inspect the gallery photo and a banner → `sizes` are `(min-width: 1024px) 680px, (min-width: 768px) 672px, (min-width: 480px) 448px, 100vw` and `(min-width: 1024px) 830px, (min-width: 768px) 720px, (min-width: 480px) 448px, 100vw` → AC-20

### Slice 3: buying
- [x] Add a product, open `/cart` at 820 → one centred column at most 720 wide, the summary under the lines → AC-14
- [x] `/cart` at 1280 by 800 → lines on the right, a 360 wide summary on the left, side by side; add enough lines to scroll → the summary stays 16px from the top; at 1280 by 640 → it scrolls away → AC-14
- [x] `/checkout` at 820 → one centred column at most 720 wide, the summary card last → AC-14
- [x] `/checkout` at 1280 by 800 → contact, method, and pay cards on the right, the 360 wide summary on the left, sticky; at 1280 by 640 → not sticky → AC-14
- [x] On `/checkout` at 1280, focus `ملاحظات (اختياري)` and press Tab → focus lands on `تأكيد وإرسال عبر واتساب` in the summary; clear the name and press it → the form is refused and focus goes back to `الاسم الكامل` → AC-14
- [ ] At 1280, open `/orders/track`, `/account/sign-in`, `/account/reset-password`, `/account` (signed in), and an order confirmation `/checkout/done/<number>` → each is a centred column 560 wide inside the full shell → AC-17
- [ ] Break a storefront read (stop the local database) and open a category at 1280 → the error card sits in the centred 560 column → AC-17
- [x] `/policies/terms` at 1280 → a centred column 720 wide → AC-17
- [x] Open unknown addresses `/no-such-page` and `/account/nothing` at 390, 820, and 1280 → HTTP 404, the designed 404 card (404, `الصفحة غير موجودة`, home, browse, WhatsApp) in the centred 560 column inside the full shell (header, footer, bottom bar below lg), one `h1`, tab title `الصفحة غير موجودة | S.K.F للإنارة`, `noindex` → AC-17
- [x] Open `/`, `/c`, `/cart`, `/orders/track` → each still its own page, never the 404 (the unknown address catch all only takes what no route matches) → AC-17
- [x] At 390, cart, checkout, the narrow pages, and policies → exactly as before (480 column) → AC-1

### Slice 4: accounts
- [x] Look up an order at `/orders/track`, then view it at 820 → one centred column at most 720 wide, in phone order: status, products, payment, buttons → AC-15
- [x] The same order at 1280 → products and payment on the right, the timeline (360 wide) and the WhatsApp and cancel buttons on the left; payment sits right under products when the products card is the taller one; Tab still goes status badge, products, payment, then the buttons → AC-15, AC-21
- [ ] Known look: with a one line order the timeline is taller than products, so a gap shows above the payment card at 1280 (both columns share row lines); worth a look in the designer pass → AC-15
- [x] Sign in as an electrician with two orders and two drafts; `/account/orders` and `/account/drafts` at 390 → cards one across; at 820 and 1280 → two across → AC-15
- [x] Open a draft in quick order at 1280 → a header row (product, size, colour, quantity) over rows of line number, product, size, colour, quantity, unit price, line total, delete; every row lines up with the header, also for a product with no size or colour; the totals card 360 wide on the left under the table → AC-16
- [x] In a row at 1280, focus the quantity and press Tab → focus moves to that row's delete button; a screen reader still reads each field's own label (`الكود أو اسم المنتج`, `الحجم`, `اللون`, `الكمية`) and not the header row → AC-16, AC-21
- [ ] Clear a line's quantity and press send → the error shows under that row, the quantity has `aria-invalid` and `aria-describedby` pointing at it → AC-16
- [ ] Build 30 lines at 1280 → add line is held at 30; save and send work as on a phone → AC-16
- [ ] At 390, quick order → the line cards look as before, the delete button in each card's top corner; Tab now reaches it after the line's fields → AC-1, AC-16
- [x] As an electrician, open add to draft on a product at 1280 → a centred dialog 560 wide with a border and rounded corners, fading in; narrow the window to 900 while it is open → it stays open and becomes the bottom sheet → AC-18, AC-11
- [ ] Open an admin sheet (the dashboard menu) at 1280 → unchanged, still a side panel → AC-18

### Desktop polish (after the first verify)
- [x] Home at 820 with more circles than fit → arrows on both sides, back disabled at the start; press next → the row slides, back enables, next disables at the end; the page never scrolls sideways → AC-13
- [x] Home at 1280 and 1920 when every circle fits → one centred row, no arrows; hover a circle → yellow ring → AC-13, AC-19
- [x] At 1280 → the category bar opens with a yellow `كل الأقسام` link (grid icon, divider) to `/c`; hover a category → a yellow bar grows under it and the name turns yellow → AC-5
- [x] At 1280 → hover `حسابي` and the cart → they turn yellow; the search box gets a yellow edge on hover and focus → AC-19
- [ ] Turn on reduced motion → the chandelier is still, and hovers change at once (no fade, no zoom) → AC-13, AC-19
- [x] At 390 → the footer, header, and circles carousel look as before (no new columns, no copyright line, no arrows row) → AC-1

## Value sourcing
- [ ] Category bar names, slugs, order: reorder or hide a main in `/admin/categories` → the bar follows the menu sheet's list exactly → AC-5
- [ ] Current category: open a sub (`/c/<main>/<sub>`) and an Arabic slug main → the parent main is marked; a product page marks none → AC-5
- [x] `المزيد`, `كل الأقسام`, nav label: read from `Shell.more`, `Shell.allCategories`, `Shell.menuCategories` → AC-5
- [ ] Header account link: same label and target as the bottom bar's `حسابي` tab (`routes.accountOrders`) → AC-4
- [ ] Header cart count: add two different products → both cart links (only one visible at a time) say 2 → AC-4
- [x] Widths and breakpoints: resize across 767/768 and 1023/1024 → layout switches exactly there; `sm:`/`xl:` classes produce no CSS → AC-2
- [ ] Filter column choices, applied filters, scope: the column shows the same sizes, colours, and price placeholders as the filters screen for the same list, and opens on what the address applies → AC-10
- [x] `تطبيق` label from `Filters.applyPrice` → AC-10
- [ ] Home side card words: the hero's `Home` keys; `تسوّق الآن` goes to the circles, or to the featured products when there are no circles, and hides with neither; WhatsApp opens the general message → AC-13

## Commands
- [x] `pnpm exec vitest run src/app/tailwind-lock.test.ts src/design-rules.test.ts src/components/page-frame.test.ts src/features/shell/nav.test.ts src/features/catalog/filters-form.test.ts` → all pass → AC-2, AC-3, AC-5, AC-10
- [x] `pnpm exec playwright test e2e/shell.spec.ts e2e/storefront-layout.spec.ts --project=phone --project=tablet --project=desktop` → all pass → AC-1, AC-3 to AC-22
- [ ] `pnpm exec playwright test --project=phone` → passes with no phone assertion changed → AC-1
- [x] `pnpm exec playwright test e2e/homepage.spec.ts --project=homepage --no-deps` → passes, including the banner Home at 820 and 1280 → AC-13

## Acceptance-criteria coverage
- AC-1 phone steps, full phone run · AC-2 breakpoint step, lock test · AC-3 shell width steps · AC-4 header steps · AC-5 category bar and overflow steps · AC-6 bottom bar step · AC-7 float step · AC-8 footer step · AC-9 category, search, `/c`, and Home grid steps · AC-10 filter column steps · AC-11 crossing lg steps (filters, menu, add to draft) · AC-12 product page steps · AC-13 Home steps · AC-14 cart and checkout steps · AC-15 order page and list steps · AC-16 quick order steps · AC-17 narrow page steps (with the unknown address 404 steps) · AC-18 add to draft dialog steps · AC-19 hover steps · AC-20 card, gallery, and banner sizes steps · AC-21, AC-22 partly (the pages converted so far)
- Not yet built: AC-23, and the rest of AC-21, AC-22 (the finish)
