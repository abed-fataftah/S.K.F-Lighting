# S.K.F Lighting: design system

This file lives in `docs/design/`. It is the single source of truth for how the interface looks. Values are exact. Token names are in `tokens.css`. If something here conflicts with a board on the canvas, this file wins (the canvas is a drawing, this is the rule). The few places where the boards differ from this file are listed in `handoff.md` section 10 ("Normalizations").

Stack: Next.js (App Router), Tailwind v4, shadcn/ui with `rtl: true`. Arabic only, right to left, phone first. No dark mode.

## 1. Principles

1. Black and yellow on a warm light page. Black (`--skf-ink`) for header, hero, footer and the dashboard sidebar. Light page (`--skf-page`) for content. White cards on the page.
2. Yellow (`--skf-yellow`) is a FILL with ink text, or text on black. Never yellow text on a light surface.
3. Green (`--skf-whatsapp`) is used for WhatsApp actions only. Nothing else is green except the "in stock" and "paid" text.
4. Flat. No shadows, no gradients in the interface. Borders (1px) separate surfaces.
5. Every tappable thing is at least 44px high and 44px wide. Every control has a visible label or an `aria-label`.
6. Meaning is never carried by color alone: stock, status and selection always have words or an icon too.
7. All amounts, codes, names and photos are real data from the database. In the boards they are placeholders in `[BRACKETS]`.

## 2. Color roles

| Token | Value | Use | Contrast notes |
|---|---|---|---|
| `--skf-yellow` | `#FCF42C` | Primary button fill, selected chip fill, search button, info highlights, focus ring on dark | Ink on it 16.29. As text on white 1.2: forbidden |
| `--skf-yellow-tint` | `#FFF6D0` | Selected radio card, notice banner | Ink on it 17.40 |
| `--skf-ink` | `#111111` | Text, header, hero, footer, sidebar, 1px border of yellow and outline buttons, focus ring | White on it 18.88 |
| `--skf-white` | `#FFFFFF` | Cards, inputs, bottom bar, table body | |
| `--skf-page` | `#F5F5F3` | Page background | Ink on it 17.30 |
| `--skf-muted` | `#555555` | Secondary text | On white 7.46, on page 6.83 |
| `--skf-border` | `#DEDED8` | Card border, table row line, divider | Decorative only |
| `--skf-control-border` | `#8A8A84` | Edge of inputs, chips, outline-less controls | 3.47 on white, 3.18 on page (needs 3) |
| `--skf-chip-border` | `#B9B9B2` | Spec chips (read only) | Decorative |
| `--skf-fill-muted` | `#E2E2DD` | Skeleton, disabled fill, empty-state disc, "off" badge | Muted text on it 5.74 |
| `--skf-on-dark-muted` | `#D8D8D2` | Footer and sidebar links on black | 13.19 |
| `--skf-sidebar-active` | `#2A2A2A` | Active sidebar row | White on it 14.35 |
| `--skf-whatsapp` | `#1E7B4F` | WhatsApp buttons, "in stock" text, "paid" badge | White on it 5.25 |
| `--skf-danger` | `#B3261E` | Error text and error input border, with icon | 6.54 on white |
| `--skf-product-bg-1..4` | `#1B1714` `#27221E` `#1F1B18` `#2A2420` | Background behind product images | Image area only |
| `--skf-swatch-gold/chrome/wood` | `#D4AF37` `#B8BCC2` `#8B5A2B` | Colour dots (black and white use ink and white) | Always with text label |
| `--illus-01..39` | see tokens.css | Drawn placeholder art | Delete with the drawings |

## 3. Typography

Family: Almarai only (`--skf-font`). Weights 400, 700, 800. Load with `next/font/google`, subset `arabic`, `display: swap`. Fallback: Segoe UI, Tahoma, Arial. Licence of Almarai not verified by us: confirm before launch (open item O-8).

| Role | Token | Size / weight / line height | Where |
|---|---|---|---|
| Caption | `--fs-caption` | 12 / 400 or 800 / 1.6 | Code under name, chips, badges, notes, strip |
| Small | `--fs-small` | 13 / 400 / 1.5 | Secondary lines, breadcrumb, helper text, footer, table header |
| Body | `--fs-body` | 14 / 400 or 700 / 1.6 | Default text, table cells, small buttons |
| Control | `--fs-control` | 15 / 400 or 700 | Inputs, outline buttons, tabs |
| Lead | `--fs-lead` | 16 / 800 | Card section titles, primary button text, price on card |
| Title S | `--fs-title-s` | 18 / 800 | Empty and error titles, totals, dashboard section titles |
| Title M | `--fs-title-m` | 22 / 800 / 1.35 | Product title, small page titles |
| Title L | `--fs-title-l` | 24 / 800 / 1.3 | Page title h1 |
| Display S | `--fs-display-s` | 26 / 800 | Dashboard page title |
| Price | `--fs-price` | 28 / 800 | Product price, order number on confirmation |
| KPI | `--fs-kpi` | 30 / 800 / 1.3 | Dashboard numbers |
| Hero | `--fs-hero` | 32 / 800 / 1.25 | Home hero headline (white line plus yellow line) |
| 404 | `--fs-404` | 64 / 800 / 1.1 | Not-found code |

