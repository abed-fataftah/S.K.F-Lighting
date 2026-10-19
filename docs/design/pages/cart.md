# Cart
Route: `/cart`
Purpose: Review the items, fix quantities, remove unavailable items, continue to checkout.
Source in scope: Ordering (cart, order building). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Cart

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `cart.01` | السلة |
| `cart.02` | 3 منتجات |
| `cart.03` | منتج واحد في السلة غير متوفر. أزله لمتابعة الطلب. |
| `cart.04` | ثريا كريستال دائرية |
| `cart.05` | الحجم: 60 سم · اللون: ذهبي |
| `cart.06` | الكود: [الكود] |
| `cart.07` | ₪ [السعر] |
| `cart.08` | ثريا معلّقة مودرن |
| `cart.09` | الحجم: 40 سم · اللون: أسود |
| `cart.10` | ثريا مودرن بحلقتين |
| `cart.11` | الحجم: 80 سم · اللون: أبيض |
| `cart.12` | غير متوفر حالياً. أزله للمتابعة. |
| `cart.13` | المجموع الفرعي |
| `cart.14` | ₪ [المجموع] |
| `cart.15` | التوصيل |
| `cart.16` | يُحسب في الخطوة التالية |
| `cart.17` | الضفة ₪20 · الداخل ₪70 |
| `cart.18` | متابعة الطلب |
| `cart.19` | أكمل التسوق |
| `cart.20` | حذف ثريا كريستال دائرية من السلة |
| `cart.21` | إنقاص الكمية |
| `cart.22` | زيادة الكمية |
| `cart.23` | حذف ثريا معلّقة مودرن من السلة |
| `cart.24` | حذف ثريا مودرن بحلقتين من السلة |
| `cart.25` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared).
2. Title row: h1 "السلة" 24/800 and the count "N منتجات" 13 muted (padding 12 0 10).
3. Notice banner (only when an item is unavailable): tint fill, 1px ink border, warning icon, text 700.
4. One card per line (padding 14, gap 12, margin-bottom 10): image tile 72x72; column with the name link (800, at the start) and a trash icon button 44x44 at the end; option line 13 muted ("الحجم: 60 سم · اللون: ذهبي"); code line 12 muted; bottom row: stepper at the start and line price 16/800 at the end. Unavailable line: tile at 45% opacity, text "غير متوفر حالياً. أزله للمتابعة." (13/700 muted), no stepper, price muted.
5. Summary card (margin-top 14): "المجموع الفرعي" and amount; "التوصيل" with the text "يُحسب في الخطوة التالية" and "الضفة ₪20 · الداخل ₪70"; divider; yellow large button "متابعة الطلب" (disabled while an unavailable line exists); outline large button "أكمل التسوق".
6. Footer, bottom bar (tab: السلة), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: cart) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Line card | Card |  | name links to the product page |
| Stepper | custom | cart (min width 36) | 1 to 99 |
| Remove | Button | icon, 44x44 | `aria-label="حذف <name> من السلة"` |
| Notice | Alert | warning | `role="alert"` |
| Continue | Button | primary large | goes to `/checkout` |
| Keep shopping | Button | outline large | goes to `/c` |

## Data
Cart lines (product, size, color, quantity, unit price at the current price, stock). Totals are calculated by the server. Cart is kept for guests (browser) and for signed-in users (account).

## States
Default (board). Empty: see page file `cart-empty`. Loading and error are not drawn: Loading, empty and error are not drawn for this page. Build them with the shared patterns in `design.md` section 7 (skeleton of the real content with `role="status"`; empty or error card with a retry button and a WhatsApp button).

## Interactions
1. Stepper changes the quantity and the totals immediately; minimum 1.
2. Trash removes the line (no confirmation; the empty cart page appears when the last line is removed).
3. "متابعة الطلب": goes to checkout. Disabled while any line is unavailable; the banner explains why.
4. "أكمل التسوق": goes to the categories page.
5. Product name: opens the product page.

## Accessibility
One `h1`. Quantity changes are announced through the `aria-live` value. The disabled continue button keeps `aria-disabled="true"` and the banner id is in `aria-describedby`.

## SEO
`noindex`.

## Open items
Stock check wording when only part of the quantity is available: not designed. Delivery fee is not shown in the cart (shown at checkout).
