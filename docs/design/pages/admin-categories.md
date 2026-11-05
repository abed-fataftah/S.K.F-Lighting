# Categories
Route: `/admin/categories`
Purpose: Manage the two category levels.
Source in scope: Categories. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – categories

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-categories.01` | الأقسام |
| `admin-categories.02` | + قسم رئيسي |
| `admin-categories.03` | ثريات ونجف |
| `admin-categories.04` | · [N] منتج |
| `admin-categories.05` | تعديل |
| `admin-categories.06` | + قسم فرعي |
| `admin-categories.07` | مودرن |
| `admin-categories.08` | كريستال |
| `admin-categories.09` | كلاسيك |
| `admin-categories.10` | إضاءة جدارية |
| `admin-categories.11` | داخلية |
| `admin-categories.12` | خارجية |
| `admin-categories.13` | أباجورات |
| `admin-categories.14` | طاولة |
| `admin-categories.15` | أرضية |
| `admin-categories.16` | إضاءة خارجية |
| `admin-categories.17` | سبوت لايت |
| `admin-categories.18` | القسم له مستويان فقط: رئيسي وفرعي. |
| `admin-categories.19` | نقل لأعلى |
| `admin-categories.20` | نقل لأسفل |
| `admin-categories.21` | حذف مودرن |
| `admin-categories.22` | حذف كريستال |
| `admin-categories.23` | حذف كلاسيك |
| `admin-categories.24` | حذف داخلية |
| `admin-categories.25` | حذف خارجية |
| `admin-categories.26` | حذف طاولة |
| `admin-categories.27` | حذف أرضية |

## Layout
Desktop (1280) (designed):
Header h1 "الأقسام" with yellow small "+ قسم رئيسي". One column, max 900, gap 12. One card per main category: name 17/800 (build 18) with "· [N] منتج" 12 muted; buttons: ↑ and ↓ (44x44 outline), "تعديل", "+ قسم فرعي". Sub-categories under a 1px line: name with count, outline small "تعديل", outline icon trash 44x44. Note 13 muted: "القسم له مستويان فقط: رئيسي وفرعي.".

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: الأقسام) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Category card | Card |  |  |
| Move up and down | Button | outline icon 44x44 | `aria-label="نقل لأعلى"` and `"نقل لأسفل"`; the arrows are text characters ↑ ↓ and do not flip |

## Data
Categories: name, subtitle (shown on Home), photo (shown in the Home circles), order, product count. Photo and subtitle fields live in the edit dialog (not drawn, O-23).

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.) Delete a category with products: blocked with the message "لا يمكن حذف قسم فيه منتجات." (wording is mine).

## Interactions
1. ↑ ↓: change the order. 2. "تعديل": edit dialog (name, subtitle, photo). 3. "+ قسم فرعي": adds a child. 4. Trash: confirm, then delete if empty.

## Accessibility
Buttons name the category in `aria-label`. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
O-23 edit dialog.