Policy text: 14 / 400 / `--lh-prose` 1.8.

Numerals: the boards use Western digits (0 to 9). The decision (Arabic-Indic or Western) is open (O-2). Interim rule until decided: Western digits, shekel sign before the number with no space (`₪20`, `₪1,250`), comma as thousands separator, no decimals unless the amount has them. Dates: `[التاريخ]` placeholder, format open (O-2). Wrap order numbers and codes in `dir="ltr"` so `26-00123` does not reverse.

## 4. Spacing and layout

Scale (px): 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 34, 48 (`--sp-N`).

Storefront:
- One column, `max-width: 480px` (`--page-max`), centered, page background on both sides. Side padding 16px (`--page-pad`).
- Vertical rhythm: cards separated by 12px (`--sp-12`), product grid gap 10px, chip row gap 8px, form field gap 12px, section gap 24px to 34px.
- Product grid: 2 columns of `minmax(0,1fr)`, gap 10px.
- Desktop and tablet layouts: NOT designed (O-1). Interim: the same column, centered.

Dashboard (designed at 1280):
- Flex row, wrap. Sidebar: `flex: 1 1 220px; max-width: 260px`, black. Content: `flex: 999 1 560px; min-width: 0`, padding `24px 28px 48px`. The sidebar wraps above the content below 780px with no media query. The sidebar is not sticky and not 100vh.
- Forms: single column, `max-width: 960px` (`--admin-form-max`); lists and tables: full width of the content.
- KPI grid: `repeat(auto-fit, minmax(200px, 1fr))`, gap 12px.
- Two-column detail pages: left `flex: 2 1 520px`, right `flex: 1 1 300px`, gap 16px, `align-items: flex-start`.
- Tables scroll sideways inside their own box (`overflow-x: auto`); the page never scrolls sideways.

## 5. Shape

- Radii: 4 (`--skf-radius-chip`), 8 (`--skf-radius-btn`), 10 (`--skf-radius-tile`), 12 (`--skf-radius-card`), 20 (`--skf-radius-hero`, hero only), full (circles).
- Borders: 1px solid `--skf-border` on cards; 1px solid `--skf-control-border` on controls; 1px solid ink on yellow and outline buttons; 2px solid ink on a selected radio card and 2px solid yellow on a selected gallery thumbnail.
- Shadows: none.
- Focus ring: 3px solid ink, offset 2px, on every focusable element (`:focus-visible`). On black surfaces (header, footer, sidebar) the ring is yellow. Never remove it.

## 6. Components

shadcn/ui components are the base. Style them with the tokens above. "Custom" means shadcn has no equivalent.

