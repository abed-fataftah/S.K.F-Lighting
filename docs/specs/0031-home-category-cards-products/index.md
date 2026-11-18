# 0031. Home category cards with their products

**Date**: 2026-11-18
**Status**: Proposed

## Summary

Under the hero coverflow, Home's category circles become a row of 3D photo cards that work like tabs: pressing a card shows that category's first eight products in a grid right under it, with a link to the full category page. The first category in the owner's order is selected when the page opens and its products arrive with the page; the others are fetched on press from a small public endpoint and kept in the page for the rest of the visit. Nothing new is stored: the dashboard already decides which categories show on Home, their photo, line, and order.

## Rationale

Reasoning, the options weighed, and the smaller calls settled while writing: see [rationale.md](rationale.md).

## Requirements

Replaces spec 0011 AC-4 (the category circles and their carousel) and spec 0029 AC-13 (c) (the desktop circle row). The categories section keeps its place, its `id="categories"`, and its heading, so spec 0030's "تسوّق الآن" jump does not change. Everything else in those specs stands. All new strings go in the `Home` namespace of `src/i18n/messages/ar.json`; every price through `formatPrice`; every link through `routes`; style only with the tokens; no shadow, blur, or gradient.

**User stories**:
- As a customer on a phone, I want to tap a category and see its products right there, so that I find what I came for without leaving Home.
- As a shopper on a laptop, I want the categories to look like a real shelf of cards and respond when I point at them, so that the shop feels alive.
- As the owner, I want the categories I ticked for Home, with the photo and line I gave them, to be the cards, so that what I set up in the dashboard is what shoppers see.

**Acceptance criteria**:

