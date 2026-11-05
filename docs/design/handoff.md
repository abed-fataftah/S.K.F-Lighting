# S.K.F Lighting: handoff for Claude Code

Read this file first. Then read `design.md` (rules) and `tokens.css` (values). Then build each page from its file in `pages/`. Everything needed to build the interface is written down. Where a value is not decided, it is listed as an open item (O-number, section 10); do not guess it, ask the owner or use the interim rule written next to it.

Live design canvas (look at it for any doubt about appearance): https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY

## 1. Project summary

S.K.F Lighting is an Arabic-only, right-to-left, phone-first online shop for chandeliers, lamps and electrical products in Palestine (prices in shekels, ₪). Customers and electricians browse, build an order and send it through WhatsApp; every order is also saved. The owner runs orders, payments, customers, products and the home page from one dashboard.

Main tasks:
1. A customer finds a product, chooses size and color, adds to the cart, checks out as a guest or with an account, and the site opens WhatsApp with a ready message.
2. A guest tracks an order with order number plus phone number.
3. An electrician builds an order of up to 30 lines with a quantity on every line, saves named drafts, and sends it.
4. The owner sees new orders flagged, changes status, adjusts line prices on electrician orders, records cash or cheque payments, promotes users to electrician, edits products, imports a spreadsheet with photos matched by code, edits categories, banners, featured products, shop settings and policy texts.
Launch set: everything in `pages/`. After launch (not designed): return request page, loyalty coins page, returns and loyalty dashboard pages.
Payment at launch: paid on receipt (cash or cheque), recorded by the owner in the dashboard. The storefront never mentions cheque or says there is no online payment (it says "الدفع عند الاستلام").

## 2. Stack and files

Source of truth for the stack is spec 0001 (`docs/specs/0001-stack-architecture/`); the design system build is spec 0003 (`docs/specs/0003-design-system-ui-foundation/`). Next.js 16 on Cloudflare Workers (OpenNext), Supabase (Postgres, Auth, Storage), Drizzle, Tailwind v4, shadcn/ui on Base UI with `rtl: true` in `components.json`, mobile first, logical CSS properties only. The paths below are the real ones (spec 0003 closes O-27 for paths).

| File | Lives at |
|---|---|
| `design.md`, `handoff.md`, `pages/*.md`, `tokens.css` (the approved reference copy) | `docs/design/`, not shipped |
| Tokens in code | `src/app/tokens.css` (sections 1 and 3 to 11 of the approved tokens, plus the Tailwind lock and the new tokens of spec 0003), imported by `src/app/globals.css` |
| Font | `src/app/fonts.ts` (Almarai through `next/font/google`, `arabic` and `latin` subsets) |
| shadcn components | `src/components/ui/`; shared custom controls in `src/components/` |
| Shared parts (header, footer, bottom bar, float, sidebar) | `src/features/shell/components/` |
| Translation keys from the page files | `src/i18n/messages/ar.json` (one language only) |
| Logo | `public/brand/` |

shadcn setup: initialized on Base UI with RTL on, so components use logical classes. Arrow-style icons need the flip class in RTL. Load Almarai (400, 700, 800) with `next/font/google`.

## 3. Approved decisions record

- Look: black and yellow on a warm light page, flat, Almarai, radii 4 / 8 / 10 / 12 / 20, 44px touch targets, no shadows, no dark mode. The owner reviewed the boards and approved them page by page on the canvas (final review of all pages: done).
- Logo: the owner's own logo (white "SKF", yellow bolt in the K, yellow "lighting"), used on black only. Brand yellow `#FCF42C` measured from the logo file. The vector in the prototype is a trace made from the owner's PNG.
- Product card: yellow "أضف للسلة" button plus a small 44x44 green WhatsApp icon button (decision of the owner; applies to Home, Category and Search).
- The owner circle (photo and name) appears only on the Home page.
- No cheque or "no online payment" text anywhere in the storefront. The yellow info strip (delivery fees) shows on Home only.
- Free resources only: Almarai (Google Fonts), shadcn/ui, lucide icons (or the hand-drawn inline SVGs on the boards).
- References that shaped the structure: Nuqtat Al-Id'a (category tiles with subtitles, trust points, floating WhatsApp, phone bottom bar), Al Janoub (WhatsApp "didn't find it?" help), Kandil October (WhatsApp ordering with a prefilled message), Lumens (guest order tracking, filters). Inspiration only; nothing copied.
- Prototype method: a clickable design canvas (links and in-page controls work; data is sample).