| Component | Base | Variants and sizes | States |
|---|---|---|---|
| Button, primary | shadcn `Button` | Large: 52px high, radius 12, 16/800, full width. Small: 44px high, radius 8, 14/800, padding 0 16px. Fill yellow, 1px ink border, ink text | default; hover: brightness 0.95; pressed: brightness 0.9; focus: ring; disabled: fill `--skf-fill-muted`, text muted, border same as fill, `cursor: not-allowed`; loading: label replaced by the loading label in the page file, button disabled. (Hover, pressed and loading are build decisions, not drawn on boards.) |
| Button, WhatsApp | `Button` | Large 52px radius 12 15/800 full width; small 44px radius 8 14/700; icon-only 44x44 radius 8. Fill `--skf-whatsapp`, white text, 22px glyph | same states; icon-only needs `aria-label` naming the product or action |
| Button, outline | `Button` variant outline | Large 52px radius 12 15/700; small 44px radius 8 14/700. White fill, 1px ink border, ink text | same states |
| Link button | `Button` variant link | 44px min height, ink text, underlined, 13 or 14px | default, focus |
| Icon button | `Button` size icon | 44x44, no border. On black: white glyph | default, focus (yellow ring on black), pressed |
| Input, Textarea | shadcn `Input`, `Textarea` | Height 48 (textarea 72 to 110), radius 12, 1px `--skf-control-border`, white fill, 15px, padding 0 14px (textarea 12px 14px). Label above: 13px muted, 4px gap | default; focus: ring; disabled: fill-muted; error: border `--skf-danger`, `aria-invalid="true"`, message below (13/700, danger, icon, `role="alert"`, linked by `aria-describedby`) |
| Select | shadcn `Select` (native `<select>` acceptable) | Same box as Input, padding 0 10px | same |
| Checkbox, radio | shadcn `Checkbox`, `RadioGroup` | 22px control, accent ink, row min height 44 | default, checked, focus, disabled |
| Radio card | `RadioGroup` item, custom wrapper | Min height 56, radius 12, padding 8 14. Unselected: white, 1px control border. Selected: fill `--skf-yellow-tint`, 2px ink border | default, selected, focus |
| Chip (toggle) | `ToggleGroup` item | 44 high, radius 8, padding 0 16, 14px. Unselected: white, 1px control border, weight 400. Selected: yellow fill, 1px ink border, weight 800, check icon 16px before the label. `aria-pressed` | default, selected, focus, disabled (fill-muted, struck through, text "غير متوفر") |
| Removable chip | custom | 44 high, radius 8, 13px, white, 1px control border, label plus x icon 16px, `aria-label="إزالة <label>"` | default, focus |
| Status badge | shadcn `Badge` | Radius 4, padding 0 8, 12/800. new: yellow fill, 1px ink border. proc: white, 1px ink border. ok: white, 1px green border, green text. off: fill-muted, muted text | static |
| Spec chip | `Badge` outline | Radius 4, padding 0 6, 12px, 1px `--skf-chip-border` | static |
| Card | shadcn `Card` | White, 1px `--skf-border`, radius 12, padding 14 | static |
| Product card | custom (Card) | See section 7 "Product card" | default, out of stock, added, loading |
| Quantity stepper | custom | Inline, 1px ink border, radius 8, white. Buttons 44x44, glyphs − and + at 22px; value 16/800, min width 36 (cart) or 48 (product). Minimum 1, maximum 99. Value in `aria-live="polite"` | default, focus, minus disabled at 1 |
| Tabs (sign in) | shadcn `Tabs` or two `aria-pressed` buttons | Two buttons, equal width, 48 high, radius 8, 15px. Selected: yellow fill, 1px ink border, 800. Unselected: white, 1px control border | default, selected, focus |
| Breadcrumb | shadcn `Breadcrumb` | 13px muted, links min height 44, current page 700 ink, separator = chevron pointing to the start side (flip in RTL) | default, focus |
| Notice banner | shadcn `Alert` | Fill tint, 1px ink border, radius 12, padding 12 14, 700, warning icon 22px, `role="alert"` | static |
| Skeleton | shadcn `Skeleton` | Fill `--skf-fill-muted`, radius 4 (blocks), 8 (buttons), 12 (large areas); pulse `--dur-skeleton` | animated; static when reduced motion |
| Empty and error card | custom (Card) | White, 1px border, radius 12, padding 28 20 (page) or 32 20, centered. Disc 72 (80 for cart) fill-muted with 34px muted icon, title 18/800, text 14 muted, buttons stacked 10px apart | static; error card has `role="alert"` |
| Table (dashboard) | shadcn `Table` | White box, 1px border, radius 12, `overflow-x: auto`. Header row fill page, 13/700 muted, padding 10 12, `scope="col"`. Cells padding 10 12, row line 1px `--skf-border` | row focus via links |
| Gallery | custom | Main area 300 high, radius 12, dark bg; arrows 44 round white 1px ink; counter 12px white on ink; thumbnails 56x56 radius 8 | selected thumb: 2px yellow border |
| Timeline | custom `ol` | Circle 28; done: ink fill, white check; current: yellow fill, 2px ink border plus "الحالة الحالية" tag; next: white, 2px `--skf-control-border`. Row min height 56, `align-items: flex-start`. Connector 2px wide, starts 4px below the circle and ends 4px above the next (ink when the step is done, `--skf-border` otherwise). Connector must never cross a circle | static |
| Category circle carousel | custom (Embla not required) | Home only. See `pages/home.md` | auto, paused on touch, off for reduced motion |
| Info strip | custom | Home only. Yellow fill, 12/800 ink, centered, padding 8 12 | static |
| Header, footer, bottom bar, WhatsApp float | custom | Section 7 and `handoff.md` section 6 | see there |
| Dashboard sidebar | custom `nav` | Black, links 48 high, padding 0 20, 14px, icon 22. Active: fill `--skf-sidebar-active`, white 800, 4px yellow bar on the inline-start edge. Others `--skf-on-dark-muted` | default, active (`aria-current="page"`), focus (yellow ring) |
| Drop zone | custom | 2px dashed `--skf-control-border`, radius 12, padding 28 16, white, centered | default, drag-over: fill tint, error |

## 7. Patterns