- **AC-1**: Place and headings. The section sits where the circles were (under the hero, and under the banners when any is on), keeps `id="categories"` and the `h2` "تسوّق حسب القسم" with `sectionHeadingId("categories")` and `tabIndex={-1}`, and loses the subline that listed six names. Inside, top to bottom: the cards row (AC-2 to AC-5), then the grid heading row, then the grid (AC-6). The grid heading row holds an `h3` with the selected category's name at the start and the link "عرض الكل" (`Home.viewAll`, to `routes.category(slug)`, 44px tall) at the end, exactly as the old featured section's heading row was laid out. With no category ticked for Home the whole section is absent, as today.
- **AC-2**: The cards. One card per category of the same list the circles used: the mains the menu lists (shown, with a listed product), ticked for Home, in category order (`buildHomeCircles`, renamed `buildHomeCategories`, its type `HomeCategory`). A card is portrait 4:5, `--category-card` wide (AC-4), `rounded-card`, `overflow-hidden`: the category photo (`imageKey` through `next/image` with the Supabase loader, `fill`, `object-cover`, empty `alt`, `sizes` `(min-width: 1024px) 200px, (min-width: 768px) 180px, 140px`, not draggable), else `ImagePlaceholder` with the tone cycling by index; over the bottom of the photo a black band (`bg-ink`, no gradient) holding the name (`type-lead text-white`, at most two lines, the full name in the accessible name) and the line under it (`type-caption text-on-dark-muted`, one line, clipped): the owner's line, else the first three menu sub names as `joinSubNames` builds them today, else nothing. The category count is not shown.
- **AC-3**: Tabs. The row is a `div` with `role="tablist"`, `aria-label` "أقسام المتجر" (`Home.categoriesLabel`), `data-testid="home-category-tabs"`. Each card is a `button` with `role="tab"`, `aria-selected` true on the selected one, `aria-controls` pointing at the grid panel's id, `id` `category-tab-<slug>`, and a roving `tabIndex` (0 on the selected card, −1 on the rest), so Tab enters the row once. With focus on a card: the left arrow key moves selection to the card on the physical left and the right arrow key to the card on the physical right (the same physical rule as spec 0030's `stepForKey`), Home and End go to the first and last card, selection follows focus (automatic activation), and the keys wrap at the ends. A press, a tap, or a key selects at once: the selected card, the heading, and the panel's `aria-labelledby` change immediately (AC-7 decides what the grid shows meanwhile), but a fetch for an uncached category chosen by a key waits 150ms after the last key, so holding an arrow key never fires one request per card. The grid area is a `section` with `role="tabpanel"`, `id="category-panel"`, `aria-labelledby` the selected tab's id, `data-testid="home-category-panel"`, `tabIndex={0}` (it keeps it while showing the skeleton or the notice), and `aria-busy="true"` while loading. The hidden `h2` jump target and the section heading are outside the tablist.
- **AC-4**: Layout. The card width is the token `--category-card` in `tokens.css`: 140px below `md`, 180px from `md`, 200px from `lg`, set per breakpoint like `--page-pad`. Below `md` the row scrolls sideways inside the column with `snap-x snap-mandatory`, gap 12px, `--page-pad` on both ends, scrollbar hidden, `touch-pan-x`, the page never scrolling sideways; on selection the selected card scrolls into view (`scrollIntoView({ inline: "nearest", block: "nearest" })`, smooth unless reduced motion). From `md` the cards wrap into rows (`flex-wrap`, gap 16px, centred inside the content box) with no scrolling. At 390 about two and a half cards show; at 1024 five fit a row; at 1280 six. The row carries vertical padding of 8% of the card height (a `calc` on `--category-card`), so the selected card's scale, its yellow edge, and the focus outline are never clipped by the scrolling box; every unselected card carries a transparent 2px border, so selecting one never shifts the layout.
- **AC-5**: The 3D treatment. Each card's transform starts with `perspective(var(--coverflow-depth))` (its own vanishing point, so a scrolled or wrapped row never skews). At rest, the cards in the selected card's own visual row turn to face it with `rotateY`: a card on its physical left turns by `--category-turn` so its right edge comes forward, a card on its physical right so its left edge comes forward (the same sense spec 0030 gives its side cards); cards in other rows rest flat. The side is computed by a pure `categoryTurn(index, selected, perRow, dir)` from list order, the cards per row (1 below `md`, where the whole row is one visual row; from `md` the number that fit, measured once per resize by a `ResizeObserver`, with the server rendering the below `md` set and the first category), and the direction (`[--cf-dir:1] rtl:[--cf-dir:-1]` as the coverflow does), written as custom properties. Unselected cards sit at scale 1 with a black tint overlay at `--category-tint` (0.25) that moves with the card; the selected card has angle 0, scale `--category-scale` (1.06), no tint, and a 2px `border-yellow` edge (the selected gallery thumbnail rule). Turn, scale, and tilt are written through `transform-[...]` reading custom properties and the tint through `opacity-(...)`, as the coverflow does; no bracketed pixel class. On a device that can hover (`@media (hover: hover)`), moving a mouse or pen over a card (`pointermove` with `pointerType` `mouse` or `pen`; touch events are ignored, so a hybrid touch laptop never tilts on a finger) tilts it toward the pointer by up to `--category-tilt` on each axis, the edge under the pointer coming forward, a physical direction not flipped for RTL; the two offsets are written as custom properties with `style.setProperty` inside `requestAnimationFrame`, never through React state, and cleared on leave; a hovered unselected card also drops its tint. Depth comes from transform, scale, opacity, and the tint only: no shadow, no blur, no gradient. Turn, scale, and tint changes on selection transition over `--dur-carousel-move` with `--ease-carousel`; the hover tilt over `--dur-hover`. Under `prefers-reduced-motion: reduce` there is no tilt and no transition (the cards carry `motion-reduce:transition-none`, since `--dur-carousel-move` is not zeroed by the reduced motion block): cards take their rest state at once. The server renders the rest state for the first category, so nothing jumps on hydrate. The build may tune the angles by up to 25% after seeing them.
- **AC-6**: The grid. A `ul` with `data-testid="home-category-products"`, `grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-4` (the old featured grid's classes), one `li` per product with the existing `ProductCard` (`heading="h4"`, add to cart, WhatsApp, and add to draft for electricians through the page's `canAddToDraft` read, which the page reads again). The products are the first eight of the category page's own list for that main: the main's products including its subcategories' (spec 0008's `categoryIds` of the main), listed products only (hidden and archived left out, hidden categories left out, out of stock kept), in stock first then newest, through a new `readHomeCategoryProducts(db, categoryIds)` that reuses the list SQL (`listWhere` for the category scope with no filters and `listOrder`, the order `/c/<slug>` shows unfiltered) with a limit of 8 (`HOME_LIMITS.categoryProducts`); `compareListedProducts` is the database test's oracle, not the read. The first category's eight come with the page (server rendered): `getHomeSections` reads them as a timed part named `categoryProducts` that runs after the `circles` part (it needs the tree), under its own `HOME_PART_TIMEOUT_MS`, null on failure like every part. A grid is never empty: only a main with a listed product gets a card; if a race leaves it empty (the last product hidden between the page and the press) the grid shows the single line "لا توجد منتجات في هذا القسم الآن" (`Home.categoryEmpty`) and the "عرض الكل" link stays.
- **AC-7**: Loading on press. A public route handler `GET /api/catalog/home-products?category=<slug>` (`routes.api.homeCategoryProducts(slug)`; under `/api/catalog/` so `src/proxy.ts` skips the Supabase session refresh for it as it does for the count route) answers `{ products: CardProduct[] }` for a main that is shown on Home now: the handler builds `buildHomeCategories` over the catalog tree and requires the slug in that list before it reads (one tree read per uncached press is accepted), then uses that main's `categoryIds`. The request rule: exactly the `category` param, `tidyText`, not empty, at most 120 characters; anything else is `400 { error: "bad_request" }`. `404 { error: "not_found" }` for an unknown main or one not shown on Home, `429 { error: "too_many" }` when the per IP allowance of `CATALOG_COUNT_RATE_LIMITER` is spent (the same `checkOrderRate` call and budget as `/api/catalog/count`: 60 requests a minute per IP shared by both routes, failing open when the binding is absent, warned once in `next dev`), `503 { error: "unavailable" }` on a failed or slow read (1.5 seconds, `withTimeLimit`), reported as `home_category_products_failed`. Only a 200 is cacheable, with `Cache-Control: private, max-age=60` (the visitor's browser keeps it a minute; a Worker's own response is never stored by Cloudflare's edge, so no edge caching is claimed); 400, 404, 429, and 503 are `no-store`. On the client a `Map` keyed by slug, held in component state (never module scope, which SSR requests would share), holds every answer for the component's lifetime (a client navigation away and back remounts and starts again); the page's own eight for the first category seed it as `ready`, and a null first part seeds it as `failed` so the notice of AC-8 shows at once with retry. Prefetch: a card's `pointerenter` from a mouse or pen, or its `focus`, prefetches its category once (in flight requests are shared; a cached hit sends nothing and spends none of the allowance); touch never prefetches; after the first grid paints, the two cards beside the selected one are prefetched in the background. A press on a cached category swaps the grid and heading at once; otherwise the heading changes at once and the grid shows a skeleton of eight card blocks (`Skeleton`, the card's shape, `aria-busy`) until the answer lands; an answer for a category that is no longer the selected one is stored but not shown.
- **AC-8**: Failure. When a press's fetch ends in 429, 503, a network error, or a malformed body, the grid area shows an inline notice (`Alert`, `role="alert"`): "تعذّر تحميل المنتجات" (`Home.productsFailed`) with a "إعادة المحاولة" button (`Home.retry`, 44px tall) that fetches again; the heading and "عرض الكل" stay, so the category page is always one tap away; the failure is sent with `Sentry.captureException`. A retry that succeeds shows the grid. Logs never carry the slug.
- **AC-9**: Loading skeleton. `loading.tsx` shows, where the circles blocks were, a row of three card blocks (`--category-card` wide, 4:5) and under them a heading block and a grid of four card blocks (hidden beyond two below `md`, beyond three below `lg`), replacing the circle blocks.
- **AC-10**: What goes. `CategoryCircles`, `CircleCarousel`, `LoneCircle`, `CircleShelf`, the pause button, the auto advance, `circleSubline`, `HOME_LIMITS.sublineNames`, `HOME_LIMITS.carouselFrom`, and the strings `categoryPrev`, `categoryNext`, `pauseAuto`, `playAuto`, `centredCategory`, `browse` are removed. `circleSteps` and `changesSide` stay (spec 0030's coverflow uses them; their doc comments say so). `--dur-carousel-auto` has no reader left and goes from `tokens.css`. `page.test.ts` and `shopNowTarget` take the renamed type and function. The dashboard (the Home ticks, the category photo and line in the category dialog) does not change.
- **AC-11**: Tests. Vitest beside the source for every pure rule: the first selected category, `categoryTurn` for the selected card, the cards before and after it, both directions, and the key to index mapping with wrapping; the request parsing (slug rules); the route handler with the same seams the count tests use (400, 404, 429, 503, 200 with the cache header); the client cache and prefetch rules (a pure reducer: cached, loading, failed, stale answer ignored); and a database test for `readHomeCategoryProducts` (subs included, hidden left out, in stock first, at most eight). Playwright on the `phone`, `tablet`, and `desktop` projects: the cards row shows the ticked mains with their photos and names; the first category's grid is server rendered (checked in a separate browser context with JavaScript disabled); pressing another card swaps the heading and the grid; "عرض الكل" opens `/c/<slug>`; a product card's link opens its product page; the arrow keys move the selection; a `page.route` on the route that answers 503 shows the notice and a retry that answers 200 shows the grid, and the same with 429 (the real limiter is never spent in a test); with reduced motion emulated a press changes the selected card at once; no sideways page scroll at 390, 820, and 1280; axe passes. The homepage flow keeps its circle steps as card steps (the ticked mains appear as cards, an unticked one does not, the photo and line show on the card, two and one categories still render) and drops the pause, loop, and left of checks; the `home` tests in `e2e/storefront-layout.spec.ts` drop the circle row and shelf checks in favour of the wrapped rows from `md`; `e2e/hero-coverflow.spec.ts` does not change.

## Decision

**Chosen option**: Option 2: Tab cards with a fetched grid

The circles are replaced by 3D photo cards that are tabs; the first category's products come with the page and the rest are fetched on press from a rate limited route handler and kept in the page, with prefetch on hover and focus so the swap feels immediate.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Feature design

**Data model sketch**: no change. The cards read `categories` (`show_on_home`, `image_key`, `home_subtitle`, order) through the existing catalog tree read; the products read `products`, `product_variants`, `product_media`, and `categories` through the existing list SQL. No migration.

**State** (client, in the section component, never module scope): `{ selected: slug, cache: Map<slug, Entry> }` where `Entry` is `{ kind: "ready"; products } | { kind: "loading"; promise } | { kind: "failed" }`. The server renders `selected` as the first category and seeds its entry (`ready` with the page's eight, `failed` when that part was null). A pure `categoryPanelState(entry)` decides what the panel shows (grid, skeleton, notice, or empty line).

**Components**:

| File | Change |
|---|---|
| `src/features/home/components/category-cards.tsx` | New client component: the tablist of cards, the turn (per visual row) and the tilt, the roving focus and keys with the 150ms fetch wait, the snap row and scroll into view, the prefetch and cache, the panel (heading row, grid, skeleton, notice). Takes `categories: HomeCategory[]`, `first: CardProduct[] \| null`, `whatsappNumber`, `siteUrl`, `canAddToDraft`. |
| `src/features/home/components/home-sections.tsx` | `CategoriesSection` keeps the heading and renders `CategoryCards`; the subline goes. |
| `src/features/home/components/category-circles.tsx` | Deleted (AC-10). |
| `src/features/home/home-rules.ts` | `buildHomeCircles` → `buildHomeCategories`, `HomeCircle` → `HomeCategory` (the line keeps its `homeSubtitle ?? joinSubNames` fallback); add `firstCategory`, `categoryTurn(index, selected, perRow, dir)`, `indexForKey(key, index, count, dir)`, `categoryPanelState`, `HOME_LIMITS.categoryProducts = 8`; remove `circleSubline`, `sublineNames`, `carouselFrom`. |
| `src/features/home/category-products-request.ts` | New: parses `?category=` (one param, `tidyText`, not empty, at most 120 characters). |
| `src/features/home/server/category-products.ts` | New: `readHomeCategoryProducts(db, categoryIds)` (`listWhere` and `listOrder`, limit 8) and `handleCategoryProducts(request, deps)` on the `handleCount` pattern (limiter, parse, the on Home check over the tree, time limit, the headers per status). |
| `src/app/api/catalog/home-products/route.ts` | New: the `GET` wiring with `CATALOG_COUNT_RATE_LIMITER`; under `/api/catalog/` the proxy already skips the session refresh. |
| `src/features/home/server/home.ts` | `getHomeSections` also reads the first category's eight as the `categoryProducts` part, chained after the `circles` part, null on failure, so the section still renders its cards with the notice. |
| `src/app/[locale]/(home)/page.tsx`, `loading.tsx` | Pass `first`, `siteUrl`, `canAddToDraft` to the section; the new skeleton (AC-9). |
| `src/lib/routes.ts` | `routes.api.homeCategoryProducts(slug)`. |
| `src/app/tokens.css` | `--category-card` (140px, 180px from `md`, 200px from `lg`), `--category-turn: 12deg`, `--category-tilt: 6deg`, `--category-scale: 1.06`, `--category-tint: 0.25`; removes `--dur-carousel-auto`; reuses `--coverflow-depth`, `--dur-carousel-move`, `--ease-carousel`, `--dur-hover`. |
| `src/i18n/messages/ar.json` | `Home`: `viewAll` ("عرض الكل", back), `productsFailed`, `retry`, `categoryEmpty`; remove the six circle strings (AC-10). |

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/catalog/home-products` | GET | `category` (slug of a main shown on Home) | `{ products: CardProduct[] }`, `Cache-Control: private, max-age=60` on 200 only | public, 60 a minute per IP shared with the catalog count | 400 bad request, 404 unknown or not on Home, 429 too many, 503 unavailable (1.5s limit), all `no-store` |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Cards | which categories, their order | `buildHomeCategories` over the catalog tree: `show_on_home`, menu rules of spec 0008, category `sort` |
| Card | photo, name, line | `categories.image_key` (else `ImagePlaceholder`, tone by index), `categories.name`, `categories.home_subtitle` else `joinSubNames` of the main's menu subs |
| Card | rest turn, scale, tint, edge | `categoryTurn(index, selected, perRow, dir)` with `--category-turn`, only within the selected card's visual row; `perRow` 1 below `md`, else measured by a `ResizeObserver`; selected: angle 0, `--category-scale`, `border-yellow`; others `--category-tint`; `dir` from `--cf-dir` (1, −1 in RTL) |
| Card | hover tilt | mouse or pen pointer offset from the card centre × `--category-tilt`, physical (not flipped for RTL), written by the `pointermove` handler in a frame; 0 for touch, off hover, and under reduced motion |
| Selection on load | the first category | `firstCategory(categories)`: index 0 of the list above |
| Keys | the next selected index | `indexForKey`: left → physical left (`dir` −1 in RTL means index + 1), right → physical right, Home → 0, End → last, wrapping |
| Grid heading | name, "عرض الكل" target | the selected `HomeCategory.name`; `routes.category(slug)` |
| Grid | the eight products | first category: `getHomeSections().categoryProducts` (server, the part after `circles`); others: the route's `products`, cached per slug in component state for the component's lifetime |
| Grid | the category's ids | `getCategoryHead(slug, null, 1).categoryIds` (the main and its subs), as `/c/<slug>` uses |
| Grid | product order and listing rule | `listWhere` (category scope, no filters) and `listOrder` of spec 0008, limit `HOME_LIMITS.categoryProducts` |
| Product card | name, price, stock, buttons | `CardProduct` as on every grid (spec 0008 AC-12); `canAddToDraft` from the page's `canAddToDraft()` read |
| Panel | grid, skeleton, notice, or empty line | `categoryPanelState(cache.get(selected))` |
| Route | which requests are valid | one `category` param, `tidyText`, not empty, at most 120 characters; "on Home" from `buildHomeCategories` over the tree, the same rule as the cards |
| Route | rate limit key and budget | `rateKey(cf-connecting-ip)` and `CATALOG_COUNT_RATE_LIMITER`: 60 a minute per IP shared with the count route (spec 0010 AC-15); a client cache hit spends none |
| Route | cache life | `private, max-age=60` on 200 only, decided here: the browser keeps a slug's eight for a minute; nothing is stored at the edge |
| Prefetch | which categories | the hovered (mouse or pen) or focused card; the two cards beside the selected one after the first paint; never on touch |
| Keys | when an uncached fetch starts | 150ms after the last arrow, Home, or End key |
| Failure notice | words | `Home.productsFailed`, `Home.retry` |

**Key invariants**:
- The selected card always has exactly one `aria-selected="true"` and is the only tabbable card.
- The panel shows products of the selected category only; a late answer for another category never replaces it.
- A fetch result is stored at most once per slug per component lifetime; a failed entry is replaced on retry; the cache never lives at module scope.
- The route never answers products for a main that is not shown on Home (the cards and the route share one rule).
- Depth comes from transform, scale, opacity, and the black tint only.
- No value in a log names the category.

**Security model**: public, read only; the route exposes only what `/c/<slug>` already shows, limited per IP and time boxed. No new RLS, no write, no personal data.

**Configuration required**: none (the limiter binding exists, `src/proxy.ts` already skips `/api/catalog/`, `pnpm cf-typegen` is not needed).

**Critical test scenarios**:
- Happy path, phone: the ticked mains show as cards; the first grid is server rendered; a tap on the third card swaps the heading and the grid; "عرض الكل" opens the category page; a product link opens its page, verifies **AC-1**, **AC-2**, **AC-6**, **AC-7**
- Keyboard and semantics: Tab lands on the selected card, the arrow keys move selection and the panel follows, axe passes on the tablist and panel, verifies **AC-3**
- Layout: a snap row at 390 with no sideways page scroll, wrapped rows at 820 and 1280, the card widths per breakpoint, verifies **AC-4**
- Motion: the selected card faces the viewer and its neighbours turn toward it; with reduced motion a press changes the selection at once, verifies **AC-5**
- Failure: a 503 answer shows the notice, retry with a 200 shows the grid; a 429 behaves the same, verifies **AC-7**, **AC-8**
- Route: 400, 404, 429, 503 all `no-store`, and 200 with `private, max-age=60`; a main not ticked for Home is 404; the read returns subs' products, in stock first, at most eight, verifies **AC-6**, **AC-7**

## Build plan

Tracer Bullet: the first task puts the whole thread in place (route, read, cards as plain tabs, server rendered first grid, press and swap) so the existing flows prove Home still works, then each later task thickens one layer.

1. **Thin thread.** `routes.api.homeCategoryProducts`, the request parser, `readHomeCategoryProducts` with the limit, `handleCategoryProducts` with the limiter, the on Home check, time limit, the headers per status, and the route file under `/api/catalog/`; `getHomeSections` gains the `categoryProducts` part after `circles`; `category-cards.tsx` with the tablist, roving focus, keys, a plain card look, the heading row, the grid, the skeleton while fetching, and the per visit cache; `CategoriesSection` renders it; `page.tsx` passes the new props; the circles and their strings go; `loading.tsx` takes the new shape; the homepage and layout flows retargeted. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-6**, **AC-7**, **AC-9**, **AC-10**
2. **The 3D cards.** The five tokens and the removed one, `categoryTurn` per visual row with the `ResizeObserver` count, the per card perspective, the selected scale and yellow edge with the transparent border on the rest, the tint overlay, the mouse and pen tilt in a frame, the padded snap row below `md` with scroll into view, the wrapped rows from `md`, `motion-reduce:transition-none`, server rendered rest state; Vitest for the turn and key rules. Satisfies **AC-4**, **AC-5**, **AC-11**
3. **Resilience.** Prefetch on mouse or pen hover and on focus, the two neighbours after the first paint, the 150ms wait after keys; shared in flight requests; the stale answer guard; the failure notice with retry and Sentry; the failed seed when the first part is null; the empty line; Vitest for the panel state reducer, the parser, the handler, and the database read. Satisfies **AC-7**, **AC-8**, **AC-11**
4. **Finish.** The Playwright flows of AC-11 on the three projects, the JavaScript disabled check of the server rendered grid, axe on the section, the amendment lines in specs 0011 and 0029. Satisfies **AC-11**

## Consequences

**Positive**:
- Home shows real products two ways (the picks in the hero, a category's products on demand) with one tap to any product, and the categories read as a shelf, not a list of circles.
- The press feels immediate: the first grid is in the HTML, the rest are prefetched on hover or focus and kept in the page, and the browser keeps each answer a minute, so a visitor's repeated presses never reach the database.
- No new data, binding, or dependency; the route copies a pattern that already runs in production.

**Negative / tradeoffs**:
- A second interactive section on Home: more client code, more motion, and more to test; old phones pay for the 3D transforms (the cards are small and few).
- A visitor who pressed a category sees that grid for the rest of the visit even if a product changed meanwhile (the first grid, server rendered, is always fresh on load); every uncached press reaches the database through the shared 60 a minute allowance, which shoppers behind one carrier address share.
- Pressing a card is not in the address: Back does not undo a press and a refresh returns to the first category.
- The circle carousel's tests and strings are deleted; a later wish to bring the circles back is a rebuild.

**Neutral**:
- Spec 0011 AC-4 and spec 0029 AC-13 (c) are replaced; both get an amendment line pointing here.
- `Home.viewAll` returns to the strings after spec 0030 removed it.

## Follow-up

- [ ] If the owner later wants to choose which eight products a category shows on Home, that is a new table and an editor section (spec it then; the grid's read becomes "the picks, else the first eight").
- [ ] Watch the shared 60 a minute allowance after launch: if shoppers behind one carrier address hit 429 on presses, give this route its own key prefix on the same binding.
- [ ] `docs/design/pages/home.md` still describes the circles; add the cards and the grid when the design board is next updated.
