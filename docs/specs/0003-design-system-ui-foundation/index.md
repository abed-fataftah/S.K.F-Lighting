# 0003. Design system and UI foundation for the S.K.F Lighting shop

**Date**: 2026-10-19
**Status**: In Progress

## Summary

The shop's look is already designed and approved by the owner: black and yellow on a warm light page, flat, Almarai type, Arabic right to left, phone first. That design lives in `docs/design/` (moved from `UI/`). This spec turns it into code: the tokens (named colours, sizes, radii) become the only values Tailwind knows, shadcn/ui components on Base UI (the accessible behaviour layer) are restyled to match, and the shared parts every page uses (header, footer, bottom bar, WhatsApp button, dashboard sidebar) are built once. A hidden gallery page shows every component so tests can prove focus, contrast, touch size, and right to left before any real page is built.

## Requirements

**User stories**:
- As a shopper on a phone, I want every screen to look and behave the same way, in Arabic, right to left, so that the shop feels trustworthy and is easy to use with one thumb.
- As a shopper using a keyboard or a screen reader, I want visible focus, real labels, and big enough targets, so that I can shop without a mouse or perfect sight.
- As the builder of every later page, I want ready, tested components and shared parts that already follow the design, so that I build pages instead of restyling buttons.
- As the owner, I want the design I approved to be what ships, so that nothing drifts from the boards.

