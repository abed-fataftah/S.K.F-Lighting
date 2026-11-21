# 0029. Storefront desktop and tablet layout (O-1)

**Date**: 2026-11-10
**Status**: Accepted
**Amended**: 2026-11-18. Spec [0030](../0030-hero-product-coverflow/index.md) replaces AC-13 (a) and (b): the hero is the product coverflow at every width, and the banner side card is removed (banners sit centred at 720px from `md`).
**Amended**: 2026-11-18. Spec [0031](../0031-home-category-cards-products/index.md) replaces AC-13 (c) (the desktop circle row): from `md` the category cards wrap into rows inside the content box, with the pressed category's products under them.
**Amended**: 2026-11-21, recording the owner's request built on 2026-11-20. The `/c` categories page replaces its part of AC-9 and AC-19: the mains are raised picture cards, 2 across below `md` (also on phones, the one phone change to AC-1), 3 at `md`, and 4 at `lg`. A hovered or focused card lifts and tilts a little, gets an orange (`brand`) border and edge, zooms its photo, and sweeps a light across it; under reduced motion it changes colour only. The card's shadow tokens are the one allowed exception to the no shadow rule. Product cards keep the ink border hover.

## Summary

The storefront is drawn for phones only, so on a laptop it shows as a narrow 480px strip in the middle of the screen. This spec gives every storefront page a real tablet and desktop layout: a one row desktop header with a category bar, wider product grids, a filter column, two column product, cart, and checkout pages, and a table for quick order. Phones (below 768px) stay exactly as they are today. The work ships page by page behind a small page frame component, so a page not yet converted keeps today's look.

## Requirements

**User stories**:
- As a shopper on a laptop, I want the shop to use my screen so that I see more products and reach categories, filters, and the cart without extra taps.
- As a shopper on a tablet, I want wider grids and pages while keeping the touch friendly phone header and bottom bar.
- As an electrician at a desk, I want quick order as a table so that I can build a 30 line draft fast with a keyboard.
- As the owner, I want phone customers (most of my traffic) to see no change at all.

