# Sales reports
Route: `/admin/reports`
Purpose: See sales over a period.
Source in scope: Sales reports. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – reports

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-reports.01` | التقارير |
| `admin-reports.02` | تصدير |
| `admin-reports.03` | اليوم |
| `admin-reports.04` | آخر 7 أيام |
| `admin-reports.05` | آخر 30 يوماً |
| `admin-reports.06` | هذا الشهر |
| `admin-reports.07` | فترة مخصصة |
| `admin-reports.08` | إجمالي المبيعات |
| `admin-reports.09` | ₪ [المبلغ] |
| `admin-reports.10` | عدد الطلبات |
| `admin-reports.11` | [N] |
| `admin-reports.12` | متوسط قيمة الطلب |
| `admin-reports.13` | المبلغ المحصّل |
| `admin-reports.14` | المبيعات حسب اليوم |
| `admin-reports.15` | رسم توضيحي: ستظهر هنا أرقام المتجر الفعلية. |
| `admin-reports.16` | الأكثر مبيعاً |
| `admin-reports.17` | المنتج |
| `admin-reports.18` | الكمية |
| `admin-reports.19` | المبيعات |
| `admin-reports.20` | [اسم المنتج] |

## Layout
Desktop (1280) (designed):
Header h1 "التقارير" with an outline small button "تصدير". Range chips (اليوم، آخر 7 أيام، آخر 30 يوماً، هذا الشهر، فترة مخصصة; selected: آخر 7 أيام). KPI grid (إجمالي المبيعات، عدد الطلبات، متوسط قيمة الطلب، المبلغ المحصّل). Row (wrap): card "المبيعات حسب اليوم" with a bar chart (190 high, bars in ink) and the caption "رسم توضيحي: ستظهر هنا أرقام المتجر الفعلية." (drop the caption in the build); table "الأكثر مبيعاً" (المنتج، الكمية، المبيعات).

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: التقارير) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Range chips | ToggleGroup | toggle chip |  |
| KPI card | Card |  |  |
| Bar chart | chart (recharts or SVG) | 7 bars, ink fill, axis line `--skf-control-border` | needs a text alternative: a table of the same data, hidden visually or shown on request |
| Top products | Table |  |  |

## Data
Orders in the range: total sales, order count, average, collected amount (sum of payments), sales per day, top products by quantity. "Custom range" opens two date fields (not designed, O-13).

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.)

## Interactions
1. Range chip reloads all numbers. 2. "تصدير": downloads a CSV of the orders in the range (format not decided, O-20).

## Accessibility
The chart has `role="img"` and an `aria-label` that states the totals; the top-products table is the text alternative. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
O-20 export format. Chart numbers and the bar heights on the board are samples.
