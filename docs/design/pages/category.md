# Category (product list)
Route: `/c/[category]` (second level: `/c/[category]/[sub]`); filters in the address: `?price_min=&price_max=&size=&color=` (names are a proposal)
Purpose: Browse the products of one category, narrow them with filters, add to cart.
Source in scope: Catalog (two category levels, filters by price, size and colour shown in the page address). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Category – mobile, Category – شاشة التصفية, Category – جارٍ التحميل, Category – لا نتائج, Category – خطأ في التحميل

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `category.01` | تصفية المنتجات |
| `category.02` | السعر (₪) |
| `category.03` | من |
| `category.04` | إلى |
| `category.05` | الحجم |
| `category.06` | اللون |
| `category.07` | مسح الكل |
| `category.08` | عرض 18 منتج |
| `category.09` | الرئيسية |
| `category.10` | ثريات ونجف |
| `category.11` | مودرن وكريستال وكلاسيك |
| `category.12` | تصفية |
| `category.13` | غير متوفر |
| `category.14` | الكود: [الكود] |
| `category.15` | ₪ [السعر] |
| `category.16` | تم عرض 6 من 24 منتج |
| `category.17` | عرض المزيد |
| `category.18` | جارٍ تحميل المنتجات |
| `category.19` | لا توجد منتجات مطابقة |
| `category.20` | جرّب تغيير السعر أو اللون، أو امسح التصفية لرؤية كل المنتجات. |
| `category.21` | مسح التصفية |
| `category.22` | اسألنا عبر واتساب |
| `category.23` | تعذّر تحميل المنتجات |
| `category.24` | تحقق من الاتصال بالإنترنت ثم حاول مرة أخرى. |
| `category.25` | إعادة المحاولة |
| `category.26` | اطلب عبر واتساب |
| `category.27` | لم تجد ما تبحث عنه؟ |
| `category.28` | أرسل لنا الكود أو صورة المنتج على واتساب. |
| `category.29` | إغلاق التصفية |
| `category.30` | مسار التنقل |
| `category.31` | إزالة {{a.label}} |
| `category.32` | واتساب |
| `category.33` | حتى 300 ₪ |
| `category.34` | اللون: ذهبي |
| `category.35` | ذهبي |
| `category.36` | الكل |
| `category.37` | مودرن |
| `category.38` | كريستال |
| `category.39` | كلاسيك |
| `category.40` | 30 سم |
| `category.41` | 40 سم |
| `category.42` | 60 سم |
| `category.43` | 80 سم |
| `category.44` | أسود |
| `category.45` | أبيض |
| `category.46` | كروم |
| `category.47` | خشبي |
| `category.48` | ثريا كريستال دائرية |
| `category.49` | Ø 60 سم |
| `category.50` | ثريا معلّقة مودرن |
| `category.51` | Ø 40 سم |
| `category.52` | ثريا كريستال متدرّجة |
| `category.53` | Ø 50 سم |
| `category.54` | ثريا كلاسيك ذهبية |
| `category.55` | Ø 70 سم |
| `category.56` | ثريا مودرن بحلقتين |
| `category.57` | Ø 80 سم |
| `category.58` | ثريا معلّقة بقبة |
| `category.59` | Ø 35 سم |
| `category.60` | متوفر |
| `category.61` | تمت الإضافة |
| `category.62` | أضف للسلة |
| `category.63` | اسأل عن توفر |
| `category.64` | عبر واتساب |
| `category.65` | اطلب |
| `category.66` | 0 منتج |
| `category.67` | جارٍ التحميل |
| `category.68` | 24 منتج |

