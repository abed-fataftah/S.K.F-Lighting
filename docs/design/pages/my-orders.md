# My orders
Route: `/account/orders`
Purpose: A signed-in user sees all their orders.
Source in scope: Accounts, Ordering. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: My orders, My orders – empty

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `my-orders.01` | طلباتي |
| `my-orders.02` | قيد التجهيز |
| `my-orders.03` | [التاريخ] · 3 منتجات |
| `my-orders.04` | ₪ [الإجمالي] |
| `my-orders.05` | عرض الطلب |
| `my-orders.06` | جديد |
| `my-orders.07` | تم التسليم |
| `my-orders.08` | ملغي |
| `my-orders.09` | لا توجد طلبات بعد |
| `my-orders.10` | عند إرسال أول طلب سيظهر هنا. |
| `my-orders.11` | تصفّح الأقسام |
| `my-orders.12` | عرض الطلب 26-00123 |
| `my-orders.13` | عرض الطلب 26-00118 |
| `my-orders.14` | عرض الطلب 26-00097 |
| `my-orders.15` | عرض الطلب 26-00061 |
| `my-orders.16` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared). h1 "طلباتي" 24/800 (padding 12 0 12).
2. One card per order (padding 14, margin-bottom 10): order number (16/800, `dir="ltr"`) at the start and the status badge at the end; row: `[التاريخ] · N منتجات` (13 muted) and the total (800); outline small full-width button "عرض الطلب".
3. Empty state card: disc 72 with an order icon, h2 "لا توجد طلبات بعد", text "عند إرسال أول طلب سيظهر هنا.", yellow large "تصفّح الأقسام".
4. Footer, bottom bar (tab: حسابي), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: account) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Order card | Card |  | "عرض الطلب" opens `/orders/<number>` |
| Status badge | Badge | new / proc / ok / off |  |

## Data
Orders of the signed-in user, newest first: number, date, item count, total, status. Paging: "load more" pattern if more than `[عدد الطلبات في الصفحة]` (O-10).

## States
List (board 1). Empty (board 2). Loading and error: not drawn. Loading, empty and error are not drawn for this page. Build them with the shared patterns in `design.md` section 7 (skeleton of the real content with `role="status"`; empty or error card with a retry button and a WhatsApp button).

## Interactions
1. "عرض الطلب": opens the order page.
2. Not signed in: redirect to sign in, then back here.

## Accessibility
Each "عرض الطلب" button has `aria-label="عرض الطلب <number>"`.

## SEO
`noindex`.

## Open items
Electrician extras (drafts link) are in the account menu: account menu is not designed (O-15).
