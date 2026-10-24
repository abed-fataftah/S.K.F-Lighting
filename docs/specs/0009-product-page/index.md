# 0009. Product page

**Date**: 2026-10-22
**Status**: Proposed

## Summary

This spec turns the thin slice 1 product page at `/p/<slug>` into the full page from the design: a swipeable photo gallery with an optional video and a full screen view, size and colour pickers that never let a customer land on a pair that cannot be bought, the price of the chosen pair, add to cart with a quantity, WhatsApp with the chosen size and colour, and a share button. The chosen pair is written into the page address as `?v=<variant id>`, so a shared or WhatsApp link opens the same choice. No new tables or columns are needed; the page reads what spec 0006 already stores, renders on the server per request (so stock is always current), and adds small client parts only for the gallery, the pickers, and the buttons.

## Requirements

**User stories**:

- As a customer on a phone, I want to swipe through a product's photos, open one full screen, and watch its video, so I can judge a chandelier before I buy.
- As a customer, I want to choose a size and colour and see that pair's price at once, so I know exactly what I am paying.
- As a customer, I want sold out sizes and colours to be clearly marked and impossible to add, so I never order something the shop cannot supply.
- As a customer, I want to add my choice to the cart or send it on WhatsApp, and share the page with the same choice, so I can buy or ask in the way that suits me.
- As the owner, I want WhatsApp questions to name the exact size and colour, so I can answer without asking back.

All reads live in `src/features/catalog/server/` and import `server-only`. Every number and price on screen goes through `src/lib/format.ts` and `src/lib/money.ts`; every link through `routes` in `src/lib/routes.ts`; every string through `ar.json` (namespace `Catalog`, new keys for the gallery, share, and full screen view). Styling uses only the tokens in `src/app/tokens.css`. Design source: [pages/product.md](../../design/pages/product.md) and its board (Product mobile, Product غير متوفر, Product جارٍ التحميل), with the shared shell from [handoff.md](../../design/handoff.md) section 6 and the WhatsApp templates W3 and W4 from handoff.md.

**Acceptance criteria**:

