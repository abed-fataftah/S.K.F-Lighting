# Cart (empty)
Route: `/cart` (state)
Purpose: Tell the visitor the cart is empty and send them to products.
Source in scope: Ordering. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Empty cart

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `cart-empty.01` | السلة فارغة |
| `cart-empty.02` | أضف منتجات من الأقسام ثم أرسل طلبك عبر واتساب. |
| `cart-empty.03` | تصفّح الأقسام |
| `cart-empty.04` | اسألنا عبر واتساب |
| `cart-empty.05` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared).
2. Card (padding 32 20, margin-top 28, centered): disc 80px fill-muted with a cart icon 38px; h1 "السلة فارغة" 22/800; text 14 muted; yellow large button "تصفّح الأقسام"; green large button "اسألنا عبر واتساب".
3. Footer, bottom bar (tab: السلة), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: cart) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Empty card | custom | cart |  |

## Data
None.

## States
This is the empty state of the cart. Error: not applicable.

## Interactions
1. "تصفّح الأقسام": goes to `/c`.
2. "اسألنا عبر واتساب": opens W2.

## Accessibility
One `h1`.

## SEO
`noindex`.

## Open items
None.
