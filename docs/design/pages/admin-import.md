# Bulk import
Route: `/admin/products/import`
Purpose: Import products from a spreadsheet and match photos by code.
Source in scope: Spreadsheet import plus bulk photos matched by code. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – import

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-import.01` | استيراد المنتجات |
| `admin-import.02` | العودة للمنتجات |
| `admin-import.03` | 1. جدول المنتجات |
| `admin-import.04` | اسحب ملف CSV أو Excel إلى هنا |
| `admin-import.05` | يجب أن يحتوي كل صف على كود المنتج والاسم والقسم والأحجام والأسعار. |
| `admin-import.06` | اختيار ملف |
| `admin-import.07` | تحميل قالب الجدول |
| `admin-import.08` | 2. صور المنتجات |
| `admin-import.09` | اسحب الصور إلى هنا |
| `admin-import.10` | تُربط كل صورة بالمنتج الذي يطابق كوده اسم الملف. |
| `admin-import.11` | اختيار صور |
| `admin-import.12` | 3. مراجعة النتيجة |
| `admin-import.13` | صفوف سليمة: [N] |
| `admin-import.14` | تحتاج إصلاحاً: [N] |
| `admin-import.15` | صور بلا منتج: [N] |
| `admin-import.16` | الصف |
| `admin-import.17` | المشكلة |
| `admin-import.18` | الإجراء |
| `admin-import.19` | [N] |
| `admin-import.20` | كود مكرر في الجدول |
| `admin-import.21` | يُتجاهل الصف المكرر |
| `admin-import.22` | سعر غير صالح |
| `admin-import.23` | أصلح السعر وأعد الرفع |
| `admin-import.24` | صورة بلا منتج مطابق: [اسم الملف] |
| `admin-import.25` | تحقق من الكود في اسم الملف |
| `admin-import.26` | إلغاء |
| `admin-import.27` | تأكيد الاستيراد |
| `admin-import.28` | مشاكل الاستيراد |

## Layout
Desktop (1280) (designed):
Header h1 "استيراد المنتجات" with outline small "العودة للمنتجات". One column, max 960. Card "1. جدول المنتجات": drop zone (title "اسحب ملف CSV أو Excel إلى هنا", text, yellow small "اختيار ملف") and link button "تحميل قالب الجدول". Card "2. صور المنتجات": drop zone ("اسحب الصور إلى هنا", text, yellow small "اختيار صور"). Card "3. مراجعة النتيجة": three read-only count chips (صفوف سليمة، تحتاج إصلاحاً، صور بلا منتج), and a table (الصف, المشكلة, الإجراء). Bottom: outline small "إلغاء", yellow small "تأكيد الاستيراد".

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: المنتجات) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Drop zone | custom |  | also works with the file button |
| Result chips | Badge outline large |  | read only |
| Problems table | Table |  |  |

## Data
Uploaded sheet and images. Matching: an image belongs to the product whose code is in the file name. Sheet columns required: code, name, category, sizes, prices (exact column names: O-22).

## States
Before upload: step 3 hidden. Uploading: progress text "جارٍ الرفع". Result: step 3 shown. Confirm disabled while rows need repair. Error: notice banner.

## Interactions
1. Drop or choose a sheet: parses and lists problems. 2. Drop or choose images: matches by code. 3. "تأكيد الاستيراد": creates or updates products; shows a result line. 4. "تحميل قالب الجدول": downloads the template.

## Accessibility
Drop zones are buttons that open the file picker; results announced in `role="status"`. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
O-22 sheet template columns. Whether an existing product is updated or skipped when the code exists: not decided.