- **AC-1**: The read. `/p/<slug>` (the slug percent decoded as today) shows a product only when it is `active` in a shown category (the spec 0008 `listedProduct` rule); otherwise it returns the not found page. The read returns the product (name, code, description, specs), its category and that category's main for the breadcrumb, its live variants (`archived_at is null`) with size label, `size_sort`, `sort`, colour (id, name, hex), price, and whether each is sellable (`isSellable` from `sellable.ts`, the product `is_available` included), and its media ordered by `sort, id`. Archived variants never reach the page. A variant with `is_available = false` is returned, marked not sellable.
- **AC-2**: Option groups. The options card shows "الحجم" when any live variant has a size, with one chip per distinct size (two sizes are the same when their `size_label` is exactly equal) ordered by the lowest `size_sort` among its variants, ties by label; and "اللون" when any live variant has a colour, with one chip per distinct `colour_id` ordered by the lowest `sort` among its variants (the editor's colour order), ties by colour name, each chip an 18 px dot from the colour's `hex` plus its name. A variant with no size (or no colour) on a product whose other variants have one belongs to no chip in that group; it is never selectable, and its pair counts as not sellable. A group with a single value still shows its one chip, selected. A product with no sizes and no colours shows neither group. Each group is a single select `ToggleGroup` with `role="group"` and `aria-labelledby` its heading; pressing the already selected chip does nothing (the value never becomes empty). "الكمية" with the product stepper (1 to 99) sits under the groups.
- **AC-3**: Follow the size. A size chip is enabled when at least one sellable variant has that size. With a size chosen, a colour chip is enabled only when the variant for that size and colour is sellable (a pair with no variant counts as not sellable). For a product with colours only, a colour chip is enabled when its variant is sellable. A disabled chip is `disabled`, struck through, and shows "· غير متوفر" as visible text that is part of its accessible name. Choosing a size keeps the current colour when that pair is sellable, otherwise it moves to the first enabled colour for the new size in colour order. The selection is always one sellable variant, or none when the product is out of stock (AC-7). The client never recomputes `pickVariantToAdd`; the server's `selectedId` and `mutedPrice` are the only starting points.
- **AC-4**: First selection. The server chooses the first selection, so the first paint already shows the right chips and price. `searchParams.v` is read as its first value when repeated and parsed with `z.uuid()`; anything else is null. When it names a sellable live variant **of this product**, that variant is selected. Otherwise (no `v`, not a uuid, archived, not sellable, or another product's variant) the selection is `pickVariantToAdd` (the default variant if sellable, else the first sellable by `sort`), with no error and no redirect.
- **AC-5**: Title block and price. Under the gallery: the `h1` name, a 44×44 share button at the end of the `h1` row (AC-13), then `الكود: <code>` (`dir="ltr"`) and the stock word ("متوفر" green when the product has a sellable variant, else "غير متوفر" muted). The price is the selected variant's price through `formatPrice` (`data-testid="product-price"`), followed by `· للحجم <size>` in muted small text when the selected variant has a size. Changing a size or a colour updates the price and the note at once, in the browser, with no server request. The price line is an `aria-live="polite"` region.
- **AC-6**: The address follows the choice. For a product with sizes or colours, every selection change the visitor makes (in the chip handler, never on mount and never during render) and every selection move after a refresh (AC-8) calls `window.history.replaceState(null, "", routes.product(slug, { variant: id }))` (`/p/<slug>?v=<id>`), which Next 16 keeps in step with its router, so a refresh or a copied address keeps the choice and the back button still leaves the page in one step. The page as first opened keeps its address as it came. A product with no options never adds `?v`. The canonical tag is always the bare `/p/<slug>` (AC-15).
- **AC-7**: Out of stock. When no live variant is sellable (including when the product's own `is_available` is false), every chip is disabled and none is selected, the stepper is not shown, the stock word is muted "غير متوفر", the gallery strip frame (so every slide, not the full screen view) is at 45% opacity with the black "غير متوفر" label at the frame's inline start top corner, the price shows muted with no `للحجم` note (the default live variant's price, else the first live variant's by `sort`; no live variant, no price), "أضف للسلة" is a disabled button labelled "غير متوفر", and both WhatsApp buttons read "اسأل عن توفره عبر واتساب" and open W4 with the name, code, and the bare product link.
- **AC-8**: Add to cart. "أضف للسلة" sends `addToCart(selectedVariantId, quantity)` (the existing action, unchanged). The selection provider owns the quantity: it stays when the size or colour changes and across a refresh, and goes back to 1 only when the product becomes out of stock. Success shows the existing added state (ink button, "تمت الإضافة إلى السلة" for 2 seconds) and the "view cart" link. `cart_full` and `invalid` show the existing messages. `not_sellable` (the pair sold out after the page loaded) shows the existing "not available" message and calls `router.refresh()`. When the refreshed data arrives, `reconcileSelection(new options, current id, new selectedId)` runs in an effect keyed on the server data: the visitor's current choice is kept when it is still sellable, otherwise the refreshed `selectedId` is taken and the address updated (AC-6). The added state and any problem message clear whenever the selection changes.
- **AC-9**: WhatsApp. Both green buttons (under add to cart, and in the help card) open W3 built from the current selection: name, code, the selected size and colour names (whichever exist, space separated, empty for a product with no options), and the absolute link `NEXT_PUBLIC_SITE_URL + routes.product(slug, { variant })` (bare for a product with no options). The text changes as the selection changes. Out of stock uses W4 (AC-7).
- **AC-10**: Gallery. The gallery items are the photos in `sort, id` order, then the video when there is one. The main area is a horizontal CSS scroll snap strip, 300 px high (`--h-gallery`, the board), one item per view, swipe works natively, correct in RTL, on the dark product background, each photo shown whole (`object-fit: contain`) through `next/image` and the existing Supabase loader with `sizes="(min-width: 480px) 448px, 100vw"`; the first photo is the page's largest image and loads eagerly with high fetch priority (the Next 16 `next/image` prop for it, per `node_modules/next/dist/docs/`), the rest lazily. With more than one item: 44 px round arrows "الصورة السابقة" and "الصورة التالية" move one item and loop (after the last comes the first, and before the first the last), a counter `N / M` (through `formatNumber`, inside `Ltr`) at the inline end bottom corner, and a row of 56×56 thumbnail buttons below (photos at loader width 128; the video's thumbnail is the first photo, or the placeholder, with a play icon), the selected one with the 2 px yellow border, each with `aria-label` ("صورة N", the video's "فيديو المنتج") and `aria-pressed`; the row scrolls sideways when it does not fit. One `IntersectionObserver` on the strip (threshold 0.6) sets the item in view, which drives the counter, the selected thumbnail, and the video pause. Moving uses `scrollIntoView({ block: "nearest", inline: "center" })` on the target item (no RTL scroll offset math, no page scroll), instant when the visitor prefers reduced motion. With one item: no arrows, counter, or thumbnails. With no photos and no video: one `ImagePlaceholder`. Each photo's alt is its `alt` column, else "<name>، صورة N".
- **AC-11**: Video. The video item is a native `<video controls playsinline preload="none">` with one `<source type="video/mp4">` (the only video type uploads allow, spec 0006), whose poster is the first photo (through the image loader at width 828) or the placeholder look when there is no photo, with its accessible name "فيديو المنتج". Its source is the public Storage object URL of its key. Nothing of the video downloads until the visitor plays it. When the item in view (AC-10) is no longer the video, the video pauses. The video is not part of the full screen view.
- **AC-12**: Full screen. Each photo in the main strip is a button ("تكبير الصورة N"). Pressing it opens a full screen Base UI dialog (visually hidden title "صور <name>") on a dark background with the photos only, instantly scrolled to the pressed one before it shows, in the same scroll snap strip at full width (`sizes="100vw"`, so the 2,000 px source is used on large screens) with `touch-action: pan-x pinch-zoom`, with the arrows (looping over the photos only), the counter, and a 44×44 "إغلاق" ✕ button. The browser's own pinch zoom works (the root viewport sets only `viewportFit`, so scaling is not blocked; keep it that way). Esc and ✕ close it; focus is trapped while open and returns to the photo button it opened from; on close, the main strip shows the photo last seen in the dialog.
- **AC-13**: Share. The share button (outline icon, accessible name "مشاركة المنتج") calls `navigator.share({ title: name, url })` where `url` is the same absolute link as W3 (with `?v` for a product with options). An `AbortError` (the visitor cancelled) does nothing. When `navigator.share` is missing, or rejects with any other error, it copies `url` with `navigator.clipboard.writeText` and shows "تم نسخ الرابط" for 2 seconds; when `navigator.clipboard` is missing or the copy rejects, it shows "تعذر نسخ الرابط" for 2 seconds. Both texts appear in an `aria-live="polite"` region that is always rendered.
- **AC-14**: Breadcrumb, description, specs, help. The breadcrumb reads الرئيسية, the main category, the sub category when the product sits in one, then the product name (current page), each category a link built from `routes.category` and `routes.subcategory`. Then, as today: the "الوصف" card (`whitespace-pre-line`) when there is a description, the "المواصفات" card with the spec rows in stored order (dimensions are the `الأبعاد` row, spec 0002), and the help card "هل تحتاج مساعدة في الاختيار؟" with its WhatsApp button (AC-9). Wide screens show the same single column centred at `--page-max`.
- **AC-15**: Search engines. Title `<name> | S.K.F للإنارة` (as today). Description: the product description with whitespace collapsed, cut to its first 155 characters (by code point), else `Metadata.description` from `ar.json`. A canonical to the absolute bare `/p/<slug>`, also when the address has `?v`. JSON-LD (serialized with `<` escaped, one shared helper with the category pages): a `Product` with `name`, `sku` (the code), `description` (the same 155 character text, left out when the product has none), `image` (the absolute public URLs of up to 8 photos, left out when none), `url` (canonical), and `offers`: one `Offer` (`url`, `price`, `priceCurrency`, `availability`) when all counted variants share a price, else an `AggregateOffer` (`lowPrice`, `highPrice`, `offerCount`, `priceCurrency`, `availability`); `priceCurrency: "ILS"`, every price a string from `toShekelsInput` (`"19.90"`, `"1250"`), and `availability` `https://schema.org/InStock` or `https://schema.org/OutOfStock`. Counted variants are the sellable ones when in stock, else the live ones; no live variant, no `offers`. Plus a `BreadcrumbList` matching AC-14 with absolute URLs. No share image (feature 28).
- **AC-16**: Error and not found. No route level `loading.tsx` for `/p/[slug]` (a loading boundary would flush a 200 before `notFound()` runs). The page and `generateMetadata` share one read through React `cache`, keyed on the decoded slug only (the read returns all live variants; `?v` is applied in a pure step after it), and the page awaits it before rendering anything, so a product that is not listed gives the not found page with a real 404 status. A failed read falls to the existing storefront `error.tsx` (error card with retry and WhatsApp). The board 3 skeleton is not built in this feature (see Follow-up).
- **AC-17**: Fresh on every load. The page renders per request with no data cache, so a price, stock, or hide change in the dashboard shows on the next load. Logs from this page never include customer data (there is none) and say what failed, never values.
- **AC-18**: Accessibility. Everything is reachable and usable by keyboard with visible focus; the gallery arrows, thumbnails, photo buttons, share, ✕, chips, and stepper are at least 44×44; axe passes on an in stock product, an out of stock product, and the open full screen view.
- **AC-19**: Tests. Vitest beside the source for every pure rule: the option groups and their order, chip states, choosing a size and a colour, the first selection with and without `?v`, reconciling after a refresh, the price and size note, the W3 options text and link, the gallery items and alt text, the meta description cut, both JSON-LD offer shapes and availability, and `routes.product` with a variant. A database test for the read (archived variants left out, an unavailable variant marked not sellable, media order with the video last, a hidden category gives null). A Playwright flow on a phone sized RTL screen: a product with 2 sizes at different prices × 2 colours, one pair unticked, and 2 photos opens on its default; a size change updates the price and the address; the unticked pair's colour is disabled for that size; a reload keeps the choice; 2 units are added and the cart line shows that size, colour, and quantity; the arrows move the counter; the full screen view opens, Esc closes it, and focus returns; share copies the link (clipboard permission granted, `navigator.share` absent); an out of stock product shows the disabled button and the W4 label; an unknown slug answers with status 404; axe passes per AC-18. The slice 1 first order flow still passes.

## Decision

**Chosen option**: Option 1: Fix in place: keep the server rendered page and add one client selection island

The page stays a server component that reads everything per request, picks the first selection on the server (honouring `?v`), and passes a plain view to small client parts that share one selection context: the gallery, the pickers, the price, add to cart, the WhatsApp buttons, and share. All choosing rules are pure functions.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for the server and client split, the eager first image, and keeping client JS small · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) for the selection provider with small client leaves inside server sections · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for `ToggleGroup` chips and the full screen `Dialog` on Base UI · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the read · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for AC-19

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Data model sketch

No migration. This feature reads the spec 0002 and spec 0006 tables as they are.

| Table | Columns used | Notes |
|---|---|---|
| `products` | `id`, `slug`, `name`, `code`, `description`, `specs`, `status`, `is_available`, `category_id` | `listedProduct` filter (active, shown category) |
| `categories` (and its parent) | `name`, `slug`, `parent_id`, `is_visible` | breadcrumb and the shown rule |
| `product_variants` | `id`, `size_label`, `size_sort`, `colour_id`, `price`, `is_available`, `is_default`, `sort`, `archived_at` | only `archived_at is null` rows are read; live rows form the full sizes × colours grid (spec 0006 AC-16), the pure code still treats a missing pair as not sellable |
| `colours` | `id`, `name`, `hex` | left joined from variants |
| `product_media` | `kind`, `storage_key`, `alt`, `width`, `height`, `sort`, `id` | ordered `sort, id`; at most 8 images and 1 video, the video stored after the photos (spec 0006 AC-8); `variant_id` stays unused |

Colour tagged photos stay out (see Follow-up).

### Code layout

| Path | Kind | What |
|---|---|---|
| `src/features/catalog/product-view.ts` | pure | `buildProductOptions`, `sizeChips`, `colourChips(options, size)`, `firstSelection(options, product, requestedId)`, `chooseSize`, `chooseColour`, `reconcileSelection`, `selectionText` (W3 size and colour part), `galleryItems(media, name)` |
| `src/features/catalog/product-seo.ts` | pure | `metaDescription(text, fallback)`, `productJsonLd(...)` |
| `src/features/catalog/seo.ts` | pure | `breadcrumbJsonLd(items)` and `serializeJsonLd` (the `<` escape), moved out of `category-page.tsx` and used by both pages |
| `src/lib/media-url.ts` | pure | `mediaObjectUrl(base, key)`: `${base}/storage/v1/object/public/product-media/${key}` for the video source and JSON-LD images |
| `src/lib/routes.ts` | pure | `product(slug, opts?: { variant?: string })` adds `?v=<id>` |
| `src/features/catalog/server/queries.ts` | server | `readProductPage(db, slug, requestedVariantId)` replaces `readProductBySlug`; `getProductPage` |
| `src/features/catalog/components/product-selection.tsx` | client | `ProductSelectionProvider`: a `useReducer` over `{ selectedId, quantity, added, problem }` seeded from the server data, the `replaceState` call in the choose handlers, and the reconcile effect keyed on the server data (AC-8); `useProductSelection` |
| `src/features/catalog/components/product-options.tsx` | client | size and colour `ToggleGroup`s, stepper, add to cart (extends `AddToCart` to take the variant from context) |
| `src/features/catalog/components/product-price.tsx`, `product-whatsapp.tsx`, `share-button.tsx` | client | small leaves reading the selection |
| `src/features/catalog/components/product-gallery.tsx`, `full-screen-gallery.tsx` | client | AC-10 to AC-12 |
| `src/app/[locale]/p/[slug]/page.tsx` | server | composition, metadata, JSON-LD (no `loading.tsx`, AC-16) |

### API surface

| Name | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getProductPage` | query (server, React `cache` by slug) | `slug: string` (decoded) | `ProductPageData` with `selectedId` from `pickVariantToAdd`, or `null` | public | `null` → `notFound()`; a thrown read → `error.tsx` |
| `applyRequestedVariant` | pure | `ProductPageData`, `requestedVariantId: string \| null` (first `searchParams.v`, `z.uuid()`, invalid becomes null) | the same data with `selectedId` set per AC-4 | | |
| `ProductPageData` | type | | `{ id, slug, name, code, description, specs, breadcrumb: { main: { name, slug }, sub: { name, slug } \| null }, options: { sizes: { label }[], colours: { id, name, hex }[], variants: { id, sizeLabel, colourId, price, sellable }[] }, selectedId: string \| null, mutedPrice: number \| null, inStock: boolean, photos: { key, width, height, alt }[], video: { key } \| null }` | | |
| `addToCart` (existing) | Server Action | `variantId`, `quantity` 1 to 99 | line count | public | `not_sellable`, `cart_full`, `invalid` |

No new Server Actions. The client parts receive `ProductPageData` minus nothing secret (it holds no secret).

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| read | listed or not | `listedProduct` SQL in `storefront-sql.ts` (spec 0008) |
| read | sellable per variant | `isSellable(product with categoryShown: true, variant)`; the category is already shown by the filter |
| first selection | selected id | `?v` when it names a sellable live variant of this product, else `pickVariantToAdd` (spec 0004) |
| chips | size order, colour order | `size_sort`; lowest variant `sort` per colour, ties by colour name |
| chips | colour dot | `colours.hex` (data, set inline as a style value, not a token) |
| price | shown price | the selected variant's `price`; out of stock: `mutedPrice` = default live variant's price, else first live by `sort` |
| price | `للحجم` note | the selected variant's `size_label` |
| stock word | in stock | `inStock` = any variant sellable |
| address, W3, share | absolute link | `NEXT_PUBLIC_SITE_URL` (`parsePublicEnv`, which already refuses a trailing slash) + `routes.product(slug, { variant })`; bare when the product has no options or for W4 |
| W3 | size and colour text | `selectionText(selected variant)`: `size_label` and the colour `name`, space separated |
| W3, W4 | name and code | product columns; templates from handoff.md |
| gallery | photo URL | `storage_key` through `src/image-loader.ts` |
| gallery | alt | `product_media.alt`, else `Catalog.photoAlt` "{name}، صورة {n}" with `n` through `formatNumber` |
| gallery | counter | index in view and item count, through `formatNumber` |
| video | source, poster | `mediaObjectUrl(NEXT_PUBLIC_SUPABASE_URL, key)`; poster = first photo through the image loader at width 828 |
| metadata | description | `metaDescription(product.description, Metadata.description)` |
| metadata | canonical | `NEXT_PUBLIC_SITE_URL + routes.product(slug)` |
| JSON-LD | image | `mediaObjectUrl` of up to 8 photos |
| JSON-LD | prices | `toShekelsInput(agorot)` from `money.ts` (gives `19.90`, `1250`) over the counted variants (AC-15) |
| JSON-LD | breadcrumb URLs | `NEXT_PUBLIC_SITE_URL` + `routes.home`, `routes.category`, `routes.subcategory`, `routes.product` |
| stale add | new selection | `reconcileSelection(new options, current id, new selectedId)`: keep the current id if still sellable, else the refreshed `selectedId` |
| stepper | quantity | the provider's reducer: kept across choices and refreshes, reset to 1 when out of stock |

### Key invariants

- The add button only ever sends the selected variant id, and the selected id is always a sellable live variant of this product, or null (then the button is disabled). The server action still checks sellable on its own; the page is never trusted.
- The shown price is always the selected variant's price, never a size level guess.
- `?v` is only ever matched against this product's own live variants, never looked up by itself.
- Selection, price, and chip changes never call the server; only add to cart and the refresh after `not_sellable` do.
- One sellable rule: the page uses `isSellable` and `pickVariantToAdd`; no new copy of the rule.

### Security model

A public, read only page. It shows only listed products (active, in a shown category) and no customer data. `?v` is parsed as a uuid and matched in memory against the product's variants, so it cannot reveal other products. JSON-LD is serialized with `<` escaped so product text cannot close the script tag. The one write is the existing `addToCart` with its own Zod validation and sellable check. No auth, no rate limit needed beyond what `addToCart` already has.

### Configuration required

None new. Uses `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, and `NEXT_PUBLIC_SUPABASE_URL` (all parsed already).

### Critical test scenarios

- Happy path: open the 2 × 2 product, change size, see the price and address change, reload, add 2, see the cart line, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-8**
- Pair rule: with the unticked pair's size chosen, its colour is disabled with "· غير متوفر"; choosing that size from the other colour moves the colour, verifies **AC-3**
- Bad `?v`: another product's variant id, an archived one, and `?v=abc` each open the default, verifies **AC-4**
- Stale add: mark the selected pair unavailable in the database after load, press add, see the message and the selection move, verifies **AC-8**
- Out of stock: product `is_available = false`, all chips disabled, W4, verifies **AC-7**
- Gallery and full screen: arrows loop, the counter follows, Esc returns focus, the video has no network request before play, verifies **AC-10**, **AC-11**, **AC-12**
- Hidden: a product in a hidden category gives 404 (spec 0008 still holds), verifies **AC-1**, **AC-16**
- Search engines: canonical without `?v`, `AggregateOffer` for differing prices and `Offer` for one price, verifies **AC-15**

## Build plan

Tracer Bullet: the first task carries one real choice from the read through the pickers to the cart line, on the existing page and its placeholder image; the later tasks thicken the gallery, the extras, and the search engine layer.

1. **Thin thread: choose a pair and buy it.** `product-view.ts` with Vitest tables (groups, order, chip states, choose size and colour, first selection, `selectionText`); `routes.product` with a variant; `readProductPage` with its database test; the selection provider, the size and colour chips, the live price and note, `AddToCart` taking the selected variant, `replaceState` to `?v`, and W3 with the size and colour on both WhatsApp buttons. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-8** (success path), **AC-9**
2. **States.** Out of stock (chips, price, button, W4, gallery label), the stale add refresh with `reconcileSelection`, the three level breadcrumb, the shared cached read with the real 404 and no `loading.tsx`. Satisfies **AC-7**, **AC-8**, **AC-14**, **AC-16**, **AC-17**
3. **Gallery and video.** `galleryItems` with tests, `media-url.ts`, the scroll snap strip, loop arrows, counter, thumbnails, alt text, the eager first photo, the `preload="none"` video with poster and pause on leave. Satisfies **AC-10**, **AC-11**
4. **Full screen and share.** The full screen dialog with focus return and the strip sync on close; the share button with the clipboard fallback. Satisfies **AC-12**, **AC-13**
5. **Search engines.** Move the breadcrumb JSON-LD and serializer to `seo.ts` (category pages switch to it), `product-seo.ts` with tests, metadata description and canonical, the `Product` and `BreadcrumbList` JSON-LD. Satisfies **AC-15**
6. **Finish.** The full phone flow, axe on the three states, keyboard and target size pass, the slice 1 first order flow green. Satisfies **AC-18**, **AC-19**

## Consequences

**Positive**:

- Customers can buy any size and colour the owner stocks, at that pair's price, and cannot add a pair that is sold out.
- Shared and WhatsApp links carry the exact choice, so the owner sees what the customer means.
- No migration and no new action: the risk sits in UI and pure functions, which are easy to test.
- Search engines get a proper `Product` with offers, and the breadcrumb helper becomes shared.

**Negative / tradeoffs**:

- Every product page view is a fresh server render and database read (no cache). Fine at this shop's traffic; revisit only with measured load.
- Photos cannot follow the chosen colour yet; a gold chandelier's photos show when black is chosen.
- `replaceState` writes `?v` into history entries the visitor never asked for; links copied from the address bar carry an id that stops matching once that pair is archived (it then falls back to the default, by design).
- The full screen view relies on the browser's pinch zoom, which zooms the whole screen rather than one photo; there is no double tap zoom, and panning a zoomed photo can fight the swipe strip.
- With no `loading.tsx`, a tap on a product card keeps the old page on screen until the product page is ready, with no skeleton; that is the price of a real 404.
- Disabled chips leave the tab order, so a screen reader user meets "غير متوفر" only while browsing the group, not while tabbing.
- Wide screens get the narrow phone column until the desktop layout (O-1) is designed.

**Neutral**:

- `readProductBySlug` is replaced by `readProductPage`; `storefront.db.test.ts` moves to the new name.
- `AddToCart` changes from a `variantId` prop to the selection context; the card button (`card-add-to-cart.tsx`) is untouched.
- Breadcrumb JSON-LD moves out of `category-page.tsx` into `seo.ts`.

## Follow-up

- [ ] Colour tagged photos (a nullable `colour_id` on `product_media`, a colour picker on each photo tile, and the import's answer), so choosing a colour jumps to its photos. Carried over from spec 0006.
- [ ] Desktop and tablet layout for the product page (design open item O-1).
- [ ] The board 3 loading skeleton, if a way is found to show it without losing the real 404 (for example a Suspense boundary inside the page, below the awaited read, for slower parts).
- [ ] Share image (`og:image` from the first photo) with feature 28, together with the site map.
- [ ] Breadcrumb "back to the category with its filters" once feature 11 adds filters.
- [ ] "Add to draft" for electricians on this page (accounts, scope feature on drafts).