## 4. Sitemap and navigation

First release, all Arabic, no language prefix. Routes are proposals (O-27).

Storefront: `/` Home; `/c/[category]` and `/c/[category]/[sub]` Category; `/p/[code]` Product; `/search?q=` Search; `/cart` Cart; `/checkout` Checkout; `/checkout/done/[number]` Confirmation; `/orders/[number]` Order; `/orders/track` Order lookup; `/account/sign-in` Sign in; `/account/orders` My orders; `/account/quick-order` and `/account/drafts` (electricians only); `/policies/privacy`, `/policies/terms`, `/policies/returns`; `not-found`.
Dashboard (owner only): `/admin`, `/admin/orders`, `/admin/orders/[number]`, `/admin/customers`, `/admin/reports`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]`, `/admin/products/import`, `/admin/categories`, `/admin/homepage`, `/admin/settings`.

Navigation:
- Phone bottom bar (storefront): الرئيسية `/`, الأقسام `/c`, السلة `/cart`, بحث `/search`, حسابي `/account/orders` (signed out: `/account/sign-in`). Active tab per page is in each page file.
- Header: menu button (content not designed, O-15), logo to `/`, cart button to `/cart`, search field submitting to `/search?q=`.
- Footer links: the three policy pages.
- Dashboard sidebar: الرئيسية, الطلبات, العملاء, التقارير, المنتجات, الأقسام, الصفحة الرئيسية, الإعدادات, then "عرض المتجر" to `/`.
- Access: `/admin` needs the owner role. Electrician pages need the electrician role. Other signed-in pages need any account.

## 5. Page index

| Page | File | Route | Summary |
|---|---|---|---|
| Home | `pages/home.md` | `/` | A visitor finds a category or product and starts an order in one tap. |
| Category (product list) | `pages/category.md` | `/c/[category]` | Browse the products of one category, narrow them with filters, add to cart. |
| Product | `pages/product.md` | `/p/[code]` | Choose size and color, see the price and stock, add to the cart or ask on WhatsApp. |
| Search results | `pages/search.md` | `/search?q=<text>` | Show products that match a name or a code. |
| Cart | `pages/cart.md` | `/cart` | Review the items, fix quantities, remove unavailable items, continue to checkout. |
| Cart (empty) | `pages/cart-empty.md` | `/cart` | Tell the visitor the cart is empty and send them to products. |
| Checkout | `pages/checkout.md` | `/checkout` | Give contact details, choose pickup or delivery, confirm, and send the order on WhatsApp. |
| Order confirmation | `pages/confirmation.md` | `/checkout/done/[number]` | Confirm the order was received, show the order number, explain the next steps, offer to open WhatsApp again. |
| Order (details and guest lookup) | `pages/order.md` | `/orders/[number]` | See the status, items and totals of one order; ask to cancel or contact the shop. |
| Sign in, register, reset password | `pages/sign-in.md` | `/account/sign-in` | Let a customer or electrician sign in, create an account or reset the password. |
| My orders | `pages/my-orders.md` | `/account/orders` | A signed-in user sees all their orders. |
| Quick order (electricians) | `pages/quick-order.md` | `/account/quick-order` | An electrician builds an order of up to 30 lines quickly, saves it as a named draft or sends it. |
| Drafts (electricians) | `pages/drafts.md` | `/account/drafts` | An electrician sees named drafts, opens or deletes them. |
| Not found | `pages/not-found.md` | `not-found` page | Tell the visitor the page does not exist and offer ways forward. |
| Policy pages | `pages/policies.md` | `/policies/privacy`, `/policies/terms`, `/policies/returns` | Show the privacy policy, terms and return policy written by the owner. |
| Dashboard home | `pages/admin-home.md` | `/admin` | The owner sees what needs attention: new orders first. |
| Orders list | `pages/admin-orders.md` | `/admin/orders` | Find and open orders; new orders are flagged. |
| Order details | `pages/admin-order-details.md` | `/admin/orders/[number]` | Review an order, adjust line prices (electrician orders), change status, record payments, contact the customer. |
| Customers | `pages/admin-customers.md` | `/admin/customers` | See registered users and promote chosen users to electrician. |
| Sales reports | `pages/admin-reports.md` | `/admin/reports` | See sales over a period. |
| Products list | `pages/admin-products.md` | `/admin/products` | Find, open and add products. |
| Product editor | `pages/admin-product-editor.md` | `/admin/products/new` and `/admin/products/[id]` | Create or edit a product with all its data. |
| Bulk import | `pages/admin-import.md` | `/admin/products/import` | Import products from a spreadsheet and match photos by code. |
| Categories | `pages/admin-categories.md` | `/admin/categories` | Manage the two category levels. |
| Homepage editor | `pages/admin-homepage.md` | `/admin/homepage` | Control banners, featured products and the categories shown on Home. |
| Shop settings | `pages/admin-settings.md` | `/admin/settings` | Edit contact details, delivery fees, owner profile and policy texts. |

## 6. Shared components and patterns

Defined once here. Page files refer to them by name.

**SiteHeader** (all storefront pages). Not sticky. Black block, side padding 8: row with menu button 44x44 (icon 26, white, start side), logo link (image 52px high, `alt="S.K.F lighting"`, links to `/`), cart button 44x44 (icon 26, white, end side); row padding 8 8 6. Under it, still black: search block padding 4 14 16 holding a white label, radius 12, 52 high, padding-inline-end 6: `type="search"` input (flex 1, 15px, no border, padding 0 16, placeholder "ابحث بالاسم أو الكود") and a yellow 42x42 search button (radius 8, `aria-label="بحث"`). The Home page adds the yellow info strip above it (12/800, padding 8 12, centered). Focus ring on this block is yellow. Cart count badge: not designed (O-26).

**SiteFooter.** Black, padding 24 18 24, text 13 `--skf-on-dark-muted`: logo 64px high at the end side; line `[رقم الهاتف] · [العنوان]` (margin 12 0 14); three links, each 44px high, flex, centered vertically: سياسة الخصوصية, الشروط والأحكام, سياسة الإرجاع. Margin-top 34 from the content.

**BottomBar.** Phone only. White, 1px top border `--skf-border`, padding 6 4 10, five tabs with equal share, each min 56x44: icon 24 over a 12px label. Active tab: ink text, weight 800, a 3px yellow underline under the label. Others: muted text. `nav aria-label="التنقل الرئيسي"`. Fixed to the bottom in the build.

**WhatsAppFab.** 52px circle, `--skf-whatsapp`, white 26px glyph, 2px white border, `z-index: var(--z-fab)`, 14px from the physical left edge (`inset-inline-end: 14px` in RTL), 84px above the bottom (above the bottom bar). `aria-label="واتساب"`, opens message W1.

**ProductCard**, **Chip**, **Radio card**, **Stepper**, **Timeline**, **Empty and error card**, **Skeleton**: `design.md` sections 6 and 7.

**AdminSide** (all dashboard pages). Black, padding 20 0 24: logo 56px high with the caption "لوحة التحكم" (12px `--skf-on-dark-muted`) in a block padded 0 20 18; `nav` of eight links (48 high, padding 0 20, icon 22, text 14, 12px gap); at the bottom the outline button "عرض المتجر" (44 high, 1px `--skf-on-dark-muted` border, white text, radius 8) inside padding 18 20 0. Active link: `--skf-sidebar-active` fill, white 800, 4px yellow bar on the inline-start edge, `aria-current="page"`.

**Dashboard page header.** Row, wrap, space between, gap 12, margin-bottom 20: h1 (26/800) at the start and action buttons (gap 8) at the end.

**Dashboard table, filter bar, KPI card, drop zone:** `design.md` section 6.

## 7. Build order

1. Project setup: tokens, Almarai, RTL, shadcn components (Button, Input, Textarea, Select, Checkbox, RadioGroup, Badge, Card, Table, Tabs, Skeleton, Alert, Breadcrumb).
2. Shared parts: SiteHeader, SiteFooter, BottomBar, WhatsAppFab, empty and error card, skeleton.
3. Data layer for products and categories (needs the data model, spec 0002).
4. Storefront browse: Category, Product, Search, Home (Home needs categories, featured products and settings).
5. Cart, Checkout, Confirmation (need products; need the WhatsApp message builder, section 9).
6. Accounts: Sign in, My orders, Order page and lookup (need orders and auth).
7. Electrician pages: Quick order, Drafts (need the role and drafts table).
8. Support pages: Policy, Not found, Empty cart.
9. Dashboard shell (AdminSide), then Orders, Order details (payments), Customers, Products, Product editor, Import, Categories, Homepage, Settings, Reports, Dashboard home.
10. Acceptance checklist (section 11).

## 8. Content and assets

| Item | Status | What is needed |
|---|---|---|
| Logo | Final (owner's own); the traced SVG is embedded as the logo asset on the canvas | The owner's original files; dark-background version only is used (header, footer, sidebar). Size on screen: 52px, 64px, 56px high |
| Fonts | Almarai, free | Licence text to be confirmed (O-8) |
| Category photos | Placeholder drawings | One square photo per main category, min 400x400 px |
| Product photos and videos | Placeholder drawings | Per product: up to the number the owner uploads, min 800x800 px, square; optional video |
| Hero image | Placeholder chandelier drawing | Decision on photo or drawing (O-5) |
| Owner photo and name | Placeholder | Square photo min 400x400 px, name |
| Banners | Not designed | Size and layout (O-9) |
| Phone, WhatsApp number, address, email | Placeholders in brackets | From the owner |
| Policy texts (3) | Placeholders | From the owner, Arabic |
| SEO texts and share image | Placeholders | Home description, category descriptions, share image 1200x630 |
| Prices, codes, names, specs | Placeholders and samples | Real data from the owner's catalog |
| Icons | Hand-drawn inline SVG on the boards | Use lucide-react (free) with the same meaning; WhatsApp glyph from a licensed source (O-7) |
| Delivery fees | Final: West Bank ₪20, the 1948 areas ₪70 | Editable in Shop settings |

Samples on the boards that are NOT real: order numbers like `26-00123`, status names, product names, spec values (E27, 60 W, Ø 60 سم), counts ("24 منتج", "12 نتيجة"), report numbers and bars, the drawn chandeliers and category scenes.

## 9. Key flows

**Order as a guest (customer).**
1. Product page: choose size, color, quantity; "أضف للسلة" (success: button shows "تمت الإضافة"). Failure: out of stock options are disabled, so adding them is impossible.
2. Cart: review. Success: "متابعة الطلب". Failure: an unavailable line disables the button until it is removed.
3. Checkout: name and phone; pickup or delivery (zone, address); notes; "تأكيد وإرسال عبر واتساب". Success: the order is saved with number `YY-NNNNN`, WhatsApp opens with W5, the browser goes to the confirmation page. Failure: validation errors under the fields; save error banner; the cart is kept.
4. Confirmation: shows the number; the green button re-opens WhatsApp.
5. The owner sees the order flagged "جديد" in the dashboard and messages the customer.

**Track an order.** `/orders/track`: order number plus phone. Success: order page. Failure: error box; repeated failures are limited (server rule) and the box says so. Signed-in users see all orders in `/account/orders`.

**Electrician order.** Quick order: up to 30 lines, a quantity on every line (blocked with an inline error otherwise); "حفظ كمسودة" needs a name; "إرسال الطلب عبر واتساب" saves and sends (W5). The owner may change line prices in the dashboard; the customer sees the final prices on the order page.

**Owner processes an order.** Dashboard order details: edit prices (electrician orders), save status, record each payment (amount, cash or cheque, cheque number, date); the payment status shows none, partial or paid, and the storefront order page shows that status only.

**Cancel.** The customer taps "إلغاء الطلب عبر واتساب" (W6). The owner decides and sets the status "ملغي".

**WhatsApp messages** (all open `https://wa.me/<WhatsApp number from settings>?text=<URL-encoded text>`). Wording is a proposal (O-25); `<...>` is filled from data:
- W1 general: `مرحباً S.K.F lighting، أريد الاستفسار.`
- W2 not found or help: `مرحباً، لم أجد ما أبحث عنه وأحتاج مساعدة.`
- W3 product: `مرحباً، أريد الاستفسار عن المنتج: <الاسم> (الكود: <الكود>) <الحجم> <اللون> <الرابط>`
- W4 availability: `مرحباً، هل المنتج <الاسم> (الكود: <الكود>) متوفر؟ <الرابط>`
- W5 new order: `طلب جديد رقم <الرقم>` then lines `الاسم: <الاسم>`, `الهاتف: <الهاتف>`, `الاستلام: <استلام من المعرض أو توصيل إلى المنطقة والعنوان>`, one line per product `<الاسم> | <الحجم> | <اللون> | الكمية <العدد> | ₪<السعر>`, `الإجمالي: ₪<الإجمالي>`, `رابط الطلب: <الرابط>`.
- W6 cancel: `مرحباً، أريد إلغاء الطلب رقم <الرقم>.`
- W7 order contact: `مرحباً، بخصوص الطلب رقم <الرقم>.`

