# Orders list
Route: `/admin/orders`
Purpose: Find and open orders; new orders are flagged.
Source in scope: Orders list, flagged new orders. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – orders

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-orders.01` | الطلبات |
| `admin-orders.02` | بحث |
| `admin-orders.03` | النوع |
| `admin-orders.04` | الكل |
| `admin-orders.05` | عميل |
| `admin-orders.06` | كهربائي |
| `admin-orders.07` | الاستلام |
| `admin-orders.08` | توصيل |
| `admin-orders.09` | استلام من المعرض |
| `admin-orders.10` | جديد |
| `admin-orders.11` | قيد التجهيز |
| `admin-orders.12` | جاهز |
| `admin-orders.13` | تم التسليم |
| `admin-orders.14` | ملغي |
| `admin-orders.15` | رقم الطلب |
| `admin-orders.16` | العميل |
| `admin-orders.17` | الهاتف |
| `admin-orders.18` | الحالة |
| `admin-orders.19` | الدفع |
| `admin-orders.20` | الإجمالي |
| `admin-orders.21` | التاريخ |
| `admin-orders.22` | [الاسم] |
| `admin-orders.23` | [رقم الهاتف] |
| `admin-orders.24` | لم يُدفع |
| `admin-orders.25` | ₪ [الإجمالي] |
| `admin-orders.26` | [التاريخ] |
| `admin-orders.27` | استلام |
| `admin-orders.28` | دفعة جزئية |
| `admin-orders.29` | مدفوع |
| `admin-orders.30` | الطلبات الجديدة مميّزة بنقطة صفراء. |
| `admin-orders.31` | رقم الطلب أو رقم الهاتف |
| `admin-orders.32` | قائمة الطلبات |

## Layout
Desktop (1280) (designed):
Header h1 "الطلبات". Filter card (padding 14, gap 12): search field "بحث" (placeholder "رقم الطلب أو رقم الهاتف"), select "النوع" (الكل، عميل، كهربائي), select "الاستلام" (الكل، توصيل، استلام من المعرض), then a row of status toggle chips (الكل، جديد، قيد التجهيز، جاهز، تم التسليم، ملغي). Orders table: columns رقم الطلب, العميل, الهاتف, النوع, الاستلام, الحالة, الدفع, الإجمالي, التاريخ. New orders have a 10px yellow dot (1px ink border) before the number. Note under the table: "الطلبات الجديدة مميّزة بنقطة صفراء."

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: الطلبات) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Filter bar | Input, Select, ToggleGroup |  |  |
| Orders table | Table |  | sorted newest first |

## Data
Orders with customer name and phone, customer type, delivery type, status, payment status, total, date.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.)

## Interactions
1. Type in search: filters by order number or phone. 2. Chips and selects filter. 3. Order number opens the details.

## Accessibility
The dot has no meaning alone: the status badge says "جديد". Add visually hidden text "جديد" next to the dot. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
O-3 status names. Paging or "load more" for long lists: use "load more" (O-10).
