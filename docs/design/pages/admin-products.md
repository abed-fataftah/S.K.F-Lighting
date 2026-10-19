# Products list
Route: `/admin/products`
Purpose: Find, open and add products.
Source in scope: Products. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – products

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-products.01` | المنتجات |
| `admin-products.02` | استيراد من جدول |
| `admin-products.03` | + إضافة منتج |
| `admin-products.04` | بحث |
| `admin-products.05` | القسم |
| `admin-products.06` | الكل |
| `admin-products.07` | ثريات ونجف |
| `admin-products.08` | إضاءة جدارية |
| `admin-products.09` | أباجورات |
| `admin-products.10` | متوفر |
| `admin-products.11` | غير متوفر |
| `admin-products.12` | مخفي |
| `admin-products.13` | المنتج |
| `admin-products.14` | الكود |
| `admin-products.15` | السعر |
| `admin-products.16` | الخيارات |
| `admin-products.17` | الحالة |
| `admin-products.18` | ثريا كريستال دائرية |
| `admin-products.19` | [الكود] |
| `admin-products.20` | ثريات ونجف › [القسم الفرعي] |
| `admin-products.21` | من ₪ [السعر] |
| `admin-products.22` | [N] أحجام · [N] ألوان |
| `admin-products.23` | تعديل |
| `admin-products.24` | ثريا معلّقة مودرن |
| `admin-products.25` | ثريا مودرن بحلقتين |
| `admin-products.26` | أباجورة طاولة |
| `admin-products.27` | [اسم المنتج] |
| `admin-products.28` | الاسم أو الكود |
| `admin-products.29` | قائمة المنتجات |

## Layout
Desktop (1280) (designed):
Header h1 "المنتجات" with outline small "استيراد من جدول" and yellow small "+ إضافة منتج". Filter card: search (placeholder "الاسم أو الكود"), select "القسم", toggle chips (الكل، متوفر، غير متوفر، مخفي). Table: image tile 44, المنتج (link, 800), الكود, القسم ("<main> › <sub>"), السعر ("من ₪ [السعر]"), الخيارات ("N أحجام · N ألوان"), الحالة (badge متوفر = ok, غير متوفر = off, مخفي = off), outline small "تعديل".

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: المنتجات) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Product table | Table |  |  |
| Add | Button | primary small | opens the editor empty |

## Data
Products with photo, name, code, category path, lowest price, option counts, status (available when at least one option is available; hidden when the owner unchecks "إظهار المنتج في المتجر").

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.)

## Interactions
1. Search, category and status filters. 2. Product name or "تعديل": opens the editor. 3. Import: opens the import page.

## Accessibility
Empty header cells for the image and the actions get visually hidden labels "صورة" and "إجراء". Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
Bulk actions (hide many, delete many): not designed. Paging: "load more" (O-10).
