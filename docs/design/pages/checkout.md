# Checkout
Route: `/checkout`
Purpose: Give contact details, choose pickup or delivery, confirm, and send the order on WhatsApp.
Source in scope: Ordering (guest checkout, pickup or delivery, fees, order saved and WhatsApp message), Payments (paid on receipt, recorded by the owner). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Checkout

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `checkout.01` | إتمام الطلب |
| `checkout.02` | بيانات التواصل |
| `checkout.03` | الاسم الكامل |
| `checkout.04` | رقم الهاتف |
| `checkout.05` | لديك حساب؟ سجّل الدخول |
| `checkout.06` | طريقة الاستلام |
| `checkout.07` | استلام من المعرض |
| `checkout.08` | [العنوان] · بدون رسوم |
| `checkout.09` | توصيل |
| `checkout.10` | إلى العنوان الذي تحدده |
| `checkout.11` | المنطقة |
| `checkout.12` | الضفة |
| `checkout.13` | ₪20 |
| `checkout.14` | الداخل |
| `checkout.15` | ₪70 |
| `checkout.16` | العنوان بالتفصيل |
| `checkout.17` | ملاحظات (اختياري) |
| `checkout.18` | الدفع |
| `checkout.19` | الدفع عند الاستلام |
| `checkout.20` | ادفع عند استلام طلبك. |
| `checkout.21` | ملخص الطلب |
| `checkout.22` | ثريا كريستال دائرية × 1 |
| `checkout.23` | ₪ [السعر] |
| `checkout.24` | ثريا معلّقة مودرن × 2 |
| `checkout.25` | المجموع الفرعي |
| `checkout.26` | ₪ [المجموع] |
| `checkout.27` | التوصيل |
| `checkout.28` | الإجمالي |
| `checkout.29` | ₪ [الإجمالي] |
| `checkout.30` | تأكيد وإرسال عبر واتساب |
| `checkout.31` | سيفتح واتساب برسالة جاهزة بتفاصيل طلبك. يُحفظ الطلب لدى المتجر أيضاً. |
| `checkout.32` | [الاسم] |
| `checkout.33` | [رقم الهاتف] |
| `checkout.34` | [البلدة، الشارع، أقرب معلم] |
| `checkout.35` | واتساب |
| `checkout.36` | بدون رسوم |

## Layout
Mobile (390) (designed):
Single column, cards with 12px between them:
1. Header (shared). h1 "إتمام الطلب" 24/800 (padding 12 0 10).
2. Card "بيانات التواصل": fields الاسم الكامل (`autocomplete="name"`), رقم الهاتف (`type="tel"`, `autocomplete="tel"`); link button "لديك حساب؟ سجّل الدخول".
3. Card "طريقة الاستلام": two radio cards ("استلام من المعرض" with line `[العنوان] · بدون رسوم`; "توصيل" with line "إلى العنوان الذي تحدده"). When delivery is chosen: heading "المنطقة" and two radio cards (الضفة ₪20, الداخل ₪70), then textarea "العنوان بالتفصيل" (88 high). Always: textarea "ملاحظات (اختياري)" (72 high).
4. Card "الدفع": 40px yellow icon tile, title "الدفع عند الاستلام", line "ادفع عند استلام طلبك.".
5. Card "ملخص الطلب": one row per line ("<name> × <qty>" and price), "المجموع الفرعي", "التوصيل" (`₪20`, `₪70` or "بدون رسوم"), "الإجمالي" 18/800; green large button "تأكيد وإرسال عبر واتساب"; note 13 muted.
6. Footer, bottom bar (tab: السلة), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: cart) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Text fields | Input | default | name and phone required |
| Mode and zone | RadioGroup + radio card |  | default pickup; default zone الضفة |
| Address, notes | Textarea |  | address required only for delivery |
| Submit | Button | WhatsApp large | saves the order, then opens WhatsApp with message W5 |

## Data
Cart lines and prices (server), delivery fees from Shop settings (`₪20`, `₪70`), pickup address from Shop settings. Name and phone are prefilled for signed-in users. The total is calculated by the server: subtotal plus the fee.

## States
Default pickup; delivery adds the zone and address. Validation errors: inline per field (`design.md` section 7). Submitting: the button shows "جارٍ إرسال الطلب" and is disabled. Save failed: notice banner "تعذّر حفظ الطلب. حاول مرة أخرى." above the button and the cart is kept. WhatsApp did not open: the confirmation page has a link to open it. Loading is not drawn.

## Interactions
1. Choose pickup: zone and address are hidden, fee shows "بدون رسوم".
2. Choose delivery: zone and address appear; choose a zone: the fee row shows `₪20` or `₪70`.
3. "تأكيد وإرسال عبر واتساب": validates; on success saves the order, then navigates to the confirmation page and opens WhatsApp with W5.
4. "لديك حساب؟ سجّل الدخول": opens sign in and returns here after.

## Accessibility
Radio groups have `role="radiogroup"` and `aria-label`. Errors are `role="alert"` and focus moves to the first invalid field. The submit button announces its busy state.

## SEO
`noindex`.

## Open items
Cart items are listed in the summary with price placeholders. Required-field list for guests (name, phone, and address for delivery) is my reading of the scope; confirm (O-12). Whether the order can be sent without opening WhatsApp: not decided.