## 10. Open items and unverified points

### 10.1 Open items (decisions or assets still missing)

| ID | Item | Interim rule |
|---|---|---|
| O-1 | Desktop and tablet layouts of every storefront page are not designed | One centered column, max 480px |
| O-2 | Digit style (Arabic-Indic or Western), price and date formats, Arabic search matching | Western digits, `₪20`, comma thousands, dates as placeholder; search: ignore diacritics and treat أ إ آ ا as one letter (my suggestion) |
| O-3 | Final order status names and their order | Use: جديد، قيد التجهيز، جاهز، تم التسليم، ملغي |
| O-4 | Official logo files | Use the traced SVG on black only |
| O-5 | Real photos: categories, products, hero, owner | Drawings stay as placeholders |
| O-6 | Real copy: phone, WhatsApp number, address, email, policy texts, owner name, SEO texts | Show the bracket placeholders |
| O-7 | Icon set and a licensed WhatsApp glyph | lucide-react; WhatsApp glyph from a licensed source |
| O-8 | Almarai licence not verified | Confirm on Google Fonts before launch |
| O-9 | Banner size, layout and edit dialog | Hero card is the fallback |
| O-10 | Page sizes for lists and "load more" | `[العدد]`: ask the owner |
| O-11 | Add to cart from a card when the product has several options | Use the first available size and color |
| O-12 | Required fields at checkout | Name and phone always; zone and address for delivery |
| O-13 | Wording written by me for states the boards do not show (errors, confirm dialogs, empty states) | Marked "wording is mine" in the page files; owner to review |
| O-14 | Sign-in by email and password (board) vs phone | Email and password |
| O-15 | Menu button content, account menu | Not designed |
| O-16 | "Add to draft" button on catalog cards for electricians | Not designed |
| O-17 | Which KPIs the owner wants on the dashboard home | The four shown |
| O-18 | Can the owner adjust prices on customer orders, or only electrician orders | Electrician orders only |
| O-19 | Customer detail page in the dashboard | Not designed |
| O-20 | Report export format | CSV |
| O-21 | Product video: link or upload | Link field (as on the board) |
| O-22 | Import sheet columns and update-or-skip rule for existing codes | Ask the owner |
| O-23 | Category edit dialog | Not designed |
| O-24 | WhatsApp number format | Digits with country code, no plus or spaces |
| O-25 | WhatsApp message wording (W1 to W7) | As written in section 9 |
| O-26 | Cart item count badge on the header cart button | Not designed |
| O-27 | `architecture.md`, the scope files and the specs were not available: routes, file paths, translation file name and scope feature numbers are proposals | Reconcile before building |
| O-28 | Owner circle and owner fields in Shop settings are a scope addition | Build only after the owner confirms |
| O-29 | Return request, loyalty coins, returns and loyalty dashboard pages | Not designed (after launch) |