**Acceptance criteria**:
- **AC-1**: The design package lives in `docs/design/` (`design.md`, `handoff.md`, `pages/*.md`); the `UI/` folder is gone; `docs/design/handoff.md` section 2 records the real paths from this spec (closing O-27 for paths).
- **AC-2**: `src/app/tokens.css` holds every value from the approved tokens (colours, type, spacing, shape, control sizes, focus, motion), minus the `--illus-*` placeholder palette, plus the new tokens in *Design tokens in code*. It is the only file in `src/` that contains a raw hex colour.
- **AC-3**: Tailwind is locked to the tokens: the default colour palette, radius, shadow, font size, font family, leading, tracking, container, blur, ease, and animation scales are removed (`initial`), so a class like `bg-red-500`, `rounded-lg`, `shadow-md`, `text-sm`, `leading-tight`, `max-w-md`, or `animate-pulse` produces no CSS, while `font-bold`, `font-extrabold`, `bg-transparent`, and `text-current` still work. Colours use only the names in *Colour names*. Type roles are `type-*` utilities (`type-caption` through `type-404`), each setting size, weight, and line height from `design.md` section 3, and `cn()` merges them as one group.
- **AC-4**: Every layout (storefront, gallery, root not found, and later `/admin`) renders `<html lang="ar" dir="rtl">` inside Base UI's `DirectionProvider` set to `rtl`, with Almarai (400, 700, 800; `arabic` and `latin` subsets, so Western digits, ₪, and "S.K.F" use Almarai) loaded through `next/font/google` from one shared `src/app/fonts.ts`, with the fallback stack Segoe UI, Tahoma, Arial. The viewport sets `viewportFit: "cover"`. No dark mode exists: no `prefers-color-scheme` rule, no `.dark` class, no `dark` custom variant, no `dark:` class.
- **AC-5**: Every focusable element shows a 3px solid ink outline with a 2px offset on `:focus-visible`; inside a black surface (marked `.on-dark`: header, footer, sidebar) the outline is yellow. Programmatic focus targets with `tabindex="-1"` (`main`, popups) draw no outline. No component removes the outline or adds a ring, and an outline is never clipped by a scrolling row (the row has padding).
- **AC-6**: A Vitest design rule test scans `.ts`, `.tsx`, and `.css` files in `src/` (outside `tokens.css` and its own file) and fails on, matched at class token boundaries: a three, four, six, or eight digit hex colour; a physical direction class or CSS property (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `inset-x-`, `border-l`, `border-r`, `rounded-l`, `rounded-r`, `rounded-tl`, `rounded-tr`, `rounded-bl`, `rounded-br`, `text-left`, `text-right`, `float-left`, `float-right`, `origin-left`, `origin-right`, `slide-in-from-left`, `slide-in-from-right`, `scroll-ml`, `scroll-pr` and their siblings, `margin-left`, `padding-right`, `left:`, `right:` in CSS); an arbitrary pixel value (`[13px]`); a removed scale class (`text-xs` to `text-9xl`, `rounded-sm` to `rounded-4xl`, a default palette colour like `bg-red-500`, `font-medium`, `font-semibold`, `leading-*` keywords); `dark:`, `.dark`, or `prefers-color-scheme`; `ring-`, `outline-none`, or `outline-hidden`; a shadow, gradient, or blur class. In `ar.json` storefront namespaces (`Metadata`, `Home`, `Shell`, `DesignSystem`, and every later one not starting with `Admin`) it fails on the whole words شيك, بشيك, دفع إلكتروني, تعديل الأسعار, matched with Arabic letter boundaries so شيكل passes. Planted fixtures are built from string pieces so the test never flags itself. It passes on the finished tree.
- **AC-7**: These shadcn components are installed on Base UI with RTL enabled and restyled to `docs/design/design.md` section 6 (sizes, radii, borders, states): Button (variants `default` yellow, `whatsapp`, `outline`, `link`, `ghost`; sizes `lg` 52, `sm` 44, `icon` 44x44), Input, Textarea, NativeSelect, Field (label, description, error), Label, Checkbox, RadioGroup, ToggleGroup, Badge (variants `new`, `proc`, `ok`, `off`, `spec`, `count`), Card, Table, Tabs, Skeleton, Alert (notice), Breadcrumb, Sheet. No toast component is installed.
- **AC-8**: A field in error shows a `--skf-danger` border, `aria-invalid="true"`, and a message below it (13/700, danger colour, error icon, `role="alert"`) linked by `aria-describedby`; the label sits above, 13px muted, 4px gap.
- **AC-9**: The custom controls exist and behave as specified: Chip (ToggleGroup item, `aria-pressed`, check icon when selected, disabled shows struck through with "غير متوفر"), RemovableChip (`aria-label="إزالة <label>"`), RadioCard (2px border in both states, transparent and inset when unselected so selecting never shifts layout; selected: yellow tint fill, ink border), QuantityStepper (value is an `<input inputmode="numeric">` in `aria-live="polite"`; 1 to 99; typed values clamp on blur and Enter; empty or not a number reverts to the last value; minus at 1 and plus at 99 use `aria-disabled`, so focus stays), EmptyState card and ErrorState card (ErrorState has `role="alert"` and always a retry button and a WhatsApp button), ImagePlaceholder (tone 1 to 4 maps to `--skf-product-bg-1..4`, lucide `Lamp` icon in `--skf-on-dark-muted`, `aria-hidden`), a loading pattern (`role="status"` with a visually hidden "جارٍ التحميل..."), and an `Ltr` helper (`<bdi dir="ltr">`) for codes, order numbers, and phones. Default copy for these comes from `ar.json` `Shell.empty`, `Shell.error`, `Shell.loading`.
- **AC-10**: Icons come from `lucide-react`, plus one local WhatsApp glyph component built from the Simple Icons path. Directional icons (chevrons, back and next arrows) flip in right to left; cart, search, WhatsApp, trash, check, close, filter, and play never flip.
- **AC-11**: Every storefront page renders inside the shell, in one centered column of `--page-max` (480px) on the page background: skip link "تخطي إلى المحتوى" as the first tab stop, targeting `<main id="main">`; SiteHeader; the page; SiteFooter; a fixed BottomBar; a fixed WhatsApp float. Content is never hidden behind the bar or the float, including above the phone's home indicator (safe area): scrolled to the very end of `/`, no footer link overlaps the float or the bar. A focused field is never hidden behind the bar (`scroll-padding-bottom`).
- **AC-12**: SiteHeader matches `handoff.md` section 6, with the search button at 44x44 (not 42): menu button, logo link to `/` (`alt="S.K.F lighting"`), cart button to `/cart`, and a search form that submits `GET /search?q=<text>` (an empty query is allowed and goes to `/search`). The home only InfoStrip shows above it on `/` and nowhere else.
- **AC-13**: The menu button opens a Sheet from the inline start side (anchored to the viewport) with the heading "القائمة", then in order: the five tab links (same labels, icons, and routes as BottomBar), the three policy links, and a WhatsApp link (message W1). Focus moves to the close button ("إغلاق"), stays in the sheet, Escape and the close button close it, and focus returns to the menu button. Under reduced motion the sheet appears without sliding.
- **AC-14**: The cart button shows a count badge only when it is given a count above 0 (yellow fill, ink 12/800 text, chip radius, top end corner, `99+` above 99, `aria-hidden`); its accessible name is "السلة" with no count, or the ICU plural message `Shell.cartWithCount` with a count, written for all six Arabic forms (zero, one, two, few, many, other), digits per the interim rule. Until feature 12 passes a count, no badge shows.
- **AC-15**: SiteFooter shows the logo, a contact line built from `shop_settings.contact_phone` and `shop_settings.address` (a missing value hides its part, both missing hides the line, the phone inside `Ltr`), and the three policy links, each at least 44px high. A failed or slow settings read (over 1.5 seconds) hides the line and the page still renders.
- **AC-16**: BottomBar has five tabs (الرئيسية `/`, الأقسام `/c`, السلة `/cart`, بحث `/search`, حسابي `/account/orders`) in `nav aria-label="التنقل الرئيسي"`; the tab for the current path is bold ink with a 3px yellow underline and `aria-current="page"`, per the path map in *Value sourcing*.
- **AC-17**: The WhatsApp float (52px green circle, `aria-label="واتساب"`) opens `https://wa.me/<number>?text=<W1 encoded>` in a new tab (`target="_blank" rel="noopener"`), with the number from `NEXT_PUBLIC_WHATSAPP_NUMBER`. The build and the server fail when that number is missing or is not 8 to 15 digits.
- **AC-18**: AdminSide renders the logo, the caption "لوحة التحكم", eight links in the handoff order, and the "عرض المتجر" outline button to `/`; the current link has the active fill, the 4px yellow bar on the inline start edge, and `aria-current="page"`. In a dashboard frame, the sidebar sits beside the content at 1280px and wraps above it below 780px with no media query.
- **AC-19**: The gallery page at `/design-system` (its own route group with a bare layout, no shell around it) shows every token pair from the contrast table, every type role, and every component and shared part from AC-7 to AC-18 in each of its states (hover, pressed, and focus previews forced through `data-preview` attributes; shell parts in their `static` display mode), in Arabic. It renders per request (`connection()`), carries `noindex`, and returns 404 unless `DESIGN_SYSTEM_PAGE=1`.
- **AC-20**: Playwright on a 390x844 phone screen, right to left, against the gallery and `/`: axe with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` tags finds no violation; every visible interactive element measures at least 44 by 44 (a checkbox or radio is measured by its label row; hidden inputs and the off screen skip link are skipped); the page never scrolls sideways at 390 or at 1280; tabbing starts at the skip link and the focus outline is visible on a light and on a dark surface. A unit test recomputes every pair in the tokens contrast table from the hex values and checks each meets its stated minimum.
- **AC-21**: Under `prefers-reduced-motion: reduce`, the skeleton does not pulse and the sheet does not slide.

## Decision

**Chosen option**: Option 1: shadcn/ui on Base UI, restyled from the approved design, with Tailwind locked to the tokens, proven on a hidden gallery page.

Build the approved design exactly, as tokens that are the only values Tailwind offers, on restyled shadcn components with Base UI behaviour, with the shared shells built once, checked by a design rule test, axe, and Playwright against a gallery page.

**Implementation skills**: `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`, read `design-system.md` and `rules/base-vs-radix.md` first) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

**Design source**: `docs/design/` is the source of truth (rules in `design.md`, shared parts in `handoff.md` section 6, values in the tokens). For any doubt about appearance, the owner approved canvas is https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY (boards `SiteHeader`, `SiteFooter`, `BottomBar`, `AdminSide`, and each page board). Where a board and `design.md` differ, `design.md` wins (handoff section 10.2).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Design tokens in code

- `src/app/tokens.css`: sections 1 and 3 to 11 of the approved tokens, copied verbatim (section 2, `--illus-*`, is dropped; there are no drawings). `src/app/globals.css` is `@import "tailwindcss";` then `@import "./tokens.css";` then base styles (`body`: page background, ink text, `font-sans`, `--lh-body`). The old placeholder colours and the dark mode block are deleted.
- **New tokens** (added to `tokens.css`, all in px like the rest): `--h-bottom-bar: 64px` (bar height without the safe area), `--fab-bottom: 84px` (float offset above the bottom), `--w-sheet: 320px` (menu sheet width, capped at `85vw`), `--z-bar: 30`, `--z-fab: 40` (exists), `--z-sheet: 50`. These keep the "no value outside the tokens" rule true.
- **After `shadcn init`**: init writes its own OKLCH `:root`, a `.dark` block, `@custom-variant dark`, and `--radius-*` into `globals.css`. Replace all of it with this spec's `globals.css` and `tokens.css`; nothing from init's theme survives.
- **Tailwind lock**, in `tokens.css`:
  - `@theme { --color-*: initial; --radius-*: initial; --shadow-*: initial; --inset-shadow-*: initial; --drop-shadow-*: initial; --text-*: initial; --font-*: initial; --leading-*: initial; --tracking-*: initial; --container-*: initial; --blur-*: initial; --ease-*: initial; --animate-*: initial; }` then define `--font-sans: var(--skf-font)` and keep `--font-weight-*` (if `--font-*: initial` clears weights in the installed Tailwind, reset only `--font-sans`, `--font-serif`, `--font-mono` instead). Milestone 1 checks that `font-bold`, `font-extrabold`, `bg-transparent`, and `text-current` produce CSS.
  - The `@theme inline` bridge maps the shadcn names (`--color-background`, `--color-primary`, ...) plus the colour names below. Radii are used only by name: `rounded-chip`, `rounded-btn`, `rounded-tile`, `rounded-card`, `rounded-hero`, `rounded-full`.
  - `@keyframes skeleton` (opacity 1, .55, 1) and `@utility animate-skeleton { animation: skeleton var(--dur-skeleton) ease-in-out infinite; }`; at `0s` (reduced motion) it does not run.
- **Colour names** (the only colour classes, as `bg-`, `text-`, `border-`, `fill-`, `stroke-`, `outline-`): `ink`, `yellow`, `yellow-tint`, `white`, `page`, `muted`, `border`, `control-border`, `chip-border`, `fill-muted`, `on-dark-muted`, `sidebar-active`, `whatsapp`, `danger`, `product-1` to `product-4`, `swatch-gold`, `swatch-chrome`, `swatch-wood`, plus the shadcn role names (`background`, `foreground`, `card`, `primary`, `primary-foreground`, `secondary`, `muted-foreground`, `accent`, `destructive`, `input`, `ring`, `popover`) that the generated components read. The approved bridge's `skf-*` duplicates (`--color-skf-ink`, ...) are dropped.
- **Font wiring**: `fonts.ts` exports `almarai = Almarai({ weight: ["400","700","800"], subsets: ["arabic","latin"], display: "swap", variable: "--font-almarai", fallback: ["Segoe UI","Tahoma","Arial"] })`; `tokens.css` sets `--skf-font: var(--font-almarai), "Segoe UI", Tahoma, Arial, sans-serif`; layouts put `almarai.variable` on `<html>`.
- **`cn()`**: `src/lib/utils.ts` uses `extendTailwindMerge` with a `type` class group (every `type-*` role) so a caller's `type-caption` replaces a component's `type-control`, and the colour names above registered as colours.
  - Spacing keeps Tailwind's 4px unit, which covers the whole scale: 2 `0.5`, 4 `1`, 6 `1.5`, 8 `2`, 10 `2.5`, 12 `3`, 14 `3.5`, 16 `4`, 18 `4.5`, 20 `5`, 24 `6`, 28 `7`, 34 `8.5`, 48 `12`. Control sizes use the same unit (44 `11`, 48 `12`, 52 `13`, 56 `14`, 72 `18`) or the size token (`h-(--h-input)`).
  - Type roles are `@utility type-<role>` blocks (`type-caption`, `type-small`, `type-body`, `type-control`, `type-lead`, `type-title-s`, `type-title-m`, `type-title-l`, `type-display-s`, `type-price`, `type-kpi`, `type-hero`, `type-404`, `type-prose`), never `--text-*` theme keys, because `cn()` reads an unknown `text-*` class as a colour and drops one of the pair. Weight overrides use `font-bold` (700) and `font-extrabold` (800).
- **Focus**: the approved rule `:where(a, button, input, select, textarea, [tabindex]):focus-visible`, widened with `[role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="option"]`, stays unlayered so it beats Tailwind utilities; `.on-dark` uses the same widened selector with the yellow outline; `:where([tabindex="-1"]):focus-visible { outline: none }` exempts programmatic targets. Every restyled component drops its `focus-visible:ring-*`, `outline-none`, and `outline-hidden` classes. Selected states (radio card, thumbnail) use `border`, never `outline`, so the focus rule cannot hide them. Rows that scroll (`overflow-x: auto`) get 4px padding so an outline is never clipped.
- **States**: hover `brightness-95`, pressed `brightness-90` (`active:`), on the yellow and outline buttons only (ink on yellow stays far above 4.5:1 at those levels), disabled per `design.md` section 6 with `cursor-not-allowed`. A loading button is the caller's job: it passes `disabled` and swaps the label for the page file's loading label. Base UI link buttons use `render={<Link …/>}` with `nativeButton={false}` (never `asChild`).
- **Reduced motion**: the skeleton pulse reads `--dur-skeleton`, which is `0s` under `prefers-reduced-motion: reduce`.

### Files and where they live

| Path | What |
|---|---|
| `docs/design/design.md`, `handoff.md`, `pages/*.md` | The approved design, moved from `UI/` |
| `src/app/tokens.css`, `src/app/globals.css` | Tokens, Tailwind lock, base styles |
| `src/app/fonts.ts` | `almarai` from `next/font/google`, exported once, used by every layout |
| `components.json` | shadcn config: base `base`, RTL on, icon library `lucide`, CSS file `src/app/globals.css`, aliases to `@/components/ui` |
| `src/components/ui/*` | The shadcn components in AC-7, restyled |
| `src/components/` | Shared custom controls: `chip.tsx`, `removable-chip.tsx`, `radio-card.tsx`, `quantity-stepper.tsx`, `empty-state.tsx`, `error-state.tsx`, `loading-status.tsx`, `image-placeholder.tsx`, `skip-link.tsx`, `ltr.tsx`, `icons/whatsapp-icon.tsx`, `icons/directional.tsx` |
| `src/lib/utils.ts` | `cn()` with the extended merge config |
| `src/app/(gallery)/design-system/` | Gallery route group with its own bare `layout.tsx` (html, font, `DirectionProvider`, no shell) and `page.tsx` |
| `src/server/env.ts` | Zod parse of server variables (`DESIGN_SYSTEM_PAGE`) |
| `src/app/tokens-contrast.test.ts` | Recomputes the tokens contrast table (AC-20) |
| `src/features/shell/components/` | `site-header.tsx`, `menu-sheet.tsx`, `cart-button.tsx`, `info-strip.tsx`, `site-footer.tsx`, `bottom-bar.tsx`, `whatsapp-fab.tsx`, `admin-side.tsx` |
| `src/features/shell/nav.ts` | Pure: `activeTab(pathname)`, `activeAdminLink(pathname)`, the link lists |
| `src/features/shell/server/shop-contact.ts` | `getShopContact()`: reads `shop_settings` through `getDb()`, `server-only`, React `cache()` per request |
| `src/lib/routes.ts` | The URL map below as typed builders (`routes.product(slug)`, ...) |
| `src/lib/whatsapp.ts` | Pure: `whatsappUrl(number, text)` |
| `src/lib/public-env.ts` | Zod parse of `NEXT_PUBLIC_WHATSAPP_NUMBER` (adds `zod` if not installed) |
| `public/brand/skf-logo.<ext>` | The logo, downloaded from the canvas asset `3440a2c899f0d767dc8c1603e3d1c560` |
| `src/design-rules.test.ts` | The design rule test (AC-6) |
| `e2e/design-system.spec.ts`, `e2e/shell.spec.ts` | Playwright with `@axe-core/playwright` |

Every user facing string goes in `src/i18n/messages/ar.json`: shell strings under `Shell`, dashboard shell under `AdminShell`, gallery copy under `DesignSystem`, using the exact copy from `docs/design/`. The wording this spec adds (menu heading "القائمة", "إغلاق", the cart count label) is for the owner to review, like O-13.

### URL map (adopted from the handoff, products by slug)

Storefront (Arabic, no prefix): `/` · `/c` · `/c/[category]` · `/c/[category]/[sub]` · `/p/[slug]` · `/search?q=` · `/cart` · `/checkout` · `/checkout/done/[number]` · `/orders/[number]` · `/orders/track` · `/account/sign-in` · `/account/orders` · `/account/quick-order` · `/account/drafts` · `/policies/privacy` · `/policies/terms` · `/policies/returns` · `/design-system` (gallery, flagged).
Dashboard: `/admin` · `/admin/orders` · `/admin/orders/[number]` · `/admin/customers` · `/admin/reports` · `/admin/products` · `/admin/products/new` · `/admin/products/[id]` · `/admin/products/import` · `/admin/categories` · `/admin/homepage` · `/admin/settings`; `/admin/login` and `/admin/mfa` per spec 0001.
This feature builds only `/design-system` and the shell; later features build their pages at these paths. Pages linked from the shell but not built yet render the existing not found page.

### Shared parts (build to `handoff.md` section 6; additions here)

- **Layouts**: every layout exports `viewport = { viewportFit: "cover" }`, renders `<html lang="ar" dir="rtl" className={almarai.variable}>`, and wraps the body in `DirectionProvider direction="rtl"` with `isolation: isolate` on the app root (so the sheet's portal stacks above the fixed parts). `src/app/not-found.tsx` gets the font, tokens, and `DirectionProvider` too (its designed content waits for its feature). `src/proxy.ts` skips `/design-system` like `/admin` and `/auth`, so locale routing never rewrites the gallery.
- **Storefront layout** (`src/app/[locale]/layout.tsx`): body holds SkipLink, InfoStrip, SiteHeader, `<main id="main" tabIndex={-1}>`, SiteFooter, BottomBar, WhatsAppFab, all inside the 480px centered column. Body bottom padding is `--h-bottom-bar` plus `env(safe-area-inset-bottom)`; `html` has `scroll-padding-bottom` of the same sum, so a focused field scrolls clear of the bar. The black footer's own bottom padding is at least `calc(var(--fab-bottom) + var(--size-fab) - var(--h-bottom-bar) + var(--sp-12))`, so the float never covers a footer link at the end of the page. The layout parses `NEXT_PUBLIC_WHATSAPP_NUMBER` on the server and passes the number down.
- **BottomBar**: `position: fixed`, inline start and end 0, centered at `--page-max`, explicit height `h-(--h-bottom-bar)` plus the safe area as bottom padding, `z-index: var(--z-bar)`. A client component that reads `usePathname()` from `@/i18n/navigation`. Prop `static` renders it in flow for the gallery. It shows at every width (interim rule for O-1).
- **WhatsAppFab**: fixed, `inset-inline-end: 14px` (`end-3.5`), bottom `calc(var(--fab-bottom) + env(safe-area-inset-bottom))`, `z-index: var(--z-fab)`, inside the 480 column on wide screens; prop `static` for the gallery.
- **MenuSheet**: Sheet on the logical inline start side (rewrite shadcn's physical `side` values and `left-0`/`right-0` and `slide-in-from-left` classes to logical ones), anchored to the viewport, width `min(var(--w-sheet), 85vw)`, white panel with a 1px `border` edge, overlay ink at 50% opacity, no shadow, no blur; links 48px high, `type-control`, ink; `z-index: var(--z-sheet)`; initial focus on the close button; no slide under reduced motion. Feature 9 adds the category list.
- **CartButton**: takes `count?: number`; badge per AC-14.
- **InfoStrip**: a client component that renders only when `usePathname()` is exactly `/`; text `Shell.infoStrip` (copy of `home.01`) for now; feature 25 decides whether its fees come from `delivery_zones`.
- **Search form**: a plain `<form action="/search" method="get">` with `name="q"`; works without JavaScript.

### Icons

| Where | lucide icon (or local) |
|---|---|
| Tabs and menu links: الرئيسية, الأقسام, السلة, بحث, حسابي | `House`, `LayoutGrid`, `ShoppingCart`, `Search`, `User` |
| Header | menu `Menu`, cart `ShoppingCart`, search `Search` |
| Menu sheet | close `X`, policies `FileText`, WhatsApp local `WhatsAppIcon` |
| AdminSide: الرئيسية, الطلبات, العملاء, التقارير, المنتجات, الأقسام, الصفحة الرئيسية, الإعدادات, عرض المتجر | `LayoutDashboard`, `ClipboardList`, `Users`, `ChartColumn`, `Package`, `FolderTree`, `PanelsTopLeft`, `Settings`, `Store` |
| Controls | check `Check`, remove `X`, stepper `Minus` `Plus`, notice `TriangleAlert`, field error `CircleAlert`, empty `PackageOpen`, error `CircleAlert`, placeholder `Lamp`, chevrons `ChevronLeft` `ChevronRight` (flip), trash `Trash2`, filter `ListFilter`, play `Play` |

### Recorded deviations from the package

Added to `docs/design/handoff.md` section 10.2 so the design files and the code agree:
- The header search button is 44x44, not 42x42 (the 44px rule wins).
- BottomBar and the float show at every width inside the 480 column (interim for O-1; the handoff said phone only).
- The footer hides a missing phone or address instead of showing a bracket placeholder (override of the O-6 interim rule for customer facing text).
- The placeholder icon uses `--skf-on-dark-muted` on the product background (the muted grey fails contrast there).
- **AdminSide**: built and shown in the gallery inside a dashboard frame (the flex layout from `design.md` section 4). The `/admin` layout itself, with its guard, is built by the first feature that ships a dashboard page (feature 6); it reuses `almarai` and the same `<html>` attributes.

### Data model sketch

No new table, column, or migration. The footer reads two existing nullable columns of the one row `shop_settings` table from spec 0002: `contact_phone` and `address`.

### State transitions

None.

### API surface

No route handler or Server Action. The surface is one server read and the component props later features rely on.

| Interface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getShopContact()` | server function (`server-only`) | none | `{ phone: string \| null, address: string \| null }` | public data, server only | DB failure or no answer within 1.5 seconds: returns both null, logs the error without values |
| `whatsappUrl(number, text)` | pure function | digits string, Arabic text | `https://wa.me/<digits>?text=<encodeURIComponent(text)>` | none | none (number is validated at startup) |
| `activeTab(pathname)` | pure function | path | `home \| cats \| cart \| search \| account` | none | unknown path gives `home` |
| `<Button>` | component | `variant`, `size`, Base UI `render` for links | | | |
| `<CartButton count?>` | component | `count?: number` | badge and accessible name | | |
| `<QuantityStepper value onValueChange min=1 max=99 size="cart" \| "product">` | component | value, change handler | clamped value | | |
| `<EmptyState>` / `<ErrorState>` | component | `icon`, `title`, `text`, `actions`; ErrorState adds `onRetry`, `whatsappText` | | | |
| `<ImagePlaceholder tone?=1..4>` | component | product background variant | | | |

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| Every component | colours, sizes, radii, type, motion | `src/app/tokens.css` (from the approved tokens) |
| Every shell part | Arabic copy | `ar.json` (`Shell`, `AdminShell`), exact copy from `docs/design/` |
| SiteHeader, Footer, Sidebar | logo image | `public/brand/skf-logo.<ext>`, downloaded from canvas asset `3440a2c899f0d767dc8c1603e3d1c560`; replaced by the owner's original at the same path (O-4) |
| InfoStrip | text and when it shows | `ar.json` key from `home.01` (fixed copy until feature 25); shown only when the path is exactly `/` |
| MenuSheet, Footer, BottomBar, AdminSide | link targets | `src/lib/routes.ts` (the URL map above) |
| Search form | query | the input's value, submitted as `q` with `GET` to `/search` |
| CartButton | count | prop from the caller; none until feature 12 |
| BottomBar | active tab | `activeTab(pathname)`, rules checked in this order, each matching the segment exactly or with a `/` after it: `/cart`, `/checkout` cart; `/c`, `/p` cats; `/search` search; `/account`, `/orders` account; `/` and everything else (policies, not found, as the page files say) home |
| BottomBar | حسابي target | always `/account/orders`; the account area (feature 18) sends a signed out visitor to `/account/sign-in`, so the shell never reads the session |
| AdminSide | active link | `activeAdminLink(pathname)`: longest matching prefix of the eight links, `/admin` only on exact match |
| WhatsAppFab, MenuSheet, ErrorState | WhatsApp number | `process.env.NEXT_PUBLIC_WHATSAPP_NUMBER` read as a literal (so the build inlines it), Zod parsed in `src/lib/public-env.ts`, called from the server layout, passed as a prop (until feature 26 moves it to `shop_settings.whatsapp_number`) |
| CartButton | accessible name | `Shell.cart`, `Shell.cartWithCount` (ICU plural, six forms) |
| EmptyState, ErrorState, LoadingStatus | default copy | `Shell.empty.title`, `Shell.empty.text`, `Shell.error.title`, `Shell.error.text`, `Shell.error.retry`, `Shell.error.whatsapp`, `Shell.loading` (copy from `docs/design/pages` where a page gives it; the rest is new wording for the owner to review) |
| WhatsAppFab, MenuSheet | message | W1 from `handoff.md` section 9, stored in `ar.json` |
| SiteFooter | phone, address | `getShopContact()` from `shop_settings.contact_phone`, `shop_settings.address` |
| Gallery page | on or off | `DESIGN_SYSTEM_PAGE` server variable, `"1"` means on |
| Gallery page | sample prices, codes, counts | `ar.json` `DesignSystem` namespace, the board samples (gallery only, never a real page) |

### Key invariants

- No raw hex colour, physical direction class or property, arbitrary pixel value, shadow, gradient, blur, or `dark:` variant anywhere in `src/` outside `tokens.css` (AC-6 test).
- Yellow is only a fill under ink text, or text on black. Green is only WhatsApp, "متوفر", and "مدفوع".
- Every tappable element is at least 44 by 44; a row that does not fit wraps, the control never shrinks.
- Status, stock, and selection always carry a word or an icon, never colour alone.
- One `h1` per page; the landmarks in `design.md` section 9.
- Codes, order numbers, and phone numbers render inside `dir="ltr"`.
- No toasts: feedback is in place (label change, inline error, notice).

### Security model

- The shell is public. `getShopContact()` returns the shop's own public contact details, never customer data, and logs no values.
- The gallery page holds only sample data, is `noindex`, and returns 404 in production (the variable is never set there).
- AdminSide is navigation only. Access control stays in `requireAdmin()` inside the `/admin` layout and every admin action (spec 0001); this feature adds no admin route.
- WhatsApp links are built with `encodeURIComponent` on text from `ar.json`; no user input reaches them in this feature.

### Configuration required

- `NEXT_PUBLIC_WHATSAPP_NUMBER` (exists): now required and validated, digits only with country code, 8 to 15 digits (O-24). `.env.example`, `.dev.vars.example`, and the build env in `.github/workflows/ci.yml` (empty today, which would now fail the build) get an obvious test value (`970500000000`).
- `DESIGN_SYSTEM_PAGE` (new, optional, parsed in `src/server/env.ts`): `"1"` turns on `/design-system`. Set in `.env.example`, `.dev.vars.example`, and the CI preview run; never in production.
- Dev dependencies: `@axe-core/playwright`. Dependencies: `lucide-react`, `zod` (if missing), plus what `shadcn init` and `shadcn add` install for Base UI.

### Critical test scenarios

- Happy path: the gallery at 390x844 shows every component and state, axe reports nothing, every target is at least 44 by 44, nothing scrolls sideways, verifies **AC-7**, **AC-9**, **AC-19**, **AC-20**.
- Happy path: on `/`, Tab lands on the skip link first, then the menu button; Enter on the skip link moves focus to `main`; the outline is ink on the page and yellow in the header, verifies **AC-5**, **AC-11**, **AC-20**.
- Happy path: the menu sheet opens, traps focus, closes on Escape, and focus returns to the menu button, verifies **AC-13**.
- Happy path: typing in search and submitting lands on `/search?q=<text>`; the bottom bar marks الرئيسية with `aria-current="page"` on `/`; the float's link decodes to W1 with the configured number, verifies **AC-12**, **AC-16**, **AC-17**.
- Unit: `activeTab` for every path class in the map, including `/cart` giving cart (not cats) and `/policies/terms` giving home; `activeAdminLink` prefers the longest prefix; `whatsappUrl` encodes Arabic and keeps digits only; stepper clamping at 0, 1, 99, 100, and a non number; footer contact line with phone only, address only, both, neither, verifies **AC-9**, **AC-15**, **AC-16**, **AC-17**, **AC-18**.
- Failure case: `getShopContact()` with a failing or hanging database returns nulls within 1.5 seconds and the footer renders without the line, verifies **AC-15**.
- Failure case: a missing or malformed WhatsApp number fails the env parse, verifies **AC-17**.
- Failure case: the design rule test catches a planted `ml-2`, `#ffffff`, `[13px]`, `shadow-md`, `dark:bg-ink`, `text-sm`, `outline-none`, `rounded-tl-card`, and the word شيك in a storefront namespace (fixtures built from string pieces), lets `html-`, `#main`, `start-0`, `text-start`, and the word شيكل pass, and passes on the real tree, verifies **AC-2**, **AC-3**, **AC-6**.
- Reduced motion: with `reducedMotion: "reduce"` the skeleton's animation duration is 0, verifies **AC-21**.
- Permission: with `DESIGN_SYSTEM_PAGE` unset, the gallery's gate calls `notFound()` (unit test of the gate), verifies **AC-19**.
- Dashboard frame: at 1280 the sidebar is beside the content with `aria-current` on the active link; at 390 it sits above the content, verifies **AC-18**, **AC-20**.

## Build plan

Tracer Bullet: milestone 1 pushes one real component through the whole chain (tokens, font, shadcn, the gallery page, the rule test, Playwright with axe, CI) before anything is widened.

1. **Thin thread: tokens to a tested button.** Move `UI/` to `docs/design/` and update the handoff paths and the section 10.2 deviations; `shadcn init` on Base UI with RTL, then replace its theme output with `tokens.css` (new tokens, the Tailwind lock, colour names, `animate-skeleton`), `globals.css`, and `fonts.ts`; confirm the kept utilities still produce CSS; drop the dark mode; extend `cn()`; add `DirectionProvider`, `viewportFit`, and the font to every existing layout including `not-found.tsx`; add and restyle Button only; build the gallery route group behind `DESIGN_SYSTEM_PAGE` (with `src/server/env.ts` and the proxy skip) showing the token pairs, the type roles, and the Button matrix; write the design rule test and the contrast test; add `@axe-core/playwright` and `e2e/design-system.spec.ts` (axe, 44px, no sideways scroll, focus outline); set the flag and the WhatsApp test number in CI. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-19**, **AC-20**.
2. **Widen the primitives.** Add and restyle Input, Textarea, NativeSelect, Field, Label, Checkbox, RadioGroup, ToggleGroup, Badge, Card, Table, Tabs, Skeleton, Alert, Breadcrumb, and Sheet; wire the field error pattern; add each to the gallery with its states; extend the e2e checks. Satisfies **AC-7**, **AC-8**, **AC-21**.
3. **Custom controls and icons.** Add `lucide-react`, the WhatsApp glyph, and the directional icon wrapper; build Chip, RemovableChip, RadioCard, QuantityStepper, EmptyState, ErrorState, LoadingStatus, ImagePlaceholder, Ltr; add `whatsapp.ts` and `public-env.ts` with unit tests; add all to the gallery. Satisfies **AC-9**, **AC-10**, **AC-17**.
4. **Shells on the real storefront.** Download the logo; build `routes.ts`, `nav.ts`, `getShopContact()`, SkipLink, SiteHeader, MenuSheet, CartButton, InfoStrip, SiteFooter, BottomBar, WhatsAppFab, and AdminSide (with a dashboard frame in the gallery); compose the storefront layout (safe area, scroll padding, footer clearance); write `e2e/shell.spec.ts` against `/` (including scrolled to the end: no footer link under the float or the bar) and the unit tests for `nav.ts` and the footer line. Satisfies **AC-11**, **AC-12**, **AC-13**, **AC-14**, **AC-15**, **AC-16**, **AC-17**, **AC-18**, **AC-20**.

## Consequences

**Positive**:
- Every later page builds from tested parts; a wrong colour, radius, or direction class fails a test instead of reaching review.
- Locking Tailwind makes the design the only option, so drift needs a deliberate token change.
- The gallery gives one place to check the whole look against the canvas, at 390 and 1280.

**Negative / tradeoffs**:
- Every shadcn component needs hand restyling (heights, radii, focus, type), and future `shadcn add` output arrives in default styling and must be restyled before use; the rule test flags most leftovers.
- Base UI is newer than Radix: fewer community answers, and some shadcn examples online still show Radix's `asChild` instead of Base UI's `render`.
- The desktop storefront is a 480px column (O-1, interim): it looks sparse on a wide screen until a desktop design exists.
- The info strip shows fixed fees from `ar.json`, which can drift from the editable `delivery_zones` until feature 25 decides its source.
- The footer adds one small database read to every storefront page.

**Neutral**:
- Spec 0001's styling row changes from "shadcn/ui (Radix based)" to Base UI.
- Digits, prices, and dates follow the interim rule (Western digits, `₪1,250`) until feature 5 decides.
- `next/font/google` fetches Almarai at build time, so a build needs network access (it already does for `pnpm install`).

## Follow-up

- [x] Spec 0001: Styling and components row amended to Base UI, with an `**Amended**` line (2026-10-19).
- [ ] Root `AGENTS.md` (via `/sync`): design source `docs/design/`, tokens only through `tokens.css` and `type-*` utilities, `rounded-<name>` radii, no `dark:`, Base UI `render` instead of `asChild`, the design rule test, and `Declined:` Agent Skills for lucide, axe, and Base UI.
- [ ] Feature 5 (Arabic language): decide digits, price, and date formats (O-2); the shell and gallery switch with it.
- [ ] Feature 9: add the category list to the menu sheet.
- [ ] Feature 12: pass the cart count to `CartButton`.
- [ ] Feature 25: decide the info strip's text source (fixed copy, or built from `delivery_zones`).
- [ ] Feature 26: move the WhatsApp number to `shop_settings.whatsapp_number` and make the footer fields editable.
- [ ] Owner: send the original logo files (O-4) and review the wording this spec adds (menu heading, close label, cart count label).
- [ ] Go live: confirm the Almarai licence file on Google Fonts (O-8; it is listed there under the SIL Open Font License) and WhatsApp's brand rules for the glyph (O-7).
- [ ] `/check verify`: run Lighthouse accessibility on the gallery and `/` (target 95, handoff item 19).
- [ ] If axe on the one gallery page gets slow, split it into `/design-system/[section]`.
- [ ] If the footer read shows up in page timings, cache `getShopContact()` across requests (needs an OpenNext cache binding).
- [ ] A desktop and tablet storefront design (O-1), when the owner wants one; the shell's 480px column is the only part that changes.