## Layout
Mobile (390) (designed):
1. Header (shared).
2. Breadcrumb: `الرئيسية` link, chevron, current category in 700 ink. Links 44 high.
3. Title block (padding 0 16 12): h1 24/800 with the category name; subline 13 muted listing the sub-categories.
4. Sub-category chips: one horizontal row, scrolls sideways, gap 8, padding 0 16 4. First chip "الكل". Chips are toggle chips.
5. Toolbar (padding 12 16 4): filter button at the start (white, 1px ink border, radius 8, 44 high, filter icon, label "تصفية", yellow count badge 22px when filters are active); result count 13 muted at the end.
6. Applied filters: wrap row of removable chips plus link button "مسح الكل" (padding 8 16 0).
7. Product grid: 2 columns, gap 10, padding 12 16 0. Product card pattern.
8. Below the grid: "تم عرض N من M منتج" (13 muted, centered) and the "عرض المزيد" outline button 48 high (padding-top 22).
9. Help card (padding 28 16 0): 40px yellow icon tile with WhatsApp icon, "لم تجد ما تبحث عنه؟", line, green small button "اسألنا عبر واتساب".
10. Footer, bottom bar (tab: الأقسام), float.
Filters screen (replaces the whole page while open): black top bar (close button 44x44 at the start, h1 "تصفية المنتجات" 18/800 white); body padding 16 with three white cards (السعر: two number fields "من" and "إلى", each with a 13px label; الحجم: toggle chips; اللون: toggle chips with a color dot 18px and a check when selected); bottom action bar (white, 1px top border, padding 12 16): outline button "مسح الكل" (flex 1) and yellow button "عرض N منتج" (flex 1.6), both 52 high.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: cats) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Breadcrumb | Breadcrumb |  | home link `/` |
| Sub-category chip | ToggleGroup item | toggle chip | one selected at a time; "الكل" clears |
| Filter button | Button | outline small + count badge | opens the filters screen |
| Applied chip | custom | removable chip | removes that filter |
| Product card | custom | default / out of stock / added | `design.md` section 7 |
| Load more | Button | outline, 48 high | appends the next page of products in place |
| Help card | Card |  | WhatsApp message W2 |
| Filters screen | full-screen route or Dialog (fullscreen) |  | focus is trapped, close returns focus to the filter button |
| Price fields | Input | number, `inputmode="numeric"` |  |

## Data
Products of the category (and sub-category): name, code, spec chips (base type, power, size), price (smallest price over sizes, prefix not shown on card in the board), stock text, first photo. Count `M` is the total of matching products; `N` is how many are shown. Filter options: sizes and colours that exist in the category. Price range placeholders `0` and `1000` are samples. Page size for "load more": `[عدد المنتجات في الصفحة]` (O-10).

## States
Default list (board 1). Filters screen (board 2). Loading: header and title stay; six skeleton cards in the grid, `role="status"`, hidden text "جارٍ تحميل المنتجات". No results: card with search icon disc, title "لا توجد منتجات مطابقة", text, yellow button "مسح التصفية" (removes all filters), green button "اسألنا عبر واتساب". Error: card with warning icon, title "تعذّر تحميل المنتجات", yellow button "إعادة المحاولة" (reloads the list; shows loading state), green button "اطلب عبر واتساب"; toolbar and applied row are hidden. Out of stock card: see product card pattern.

## Interactions
1. Tap a sub-category chip: selects it (yellow, check not shown on this row) and reloads the grid.
2. Tap "تصفية": opens the filters screen (page scroll locked).
3. In filters: tap a size or color chip toggles it; type a price; "مسح الكل" clears all and closes; "عرض N منتج" applies, updates the address, closes, and focus returns to the filter button.
4. Tap the x on an applied chip: removes that filter and reloads.
5. "مسح الكل" link: removes all filters.
6. "أضف للسلة": adds one unit with the first available size and color of that product; the button shows "تمت الإضافة" for 2 seconds. If the product has more than one size or color, adding from the card uses the first available option (decision to confirm, O-11).
7. WhatsApp icon on a card: opens W3 (product question) with name, code and link.
8. Tap a card image or name: opens the product page.
9. "عرض المزيد": loads more.

## Accessibility
One `h1`. Chips use `aria-pressed`. The result count is in a `role="status"` region so a screen reader hears the new count after filtering. Filters screen: heading, close button first in tab order, bottom action bar last.

## SEO
Title: `<category> | S.K.F lighting`. Description: `[وصف القسم]`. Structured data: BreadcrumbList. Filtered addresses: `noindex, follow`; canonical to the unfiltered category.

## Open items
O-1 desktop layout (filters become a side column is a suggestion, not designed). O-10 page size. O-11 add-to-cart from a card when a product has several options. No sorting (not in scope; say if wanted).