**Forms and validation.** Label above each field. Required fields are validated on submit, not on every key. On error: field border danger, message under the field, focus moves to the first invalid field, a summary is not needed. Messages say what to do ("أدخل الكمية لهذا السطر."). Phone fields: `type="tel"`, `autocomplete="tel"`. Email: `type="email"`. Numbers: `inputmode="numeric"`.

**Product card.** White card, 1px border, radius 12. Image area 128 high on a dark product background; name link 14/800 (line height 1.35); code `الكود: [الكود]` 12px muted; spec chips (max three); price 16/800 with stock text 12px (green "متوفر" or muted "غير متوفر"); button row at the bottom (`margin-top: auto`): yellow small button "أضف للسلة" (flex 1) plus a 44x44 green WhatsApp icon button (6px gap). Out of stock: image at 45% opacity, black label "غير متوفر" at the inline-start top corner of the image, disabled button "غير متوفر"; the WhatsApp button stays and asks about availability. After "add": button turns ink with white text "تمت الإضافة" for 2 seconds (`aria-live="polite"`), then returns.

**Lists and grids.** Product lists: 2-column grid; "تم عرض N من M منتج" then a "عرض المزيد" outline button (48 high). No numbered pagination.

**Navigation.** Storefront phone: header (info strip on Home only, black bar with menu button, logo, cart button; search bar), bottom bar with 5 tabs (الرئيسية، الأقسام، السلة، بحث، حسابي), floating WhatsApp button at 14px from the physical left and 84px from the bottom. In a real build the bottom bar and the float are `position: fixed`; on the boards they sit at the end of the page. Content needs bottom padding for them.

**Empty, error and loading pages.** Use the empty and error card. Loading = skeleton shapes of the real content, `role="status"` with a visually hidden "جارٍ التحميل..." sentence. Error always offers a retry button and a WhatsApp button.

**Inline feedback.** No toasts. Feedback happens in place (button label change, inline error, notice banner).

**WhatsApp messages.** Every WhatsApp button opens `https://wa.me/<number>?text=<encoded Arabic message>`. Message content per action is in `handoff.md` section 9.

## 8. Right to left and language

- `<html lang="ar" dir="rtl">`. Logical properties only: `margin-inline-*`, `padding-inline-*`, `inset-inline-*`, `text-align: start | end`, `border-inline-*`. No `left`, `right`, `ml-*`, `mr-*`, `pl-*`, `pr-*`.
- Icons that flip: chevrons (breadcrumb, carousel arrows, gallery arrows), back arrows. Icons that do not flip: cart, search, WhatsApp, trash, check, close, filter, play.
- Gallery arrows: the arrow on the physical right goes to the previous image, the one on the left goes to the next (reading direction).
- Codes, order numbers, phone numbers: `dir="ltr"` inline.
- Only one language. No language switch.

## 9. Accessibility

- Contrast: every pair is in the table in `tokens.css`; use only those pairs.
- Touch targets 44 by 44 minimum. Footer links and breadcrumb links are 44 high.
- Focus: visible ring everywhere (section 5). Tab order follows the reading order (right to left, top to bottom). The first tab stop on every page is a "تخطي إلى المحتوى" skip link.
- Landmarks: `header`, `nav` (bottom bar `aria-label="التنقل الرئيسي"`, breadcrumb `aria-label="مسار التنقل"`), one `main`, `footer`. One `h1` per page.
- Every input has a `<label>`; icon-only buttons have `aria-label`; toggles use `aria-pressed`; the current sidebar item uses `aria-current="page"`.
- Live regions: loading `role="status"`, errors `role="alert"`, quantity value and "added" button `aria-live="polite"`.
- Motion: the category carousel and skeleton pulse stop under `prefers-reduced-motion: reduce`.
- Images: product photos need Arabic `alt` text with the product name. Decorative drawings: `aria-hidden="true"`.

## 10. Do and do not

1. Do use tokens. Do not write raw hex values or px values that are not in `tokens.css`.
2. Do use yellow only as a fill with ink text (or as text on black). Do not put yellow text on white.
3. Do use green only for WhatsApp, "متوفر" and "مدفوع". Do not use it for success banners or links.
4. Do keep every tap target at 44px or more. Do not shrink a control to fit a row; wrap the row.
5. Do keep every interactive control edge at `--skf-control-border`. Do not use `--skf-border` on inputs or chips.
6. Do write logical CSS only. Do not use left or right.
7. Do show a word with every status color. Do not rely on color alone.
8. Do not add shadows, gradients, blur or new radii.
9. Do not show payment method details, cheque, "no online payment", or any message about price editing anywhere in the storefront. The shop page says only "الدفع عند الاستلام" (pay on receipt). Cheque appears only in the dashboard payments form.
10. Do not show the owner circle anywhere except the Home page. Do not invent prices, hours or claims: show a placeholder and list it as an open item.
