# Customers
Route: `/admin/customers`
Purpose: See registered users and promote chosen users to electrician.
Source in scope: Customers (roles). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – customers

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-customers.01` | العملاء |
| `admin-customers.02` | بحث |
| `admin-customers.03` | الدور |
| `admin-customers.04` | الكل |
| `admin-customers.05` | عميل |
| `admin-customers.06` | كهربائي |
| `admin-customers.07` | الاسم |
| `admin-customers.08` | الهاتف |
| `admin-customers.09` | البريد الإلكتروني |
| `admin-customers.10` | الطلبات |
| `admin-customers.11` | تاريخ التسجيل |
| `admin-customers.12` | إجراء |
| `admin-customers.13` | [الاسم] |
| `admin-customers.14` | [رقم الهاتف] |
| `admin-customers.15` | [البريد] |
| `admin-customers.16` | [N] |
| `admin-customers.17` | [التاريخ] |
| `admin-customers.18` | ترقية إلى كهربائي |
| `admin-customers.19` | إعادة إلى عميل |
| `admin-customers.20` | كل من يسجّل يبدأ كعميل عادي، وأنت تقرر من يصبح كهربائياً. |
| `admin-customers.21` | الاسم أو الهاتف أو البريد |
| `admin-customers.22` | قائمة العملاء |

## Layout
Desktop (1280) (designed):
Header h1 "العملاء". Filter card: search "بحث" (placeholder "الاسم أو الهاتف أو البريد"), select "الدور" (الكل، عميل، كهربائي). Table: الاسم, الهاتف, البريد الإلكتروني, الدور (badge: عميل = off, كهربائي = proc), الطلبات, تاريخ التسجيل, إجراء (outline small button "ترقية إلى كهربائي" or "إعادة إلى عميل"). Note 13 muted under the table.

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: العملاء) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Role button | Button | outline small | asks for confirmation before changing the role |

## Data
Users with role, order count, registration date.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.)

## Interactions
1. Search and role filter. 2. Role button: confirm dialog "تغيير دور <name> إلى <role>؟" (wording is mine, O-13), then saves.

## Accessibility
Buttons include the customer name in `aria-label`. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
Customer detail page (order history per customer): not designed (O-19).