**Acceptance criteria**:
- **AC-1**: Phone unchanged. Below 768px every storefront page renders exactly as before this spec: the same 480px column, header, bottom bar, float, and page layouts. The existing `phone` Playwright project passes with no assertion changed.
- **AC-2**: Breakpoints. The storefront uses exactly two: `md` (768px, tablet) and `lg` (1024px, desktop), Tailwind's defaults. `sm`, `xl`, and `2xl` are removed from the theme so they produce no CSS.
- **AC-3**: Shell width. From `md`, the info strip, header, and footer backgrounds span the full screen width. All content sits in a centred box of at most `--content-max` (1280px) with side padding `--page-pad` of 24px at `md` and 32px at `lg` (16px below). No page scrolls sideways at 768, 820, 1024, 1280, or 1920px wide.
- **AC-4**: Header. Below `lg`, the header is today's phone header. From `lg` it is one black row: the logo link home at the start, the search form in the middle (grows, max 640px), then an account link (icon plus the word `حسابي`, to My Orders) and the cart button with its count at the end. The menu button is not shown at `lg`. The header is not sticky at any width. The search form is the same single form at every width (one search landmark).
- **AC-5**: Category bar. From `lg`, a black bar under the header row is a `nav` labelled `الأقسام`. It lists the navigation main categories (the menu sheet's list, same order) as links to their category pages, after a fixed yellow `كل الأقسام` link to `/c` (with a grid icon and a thin divider) at the start of the row. The current category's link has `aria-current="page"`; a yellow bar grows under a link on hover and stays under the current one. Links that do not fit in one row move, in order, into a final `المزيد` dropdown, which ends with a `كل الأقسام` link to `/c`. The dropdown opens with a click, Enter, or Space, closes with Escape, and returns focus to its button. When the navigation read fails (null) or is empty, the bar is not rendered and the header still is.
- **AC-6**: Bottom bar. Shown below `lg`, hidden at `lg` and wider, and the page keeps no empty room under the footer for it at `lg`.
- **AC-7**: WhatsApp float. It stays on the end side of the screen. From `md`, it sits 24px from the screen's end edge (not the old column's edge). Below `lg` it sits above the bottom bar as today. At `lg` it sits 24px above the screen bottom. It never covers the last footer link (the footer keeps room for it).
- **AC-8**: Footer. Below `lg` as today. From `lg`, three columns inside the content box: the brand (logo, contact line, and a `تواصل معنا عبر واتساب` button) at the start, `تسوّق` (the first six navigation mains, then `كل الأقسام`; left out when the list is empty) in the middle, and `مساعدة` (track order and the three policies) at the end; under them a line with `© <year> S.K.F للإنارة، جميع الحقوق محفوظة`. Every link stays at least 44px high.
- **AC-9**: Product grids. Home featured, category, and search grids have 2 columns below `md`, 3 at `md`, and 4 at `lg`. When a filter column is beside the grid (AC-10), the grid has 3 columns at `lg`. The `/c` categories list has 1 column below `md`, 2 at `md`, 3 at `lg`.
- **AC-10**: Filter column. From `lg`, category and search pages show a 260px filter column at the start side, beside the grid, always open. It holds the same controls as the filters screen: the available switch, price (from, to, and a `تطبيق` button), size chips, colour chips, and `مسح الكل`. Toggling a chip or the switch applies at once (the URL updates, the grid and count reload, the page does not scroll, focus stays on that control). Price applies on `تطبيق` or Enter. Without JavaScript the column is a GET form to the list's own address and `تطبيق` submits all of it. At `lg` the filter button and the full screen filters dialog are hidden; the applied chips row stays above the grid.
- **AC-11**: Crossing the `lg` line. If the filters dialog or the menu sheet is open and the window grows to `lg` or wider (where its trigger is hidden), it closes. If the add to draft sheet is open while crossing, it stays open and changes look (AC-18).
- **AC-12**: Product page. Below `md`, as today. At `md`, the same single column, centred, at most `--prose-max` (720px). From `lg`, two columns: the gallery at the start (about 55%, main image area `--gallery-h-lg` 520px tall, thumbnails under it); at the end the purchase box (title, code and stock line, price, options card, add to cart and WhatsApp buttons). The breadcrumb spans both columns above. Description, specs, and help cards run across the content width below. The purchase box is sticky (top 16px) only at `lg` with a window at least 720px tall.
- **AC-13**: Home. (a) No banners: the hero card spans the content width, text at the start, chandelier at the end; it keeps the page's `h1`. (b) Banners: below `md` as today; at `md` the carousel is centred at most 720px wide; at `lg` the carousel takes the start two thirds of the row (16:9, never cropped) and a compact black side card fills the end third with the hero headline as an `h2` (the page `h1` stays the hidden shop name), the hero subline, and the `تسوّق الآن` and `اطلب عبر واتساب` buttons. (c) Category circles: below `md` the carousel as today; from `md` one row of same size circle links, centred and still when they all fit; when they do not, the row scrolls sideways (snapping to a circle) and a round arrow on each side slides it by about one view, the arrow at an end disabled. No auto movement, no pause button, no yellow "selected" button; a hovered circle gets the yellow ring. The hero chandelier sways slowly from `md` (still under reduced motion). (d) Trust cards: 2 by 2 below `lg`, 4 in one row at `lg`.
- **AC-14**: Cart and checkout. Below `lg`, single column (centred, max 720px at `md`). From `lg`, two columns: lines (cart) or form cards (checkout) at the start, and the summary card (360px, `--summary-col`) at the end, sticky (top 16px) with a window at least 720px tall. On checkout the summary's submit button still submits the checkout form, and the tab order is all form fields first, then the summary's button.
- **AC-15**: Order pages. Order details from `lg`: products and payment cards at the start, the status timeline and the WhatsApp and cancel buttons at the end. My orders and drafts: cards 1 across below `md`, 2 across from `md`. Content width `--content-max`.
- **AC-16**: Quick order. From `lg`, each line is one row of a grid: line number, code or product name, size, colour, quantity, unit price, line total, delete button. A header row above shows the column names (hidden from screen readers). Every field keeps its own label for screen readers (the label is visually hidden at `lg`). A line's error shows under that row, still linked by `aria-describedby`. The 30 line limit, add line, save, and send work as today. The totals card sits at the end under the table, 360px wide. Below `lg`, the line cards are unchanged.
- **AC-17**: Narrow pages. Sign in, password reset, account index, order lookup, order confirmation, the 404 page, and the error page: a centred column at most `--form-max` (560px). Policy pages: at most `--prose-max` (720px). All inside the full shell.
- **AC-18**: Add to draft sheet. Below `lg` it is the bottom sheet as today. From `lg` the same component shows as a centred dialog (radius 12, border, max 560px wide, no slide). Admin sheets are not changed.
- **AC-19**: Hover. On devices that can hover only: product cards and `/c` category cards get an ink border on hover (a product card's photo also zooms in a little inside its frame), and text links underline. At `lg` the header's account link and cart turn yellow, and the search box gets a yellow edge on hover and focus. Colour and zoom changes take `--dur-hover` (0 under reduced motion). No shadows, no new colours.
- **AC-20**: Images. Every storefront `next/image` `sizes` value matches its new rendered width at each breakpoint (table in Feature design), so desktop never loads a phone sized picture stretched, nor a needlessly huge one.
- **AC-21**: Accessibility. Every storefront page passes axe WCAG 2.2 A and AA on the `phone`, `tablet`, and `desktop` projects; every target is at least 44 by 44px; focus is visible on every control; tab order follows reading order (start column, then end column), and only content with no focusable element is placed out of source order. At 200% zoom on a 1280px window (640 CSS px) the phone layout shows with no sideways scroll.
- **AC-22**: Tests. A `tablet` Playwright project (820 by 1180) runs the shell, grid, filter, product, cart, and checkout specs. The `desktop` project's assertions describe the new layout. A 1024px check covers the category bar overflow into `المزيد`.
- **AC-23**: Design docs. `docs/design/design.md` section 4, both `tokens.css` breakpoint notes, `handoff.md` (O-1 closed), and the "Desktop (1280) and tablet" line in each `docs/design/pages/*.md` storefront file point to this spec instead of the interim rule.

## Decision

**Chosen option**: Option 2: Responsive layouts per page, rolled out through a page frame.

Every storefront page gets designed `md` and `lg` layouts built with Tailwind's `md:` and `lg:` prefixes on one DOM per component (no separate desktop components). Pages switch over one at a time through a shared `PageFrame` component, so the shell can go wide first while unconverted pages keep the 480px column.

**Implementation skills**: `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Feature design

No database, API, auth, or env change. This is layout, a few client behaviours, tokens, and tests.

### Tokens (add to `src/app/tokens.css`, mirror in `docs/design/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--page-max` | 480px (unchanged) | Phone column below `md`; dialogs and sheets below `lg` |
| `--content-max` | 1280px | The content box from `md` |
| `--form-max` | 560px | Narrow pages (AC-17), the add to draft dialog at `lg` |
| `--prose-max` | 720px | Policies; product, cart, checkout, and banners at `md` |
| `--filter-col` | 260px | Filter column at `lg` |
| `--summary-col` | 360px | Cart, checkout, and quick order totals at `lg` |
| `--gallery-h-lg` | 520px | Product gallery main area at `lg` |
| `--h-cat-bar` | 48px | Category bar row height |
| `--sticky-top` | 16px | Top offset of sticky summary and purchase boxes |
| `--page-pad` | 16px, 24px from `md`, 32px from `lg` | Redefined inside media queries on `:root`, so every existing `px-(--page-pad)` grows with no page edit |
| `--fab-inset` | 14px, 24px from `md` | Float distance from the screen's end edge |
| `--fab-bottom` | 84px (unchanged), 24px from `lg` | Float distance from the bottom |

In the Tailwind lock block: `--breakpoint-sm: initial; --breakpoint-xl: initial; --breakpoint-2xl: initial;` (AC-2), and one custom variant `@custom-variant lg-tall (@media (width >= 64rem) and (height >= 45rem));` for the two sticky boxes (AC-12, AC-14).

### Components

| Component | Where | Change |
|---|---|---|
| `PageFrame` (new) | `src/components/page-frame.tsx` | `width: "phone" \| "wide" \| "form" \| "prose"` sets `mx-auto w-full` plus the matching max width (`--page-max`, `--content-max`, `--form-max`, `--prose-max`). Server component, no client code. `"phone"` is the rollout default and is deleted in the last task. |
| Storefront layout | `src/app/[locale]/layout.tsx` | The outer wrapper keeps `max-w-(--page-max)` below `md` and drops it from `md` (`md:max-w-none`). Bottom padding and `scroll-pb` for the bar apply below `lg` only. |
| `InfoStrip`, `SiteFooter` | `src/features/shell/components/` | Full bleed background, inner content in `max-w-(--content-max)` with `--page-pad`. Footer `lg` three column layout (AC-8); its bottom padding for the float uses the `lg` `--fab-bottom` at `lg`. |
| `SiteHeader` | same | One DOM, CSS grid with `grid-template-areas`: below `lg` `"menu logo cart" "search search search"`; at `lg` `"logo search account cart"`. Menu button `lg:hidden`; new account link `hidden lg:inline-flex`. Then `CategoryBar` (hidden below `lg`). |
| `CategoryBar` (new, client) | `src/features/shell/components/category-bar.tsx` | See *Category bar overflow*. Uses `dropdown-menu.tsx` for `المزيد`. |
| `BottomBar` | same | Adds `lg:hidden`. |
| `WhatsAppFab` | same | Position becomes `end-(--fab-inset)` from `md` (screen edge), the column formula stays below `md`. |
| `MenuSheet`, `FiltersScreen` | shell, catalog | Close on a `matchMedia("(width >= 64rem)")` change to true (AC-11). Shared hook `useCloseAtDesktop(setOpen)`. |
| `FiltersPanel` (new, client) | `src/features/catalog/components/filters-panel.tsx` | The `lg` filter column. Shares the form state, parser, and field components with `FiltersScreen` by extracting `FilterFields` and `useFiltersForm` from `filters-screen.tsx`. Chips and the switch call `router.push(listHref(scope, next), { scroll: false })` on change; price on submit. |
| Category page, search page | `category-page.tsx`, `search-page.tsx` | At `lg`, a grid `[var(--filter-col)_minmax(0,1fr)]`: panel at start, toolbar, chips, grid, and load more at end. Sub category chips wrap from `md` instead of scrolling sideways. Filter button `lg:hidden`. |
| `ProductCard` grids | home, category, search | `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`; beside a filter column `lg:grid-cols-3`. |
| Product page | `src/app/[locale]/p/[slug]/page.tsx`, `product-gallery.tsx` | `lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:gap-8`; purchase box `lg-tall:sticky lg-tall:top-(--sticky-top) lg-tall:self-start`. Gallery main area `lg:h-(--gallery-h-lg)`. |
| Home | `(home)/page.tsx`, `hero-card.tsx`, `banner-carousel.tsx`, `category-circles.tsx`, `home-sections.tsx` | Hero wide layout at `md`. Banners at `lg` in a `[2fr_1fr]` row with a new `HomeSideCard` (`hidden lg:flex`). Circles: new `CircleShelf` (`hidden md:flex`; one scroll snap row of links reusing `CirclePicture`/`CircleWords`, with back and next arrows only while it overflows, replacing the first build's still wrapping `CircleRow`) beside the carousel (`md:hidden`); the carousel's auto timer runs only while `(width < 48rem)` matches. Trust grid `lg:grid-cols-4`. |
| Cart, checkout | `cart/page.tsx`, checkout components | `lg:grid lg:grid-cols-[minmax(0,1fr)_var(--summary-col)] lg:gap-6`; summary `lg-tall:sticky`. On checkout the grid sits inside the existing `<form>`, summary last in source. |
| Order details | `orders/[number]/page.tsx`, `order-summary.tsx` | `lg` grid with named areas: start `products` and `payment`; end `status` and `actions`. Source order stays phone order (status, products, payment, actions); only the timeline (no focusable content) moves visually. |
| My orders, drafts | `account/orders`, `account/drafts` | List `md:grid md:grid-cols-2 md:gap-3`. |
| Quick order | `src/features/drafts/components/` (line card, totals) | At `lg` the line list is a CSS grid; each line card is `lg:grid lg:grid-cols-subgrid lg:col-span-8`; field labels `lg:sr-only`; one `aria-hidden` header row. Error text spans the row under it. |
| `Sheet` | `src/components/ui/sheet.tsx` | New opt in `variant="responsive"`: bottom sheet below `lg`, centred dialog at `lg` (`lg:inset-auto lg:top-1/2 lg:-translate-y-1/2 lg:max-w-(--form-max) lg:rounded-card lg:border`, fade, no slide). Only `add-to-draft-sheet.tsx` opts in. |
| Hover | `product-card.tsx`, `/c` cards, link styles | `hover:border-ink`, `hover:underline` (Tailwind v4 `hover:` already only applies under `(hover: hover)`). |

### Category bar overflow

`CategoryBar` gets `categories: readonly NavMain[]` from the server shell (already read once per request). It renders every link in one row of fixed height `--h-cat-bar` with `overflow: hidden`, plus the `المزيد` button at the end. After hydration a `ResizeObserver` on the row measures each link and sets `visibleCount` (the most links that fit beside the `المزيد` button; the button shows only when `visibleCount < categories.length`). Links past `visibleCount` get `hidden` (out of the tab order and the accessibility tree) and appear in the dropdown, followed by `كل الأقسام`. Before hydration the row is clipped at its fixed height, so no layout shift happens. The dropdown then lists every category (server rendered) so nothing is unreachable.

### Image sizes (AC-20)

| Image | New `sizes` |
|---|---|
| Product card | `(min-width: 1024px) 300px, (min-width: 768px) 33vw, (min-width: 480px) 240px, 50vw` |
| Product gallery main | `(min-width: 1024px) 680px, (min-width: 768px) 672px, (min-width: 480px) 448px, 100vw` |
| Banner | `(min-width: 1024px) 830px, (min-width: 768px) 720px, (min-width: 480px) 448px, 100vw` |
| Category circle | `132px` (unchanged) |
| Cart, order, combobox thumbs | unchanged (fixed px) |

### Value sourcing

| Action | Value | Source |
|---|---|---|
| Category bar | Category names, slugs, order | `listNavigation()` in the storefront layout (spec 0008 AC-14), the `NavMain` list the menu sheet gets |
| Category bar | Current category | `usePathname()` matched against `routes.category(slug)` |
| Category bar | `المزيد`, `كل الأقسام`, nav label | New keys `Shell.more`, `Shell.allCategories`; nav label reuses `Shell.menuCategories` |
| Header account link | Label, href | The bottom bar's `account` tab label (`حسابي`) and `routes.accountOrders`, the same `storefrontTabs` entry |
| Header cart count | Lines in cart | `readCartCount()`, already passed to `SiteHeader` |
| Home side card | Headline, subline, button labels | The hero's existing `Home` keys (`home.02` to `home.06`) |
| Home side card | `تسوّق الآن` target, WhatsApp link | `shopNowTarget(circles.length, featured.length)`; `getWhatsappNumber()` with `Shell.whatsappMessages.general`, as `HeroCard` |
| Filter column | Choices, applied filters, scope | The same `FilterChoices`, `parseListFilters(searchParams)`, and `FiltersScope` the page passes to `FiltersScreen` |
| Filter column | Price button label | New key `applyPrice` (`تطبيق`) in the namespace `filters-screen.tsx` already uses |
| Quick order header row | Column names | The line card's existing field label keys |
| Layout widths, breakpoints | All widths | The tokens table above; `md` 48rem and `lg` 64rem are Tailwind defaults |
| Tablet test size | 820 by 1180 | Decided here (a common tablet portrait size, between `md` and `lg`) |

### Key invariants

- Below 768px nothing changes (AC-1). Every new class is behind `md:`, `lg:`, or `lg-tall:`, or is a token whose phone value is the current one.
- One DOM per component. No component is rendered twice to show a desktop copy, except home circles (carousel vs row), where the carousel is a moving widget that a row cannot be.
- Logical properties only (`start`, `end`, `ms`, `pe`), tokens only, no shadows: `src/design-rules.test.ts` keeps passing.
- Source order is reading order. Columns put the start column first in source. Visual reordering moves only content without focusable elements (order timeline).
- Links come from `routes`, strings from `ar.json`, numbers from `src/lib/format.ts`.

### Security model

No change. No new data is read; the category bar reuses the layout's navigation read. No new routes or actions.

### Critical test scenarios

- Phone regression: the full `phone` project passes untouched, verifies **AC-1**.
- Desktop shell at 1280: header row order, account link target, no menu button, no bottom bar, category bar links and `aria-current`, float 24px from bottom, verifies **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**.
- Category bar at 1024 with 10 seeded mains: some links move into `المزيد`, the dropdown works by keyboard, `كل الأقسام` goes to `/c`; navigation read failing shows no bar, verifies **AC-5**.
- Filter column: toggle a size chip, the URL and count update, focus stays on the chip; type a price and press Enter; with JavaScript off, `تطبيق` submits, verifies **AC-10**.
- Resize from 900 to 1100 with the filters dialog open: it closes, verifies **AC-11**.
- Product, cart, checkout at 1280 by 800: two columns; summary stays in view while scrolling; at 1280 by 640 it is not sticky; checkout submits from the summary button, verifies **AC-12**, **AC-14**.
- Home with and without banners at 1280 and 820, verifies **AC-13**.
- Quick order at 1280: add 30 rows, trigger a quantity error, check the label and `aria-describedby`, verifies **AC-16**.
- axe on every page on all three projects, and 200% zoom at 1280, verifies **AC-21**.

## Build plan

Tracer Bullet: the first slice runs one real page (category) through the new shell on every width; later slices convert pages one group at a time. Each slice ships on its own: unconverted pages stay on `PageFrame width="phone"`.

**Slice 1: thin thread (shell plus category page)**
1. [x] Tokens and breakpoint lock: add the tokens table, redefine `--page-pad` and `--fab-*` in media queries, remove `sm`/`xl`/`2xl`, add `lg-tall`; update the `tailwind-lock.test.ts` and `design-rules.test.ts` cases, satisfies **AC-2**, **AC-3**
2. [x] `PageFrame` with unit test; wrap every storefront page's root in `PageFrame width="phone"` (no visual change), satisfies **AC-1**, **AC-3**
3. [x] Layout wrapper `md:max-w-none`, bar padding below `lg` only; `InfoStrip` and `SiteFooter` full bleed with the `lg` footer row, satisfies **AC-3**, **AC-6**, **AC-8**
4. [x] `SiteHeader` grid areas, account link, menu button `lg:hidden`; `BottomBar` `lg:hidden`; `WhatsAppFab` insets, satisfies **AC-4**, **AC-6**, **AC-7**
5. [x] `CategoryBar`, first version: a fixed first 6 links and the rest in `المزيد` (measuring comes in task 8); new message keys, satisfies **AC-5**
6. [x] Category page on `PageFrame width="wide"`: grid 2/3/4, sub chips wrap from `md`, card hover, product card `sizes`, satisfies **AC-9**, **AC-19**, **AC-20**
7. [x] Playwright `tablet` project; update desktop shell assertions in `e2e/shell.spec.ts` and `e2e/design-system.spec.ts`; desktop and tablet runs for the category page, satisfies **AC-1**, **AC-21**, **AC-22**

**Slice 2: browsing**
8. [x] `CategoryBar` overflow measuring with `ResizeObserver`, the 1024 overflow e2e, satisfies **AC-5**, **AC-22**
9. [x] Extract `FilterFields` and `useFiltersForm`; build `FiltersPanel`; wire category and search pages at `lg`; `useCloseAtDesktop` on `FiltersScreen` and `MenuSheet`; unit tests for the extracted pure parts, satisfies **AC-10**, **AC-11**
10. [x] Search page and `/c` index on `wide`, satisfies **AC-9**
11. [x] Product page two columns, sticky purchase box, gallery height and `sizes`, satisfies **AC-12**, **AC-20**
12. [x] Home: hero wide, banner row with `HomeSideCard`, `CircleShelf`, trust grid, banner `sizes`, satisfies **AC-13**, **AC-20**

**Slice 3: buying**
13. [x] Cart and checkout two columns with sticky summary; check checkout tab order and submit, satisfies **AC-14**
14. [x] Order confirmation, order lookup, sign in, password reset, account index, 404, and error page on `form`; policies on `prose`, satisfies **AC-17**

**Slice 4: accounts**
15. [x] Order details grid areas; my orders and drafts two across, satisfies **AC-15**
16. [x] Quick order table at `lg`, satisfies **AC-16**
17. [x] `Sheet` `variant="responsive"`, used by the add to draft sheet, satisfies **AC-18**, **AC-11**

**Finish**
18. [x] Remove `width="phone"` from `PageFrame` (no page uses it); axe and 200% zoom sweep on all three projects, satisfies **AC-21**
19. [x] Update `design.md` section 4, both `tokens.css` breakpoint notes, `handoff.md` O-1, and the storefront `pages/*.md` desktop lines, satisfies **AC-23**

## Migration plan

**Strategy**: strangler, page by page, through `PageFrame`.
**Phases**: slice 1 ships the wide shell with every page still on the 480 column except category; slices 2 to 4 flip their pages; the finish removes the phone width option.
**Rollback**: each slice is its own commit set; reverting a slice puts its pages back on `width="phone"`. No data to migrate.
**Risks**: between slices, desktop visitors see a wide header over some narrow pages (acceptable, and better than today); a shared component changed for one page can shift another (the phone project guards below 768).

## Consequences

**Positive**:
- Laptop and tablet visitors get a real shop: categories one click away, 4 products per row, filters always open, summaries always in view.
- Quick order becomes usable at a desk, closing the deferred "Quick order on computers" item.
- Most storefront padding adapts through the `--page-pad` token with no page edits.

**Negative / tradeoffs**:
- Three widths to test instead of two; the Playwright run gets roughly 50% longer.
- The design board stays phone only; these layouts are specified in words, not drawn. A designer reviewing later may want changes.
- The category bar needs client measuring code; a clipped row before hydration, and a resize observer to maintain.
- Home circles render twice (carousel plus row), a small extra cost in HTML.
- Two filter UIs (dialog and column) share logic but are two components to keep in step.

**Neutral**:
- Desktop specs written earlier that assert the 480 column change in this work.
- `sm`, `xl`, `2xl` disappear from the theme; any future use needs a deliberate token change.
- The admin dashboard is untouched.

## Follow-up

- [ ] Product page loading skeleton (the other half of the deferred "Product page desktop layout and loading skeleton" item) stays deferred.
- [ ] A wide banner image variant (spec 0011) can come later if the 16:9 carousel at two thirds width looks short on large monitors.
- [ ] A designer pass on the desktop layouts once built, using real screenshots from the `desktop` project.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
