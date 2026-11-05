# Product editor
Route: `/admin/products/new` and `/admin/products/[id]`
Purpose: Create or edit a product with all its data.
Source in scope: Product editor (photos, video, description, dimensions, specifications, size and color options with price and availability). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – product editor

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-product-editor.01` | تعديل منتج |
| `admin-product-editor.02` | إلغاء |
| `admin-product-editor.03` | حفظ المنتج |
| `admin-product-editor.04` | المعلومات الأساسية |
| `admin-product-editor.05` | اسم المنتج |
| `admin-product-editor.06` | كود المنتج |
| `admin-product-editor.07` | القسم الرئيسي |
| `admin-product-editor.08` | ثريات ونجف |
| `admin-product-editor.09` | إضاءة جدارية |
| `admin-product-editor.10` | أباجورات |
| `admin-product-editor.11` | القسم الفرعي |
| `admin-product-editor.12` | مودرن |
| `admin-product-editor.13` | كريستال |
| `admin-product-editor.14` | كلاسيك |
| `admin-product-editor.15` | الوصف |
| `admin-product-editor.16` | الصور والفيديو |
| `admin-product-editor.17` | + إضافة صورة |
| `admin-product-editor.18` | رابط الفيديو (اختياري) |
| `admin-product-editor.19` | الأبعاد والمواصفات |
| `admin-product-editor.20` | القطر (سم) |
| `admin-product-editor.21` | الارتفاع (سم) |
| `admin-product-editor.22` | نوع القاعدة |
| `admin-product-editor.23` | القدرة |
| `admin-product-editor.24` | + إضافة مواصفة |
| `admin-product-editor.25` | الأحجام والأسعار |
| `admin-product-editor.26` | الحجم |
| `admin-product-editor.27` | السعر (₪) |
| `admin-product-editor.28` | التوفر |
| `admin-product-editor.29` | متوفر |
| `admin-product-editor.30` | + إضافة حجم |
| `admin-product-editor.31` | الألوان |
| `admin-product-editor.32` | اللون |
| `admin-product-editor.33` | + إضافة لون |
| `admin-product-editor.34` | إظهار المنتج في المتجر |
| `admin-product-editor.35` | حذف المنتج |
| `admin-product-editor.36` | [اسم المنتج] |
| `admin-product-editor.37` | [الكود] |
| `admin-product-editor.38` | [وصف المنتج] |
| `admin-product-editor.39` | حذف الصورة 1 |
| `admin-product-editor.40` | حذف الصورة 2 |
| `admin-product-editor.41` | حذف الصورة 3 |
| `admin-product-editor.42` | [القطر] |
| `admin-product-editor.43` | [الارتفاع] |
| `admin-product-editor.44` | [السعر] |
| `admin-product-editor.45` | السعر |

## Layout
Desktop (1280) (designed):
Header h1 "تعديل منتج" (new product: "إضافة منتج") with outline small "إلغاء" and yellow small "حفظ المنتج". One column, max 960, cards with 16px gaps, card title 18/800: المعلومات الأساسية (اسم المنتج، كود المنتج، القسم الرئيسي، القسم الفرعي, textarea الوصف 110 high); الصور والفيديو (photo tiles 120x120 each with a 44px round remove button at the start-top corner, dashed add tile 120x120 "+ إضافة صورة", field "رابط الفيديو (اختياري)"); الأبعاد والمواصفات (القطر (سم)، الارتفاع (سم)، نوع القاعدة، القدرة, outline small "+ إضافة مواصفة"); الأحجام والأسعار (table: الحجم, السعر (₪), التوفر checkbox "متوفر"; outline small "+ إضافة حجم"); الألوان (table: اللون, التوفر; "+ إضافة لون"). Bottom row: checkbox "إظهار المنتج في المتجر", outline small "حذف المنتج", yellow small "حفظ المنتج".

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: المنتجات) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Fields | Input, Select, Textarea |  |  |
| Photo tiles | custom | 120x120 | first photo is the main image; drag to reorder is not designed |
| Options tables | Table with inputs | input height 40 | row delete: not drawn, add a trash icon button 44x44 at the end of each row |
| Availability | Checkbox |  |  |

## Data
Product record. Category selects: the second select lists the sub-categories of the first. Code must be unique.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.) Save error: notice banner at the top of the form. Validation: required name, code, category; at least one size with a price.

## Interactions
1. Add photo: opens the file picker (images), uploads, adds a tile. 2. Remove photo: removes the tile after the save. 3. "+ إضافة مواصفة / حجم / لون": adds a row. 4. "حفظ المنتج": validates and saves; stays on the page with the message "تم الحفظ". 5. "حذف المنتج": confirm dialog (wording not designed, O-13). 6. "إلغاء": back to the list.

## Accessibility
Every table input has an `aria-label`. Remove-photo buttons name the photo number. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
Video upload (the board has a link field only): decide link or upload (O-21). Photo reorder and crop: not designed.
