# Dashboard home
Route: `/admin`
Purpose: The owner sees what needs attention: new orders first.
Source in scope: Dashboard home (new orders flagged). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – home

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-home.01` | الرئيسية |
| `admin-home.02` | عرض المتجر |
| `admin-home.03` | لديك [N] طلبات جديدة بانتظار المراجعة |
| `admin-home.04` | عرض الطلبات الجديدة |
| `admin-home.05` | طلبات جديدة |
| `admin-home.06` | [N] |
| `admin-home.07` | تحتاج مراجعة |
| `admin-home.08` | قيد التجهيز |
| `admin-home.09` | مبيعات هذا الشهر |
| `admin-home.10` | ₪ [المبلغ] |
| `admin-home.11` | منتجات غير متوفرة |
| `admin-home.12` | أحدث الطلبات |
| `admin-home.13` | رقم الطلب |
| `admin-home.14` | العميل |
| `admin-home.15` | الهاتف |
| `admin-home.16` | النوع |
| `admin-home.17` | الاستلام |
| `admin-home.18` | الحالة |
| `admin-home.19` | الدفع |
| `admin-home.20` | الإجمالي |
| `admin-home.21` | التاريخ |
| `admin-home.22` | [الاسم] |
| `admin-home.23` | [رقم الهاتف] |
| `admin-home.24` | عميل |
| `admin-home.25` | توصيل |
| `admin-home.26` | جديد |
| `admin-home.27` | لم يُدفع |
| `admin-home.28` | ₪ [الإجمالي] |
| `admin-home.29` | [التاريخ] |
| `admin-home.30` | كهربائي |
| `admin-home.31` | استلام |
| `admin-home.32` | دفعة جزئية |
| `admin-home.33` | تم التسليم |
| `admin-home.34` | مدفوع |
| `admin-home.35` | إجراءات سريعة |
| `admin-home.36` | + إضافة منتج |
| `admin-home.37` | استيراد منتجات من جدول |
| `admin-home.38` | تعديل الصفحة الرئيسية |
| `admin-home.39` | إعدادات المتجر |

## Layout
Desktop (1280) (designed):
Inside the content column: page header (h1 "الرئيسية" 26/800, small outline button "عرض المتجر"); highlight bar (tint fill, 1px ink border, radius 12, padding 14 16; text 16/800 "لديك [N] طلبات جديدة بانتظار المراجعة"; yellow small button "عرض الطلبات الجديدة"); KPI grid (four cards: "طلبات جديدة", "قيد التجهيز", "مبيعات هذا الشهر", "منتجات غير متوفرة"; label 13 muted, number 30/800, note 12 muted); h2 "أحدث الطلبات" 18/800 and an orders table (4 rows); h2 "إجراءات سريعة" and four buttons.

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: الرئيسية) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| KPI card | Card |  | static |
| Orders table | Table |  | row link opens the order |
| Quick actions | Button | yellow small / outline small | "+ إضافة منتج" opens the product editor; the others open import, homepage, settings |

## Data
Counts and sums from orders (month in Asia/Jerusalem). The highlight bar is hidden when there are no new orders. KPI values are `[N]` and `₪ [المبلغ]` placeholders on the board.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.)

## Interactions
1. "عرض الطلبات الجديدة": orders list filtered to "جديد". 2. Row order number: order details. 3. Quick action buttons: their pages.

## Accessibility
Sidebar `aria-current="page"` on "الرئيسية". Table has `aria-label`. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
Which KPIs the owner wants: the four shown are my proposal (O-17). Refresh or live updates for new orders: not designed.
