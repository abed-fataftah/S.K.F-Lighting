# Order (details and guest lookup)
Route: `/orders/[number]` (signed in or after lookup); lookup form at `/orders/track`
Purpose: See the status, items and totals of one order; ask to cancel or contact the shop.
Source in scope: Ordering (order page, status, cancel, WhatsApp contact), Accounts (guest lookup by order number plus phone number, limited attempts), Payments. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Order page, Order lookup, Order lookup – error

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `order.01` | تتبّع طلبك |
| `order.02` | أدخل رقم الطلب ورقم الهاتف الذي استخدمته عند الطلب. |
| `order.03` | لم نجد طلباً بهذه البيانات. تأكد من الرقمين وحاول مرة أخرى. |
| `order.04` | رقم الطلب |
| `order.05` | رقم الهاتف |
| `order.06` | تتبّع الطلب |
| `order.07` | عدد المحاولات محدود لحماية بيانات الطلبات. |
| `order.08` | لديك حساب؟ سجّل الدخول لرؤية كل طلباتك |
| `order.09` | طلب |
| `order.10` | قيد التجهيز |
| `order.11` | [التاريخ] · توصيل إلى الضفة |
| `order.12` | حالة الطلب |
| `order.13` | تم استلام الطلب |
| `order.14` | الحالة الحالية |
| `order.15` | جاهز للاستلام أو التوصيل |
| `order.16` | تم التسليم |
| `order.17` | المنتجات |
| `order.18` | ثريا كريستال دائرية |
| `order.19` | 60 سم · ذهبي · × 1 |
| `order.20` | ₪ [السعر] |
| `order.21` | ثريا معلّقة مودرن |
| `order.22` | 40 سم · أسود · × 2 |
| `order.23` | التوصيل (الضفة) |
| `order.24` | ₪20 |
| `order.25` | الإجمالي |
| `order.26` | ₪ [الإجمالي] |
| `order.27` | الدفع |
| `order.28` | الدفع عند الاستلام |
| `order.29` | لم يُسجَّل دفع |
| `order.30` | تواصل معنا عبر واتساب |
| `order.31` | إلغاء الطلب عبر واتساب |
| `order.32` | يفتح الإلغاء رسالة واتساب جاهزة برقم الطلب، ويراجعها المتجر. |
| `order.33` | [رقم الهاتف] |
| `order.34` | واتساب |

## Layout
Mobile (390) (designed):
Details view:
1. Header (shared). Title row: h1 "طلب <number>" (24/800, number `dir="ltr"`) and the status badge. Line 13 muted: `[التاريخ] · <delivery type>`.
2. Card "حالة الطلب": timeline of four steps: "تم استلام الطلب", "قيد التجهيز", "جاهز للاستلام أو التوصيل", "تم التسليم". Current step has the tag "الحالة الحالية".
3. Card "المنتجات": rows with a 52px tile, name 700, option line 12 muted, price 800; then delivery row and the total 18/800.
4. Card "الدفع": text "الدفع عند الاستلام" and a payment-status badge (off: "لم يُسجَّل دفع"; ok: "مدفوع").
5. Buttons: green large "تواصل معنا عبر واتساب"; outline large "إلغاء الطلب عبر واتساب"; note 13 muted.
Lookup view: h1 "تتبّع طلبك"; text 14 muted; card with fields رقم الطلب (`dir="ltr"`, placeholder `26-00123`) and رقم الهاتف, yellow large "تتبّع الطلب", note "عدد المحاولات محدود لحماية بيانات الطلبات."; centered link button "لديك حساب؟ سجّل الدخول لرؤية كل طلباتك". Error: bordered danger box with icon above the fields: "لم نجد طلباً بهذه البيانات. تأكد من الرقمين وحاول مرة أخرى."
Footer, bottom bar (tab: حسابي), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: account) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Status badge | Badge | new / proc / ok / off | status names are samples (O-3) |
| Timeline | custom |  | `design.md` section 6 |
| Payment badge | Badge | off / proc / ok | "لم يُسجَّل دفع", "دفعة جزئية", "مدفوع" |
| Cancel | Button | outline large | opens WhatsApp with W6 |
| Lookup form | Input x2 + Button |  | server limits attempts |

## Data
Order: number, date, status, delivery type and zone, lines (name, size, color, quantity, unit price after any owner adjustment), fee, total, payments recorded by the owner (status only: none, partial, paid). Guest lookup returns the order only when number and phone match.

## States
Details (board "Order page"). Lookup (board "Order lookup"). Lookup error (board "Order lookup – error"). Too many attempts: the error box says "تجاوزت عدد المحاولات المسموح. حاول لاحقاً أو تواصل معنا عبر واتساب." (wording is mine, O-13). Cancelled order: status badge "ملغي" (off), timeline replaced by one line "تم إلغاء هذا الطلب", cancel button hidden. Loading and error: not drawn.

## Interactions
1. "تواصل معنا عبر واتساب": opens W7 with the order number.
2. "إلغاء الطلب عبر واتساب": opens W6 (cancellation request with the order number). The shop decides; the status does not change until the owner changes it.
3. "تتبّع الطلب": submits the lookup; success opens the details; failure shows the error box.

## Accessibility
Timeline is an ordered list; the current step has `aria-current="step"`. The lookup error is `role="alert"`.

## SEO
`noindex`.

## Open items
O-3 status names and order of statuses. O-13 attempts-exceeded wording. Rule for when cancelling is allowed: not in the scope, not shown.