### 10.2 Normalizations (where the boards differ from `design.md`; build with `design.md`)

1. Font sizes 17, 19 and 21 appear in a few places on the boards: build 17 as 18, 19 as 18, 21 as 22.
2. Home has 14px side padding where every other page has 16px: build 16px everywhere (`--page-pad`).
3. Footer link rows on the boards are 31px high: build 44px.
4. Radii 9 and 11 appear once each: build 8 and a circle.
5. The Home page and the dashboard boards have focus rings only through the shared parts: build the global focus ring (`design.md` section 5) on every page.
6. The boards' bottom bar and WhatsApp float sit at the end of the page: build both fixed.
7. Home still carries its own copy of header and footer: use the shared parts.
8. The "owner" and sample notes on boards (for example "رسم توضيحي" in the reports card, "هذا رقم تجريبي" on the confirmation page) are for review only: do not ship them.

Recorded by spec 0003 (the build follows these, not the boards):

9. The header search button is 44x44, not 42x42 (the 44px rule wins).
10. BottomBar and the WhatsApp float show at every width inside the 480px column (interim for O-1; section 6 said phone only).
11. The footer hides a missing phone or address instead of showing a bracket placeholder (overrides the O-6 interim rule for customer facing text).
12. The product image placeholder icon uses `--skf-on-dark-muted` on the product background (the muted grey fails contrast there).
13. AdminSide is built and shown in the design system gallery inside a dashboard frame (the flex layout from `design.md` section 4). The `/admin` layout itself, with its guard, is built by the first feature that ships a dashboard page.

