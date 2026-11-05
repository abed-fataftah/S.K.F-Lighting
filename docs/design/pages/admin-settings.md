# Shop settings
Route: `/admin/settings`
Purpose: Edit contact details, delivery fees, owner profile and policy texts.
Source in scope: Shop settings (WhatsApp, delivery fees, policies). The owner profile card is a scope addition that needs approval. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – settings

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-settings.01` | إعدادات المتجر |
| `admin-settings.02` | حفظ الإعدادات |
| `admin-settings.03` | بيانات التواصل |
| `admin-settings.04` | رقم الهاتف |
| `admin-settings.05` | رقم واتساب |
| `admin-settings.06` | البريد الإلكتروني |
| `admin-settings.07` | العنوان |
| `admin-settings.08` | رسوم التوصيل |
| `admin-settings.09` | الضفة (₪) |
| `admin-settings.10` | الداخل (₪) |
| `admin-settings.11` | صاحب المتجر |
| `admin-settings.12` | الاسم الظاهر |
| `admin-settings.13` | رفع صورة |
| `admin-settings.14` | يظهر في الصفحة الرئيسية فقط. |
| `admin-settings.15` | صفحات السياسات |
| `admin-settings.16` | سياسة الخصوصية |
| `admin-settings.17` | الشروط والأحكام |
| `admin-settings.18` | سياسة الإرجاع |
| `admin-settings.19` | [رقم الهاتف] |
| `admin-settings.20` | [رقم واتساب] |
| `admin-settings.21` | [العنوان] |
| `admin-settings.22` | [اسم المالك] |
| `admin-settings.23` | [نص الصفحة] |

## Layout
Desktop (1280) (designed):
Header h1 "إعدادات المتجر" with yellow small "حفظ الإعدادات". One column, max 900, gap 16, card titles 18/800. "بيانات التواصل": رقم الهاتف, رقم واتساب, البريد الإلكتروني, العنوان (two columns, wrap). "رسوم التوصيل": الضفة (₪) value 20, الداخل (₪) value 70. "صاحب المتجر": 96px circle with a 4px yellow ring and a person icon, field "الاسم الظاهر", outline small "رفع صورة", note "يظهر في الصفحة الرئيسية فقط.". "صفحات السياسات": three textareas (100 high): سياسة الخصوصية, الشروط والأحكام, سياسة الإرجاع.

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: الإعدادات) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Fields | Input, Textarea |  |  |
| Photo upload | Button | outline small | accepts an image, crops to a circle |

## Data
Settings record. The WhatsApp number is used in every `wa.me` link. Fees feed checkout and the Home trust card. Policy texts feed the policy pages.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.) Saved: inline message "تم حفظ الإعدادات." next to the save button.

## Interactions
1. "حفظ الإعدادات": validates numbers (fees are whole numbers) and saves. 2. "رفع صورة": file picker.

## Accessibility
All fields labeled. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
Owner profile card needs scope approval. WhatsApp number format (with country code, digits only): to confirm (O-24). Info strip text on Home is built from the fees and is not editable.
