# Homepage editor
Route: `/admin/homepage`
Purpose: Control banners, featured products and the categories shown on Home.
Source in scope: Homepage (banners, featured products, quick links to main categories). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – homepage

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-homepage.01` | الصفحة الرئيسية |
| `admin-homepage.02` | حفظ التغييرات |
| `admin-homepage.03` | البانرات |
| `admin-homepage.04` | تظهر في أعلى الصفحة الرئيسية بالترتيب أدناه. |
| `admin-homepage.05` | [عنوان البانر] |
| `admin-homepage.06` | الرابط: [الرابط] |
| `admin-homepage.07` | فعّال |
| `admin-homepage.08` | تعديل |
| `admin-homepage.09` | + إضافة بانر |
| `admin-homepage.10` | المنتجات المختارة |
| `admin-homepage.11` | إضافة منتج |
| `admin-homepage.12` | ثريا كريستال دائرية |
| `admin-homepage.13` | الكود: [الكود] |
| `admin-homepage.14` | أباجورة طاولة |
| `admin-homepage.15` | ثريا معلّقة مودرن |
| `admin-homepage.16` | الأقسام الظاهرة في الصفحة الرئيسية |
| `admin-homepage.17` | ثريات ونجف |
| `admin-homepage.18` | إضاءة جدارية |
| `admin-homepage.19` | أباجورات |
| `admin-homepage.20` | إضاءة خارجية |
| `admin-homepage.21` | إضاءة داخلية |
| `admin-homepage.22` | إضاءة مخفية |
| `admin-homepage.23` | سبوت لايت |
| `admin-homepage.24` | أفياش ومفاتيح |
| `admin-homepage.25` | نقل لأعلى |
| `admin-homepage.26` | نقل لأسفل |
| `admin-homepage.27` | ابحث بالاسم أو الكود |
| `admin-homepage.28` | إزالة ثريا كريستال دائرية من المنتجات المختارة |
| `admin-homepage.29` | إزالة أباجورة طاولة من المنتجات المختارة |
| `admin-homepage.30` | إزالة ثريا معلّقة مودرن من المنتجات المختارة |

## Layout
Desktop (1280) (designed):
Header h1 "الصفحة الرئيسية" with yellow small "حفظ التغييرات". One column, max 960. Card "البانرات": text 14 muted; rows (banner tile 120x56, title 800, "الرابط: [الرابط]", checkbox "فعّال", ↑ ↓ buttons, outline small "تعديل"); "+ إضافة بانر". Card "المنتجات المختارة": search field "إضافة منتج" and rows (tile 44, name 700, code 12, remove icon button); card "الأقسام الظاهرة في الصفحة الرئيسية": checkbox grid of main categories.

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: الصفحة الرئيسية) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Banner row | custom |  |  |
| Product picker | Command / combobox |  |  |
| Category checkboxes | Checkbox |  |  |

## Data
Banners (image, title, link, active, order), featured product ids (order), category visibility.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.)

## Interactions
1. ↑ ↓ reorder. 2. "فعّال" toggles. 3. "إضافة بانر" and "تعديل": dialog (image upload, title, link; not drawn, O-9). 4. Search adds a product to the featured list. 5. "حفظ التغييرات": saves all.

## Accessibility
Rows are list items; buttons name the item. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
O-9 banner size and the dialog.