### 10.3 Unverified points

- Contrast ratios are computed by code (table in `tokens.css`). No other accessibility test was run (no screen reader, no keyboard walk-through).
- The designer never saw the rendered boards; the owner reviewed them and sent screenshots of five problems, all fixed. Re-check every page at 390 and 1280 in a real browser.
- Hover, pressed and loading states of buttons are build decisions, not drawn.
- Reference sites were read as text only, not as screenshots.
- Almarai licence, the WhatsApp glyph path and platform guesses about reference sites are not verified.

## 11. Acceptance checklist

Run after building each page, and again for the whole site.

1. Every page renders at 390px with no sideways scroll; dashboard pages render at 1280px and at 390px (sidebar wraps above the content).
2. `<html lang="ar" dir="rtl">`; no `left`, `right`, `ml-`, `mr-`, `pl-`, `pr-` in the code (search for them).
3. Only tokens from `tokens.css` are used: search the code for `#` followed by six characters outside `tokens.css`; there must be none.
4. Every tappable element measures at least 44 by 44 px (check with the browser inspector on the cart, checkout, footer, bottom bar and filter chips).
5. Every pair of text and background colors is in the contrast table in `tokens.css`.
6. Tab through each page: focus ring visible everywhere, yellow on black surfaces; order follows reading order; the first stop is the skip link.
7. Every input has a label; every icon-only button has an `aria-label`; the current sidebar item has `aria-current="page"`.
8. Each page has one `h1` and the landmarks in `design.md` section 9.
9. States exist and look as described: loading, empty, error, out of stock (Category, Product, Cart, Orders).
10. The storefront contains none of these words: "شيك", "بشيك", "دفع إلكتروني", "تعديل الأسعار". The owner circle appears only on Home.
11. Product card: yellow add button plus 44x44 green WhatsApp icon button on Home, Category and Search; out-of-stock card has the disabled button and the label.
12. Checkout: choosing delivery shows zone and address; the fee row shows `₪20` or `₪70`; pickup shows "بدون رسوم".
13. Order page: the timeline connector lines never cross a circle; the current step has the tag "الحالة الحالية".
14. Quick order: the 31st line cannot be added; a line with no quantity blocks sending and shows the inline error.
15. WhatsApp buttons open `wa.me` with the message for that page (W1 to W7), URL-encoded Arabic.
16. With `prefers-reduced-motion: reduce`: no carousel auto-advance, no skeleton pulse.
17. Order numbers, codes and phone numbers display left to right inside the right-to-left text and do not reverse.
18. Dashboard: tables scroll inside their own box; the page never scrolls sideways at 1280 or 390.
19. Lighthouse accessibility score of at least 95 on Home, Category, Product, Checkout and Dashboard home.
20. `noindex` is present on cart, checkout, order, account, search and dashboard pages; Home, Category, Product and policy pages are indexable with the titles in their page files.
