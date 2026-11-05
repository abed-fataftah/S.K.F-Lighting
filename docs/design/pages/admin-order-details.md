# Order details
Route: `/admin/orders/[number]`
Purpose: Review an order, adjust line prices (electrician orders), change status, record payments, contact the customer.
Source in scope: Order details (payments, price adjustments), Payments (cash or cheque recorded by the owner). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Dashboard – order details

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `admin-order-details.01` | طلب |
| `admin-order-details.02` | جديد |
| `admin-order-details.03` | مراسلة العميل |
| `admin-order-details.04` | العودة للطلبات |
| `admin-order-details.05` | المنتجات |
| `admin-order-details.06` | المنتج |
| `admin-order-details.07` | الخيار |
| `admin-order-details.08` | الكمية |
| `admin-order-details.09` | سعر الوحدة (₪) |
| `admin-order-details.10` | المجموع |
| `admin-order-details.11` | ثريا كريستال دائرية |
| `admin-order-details.12` | الكود: [الكود] |
| `admin-order-details.13` | 60 سم · ذهبي |
| `admin-order-details.14` | ₪ [المجموع] |
| `admin-order-details.15` | ثريا معلّقة مودرن |
| `admin-order-details.16` | 40 سم · أسود |
| `admin-order-details.17` | هذا طلب كهربائي، ويمكنك تعديل سعر كل سطر قبل التأكيد. |
| `admin-order-details.18` | المجموع الفرعي |
| `admin-order-details.19` | التوصيل |
| `admin-order-details.20` | ₪0 (استلام من المعرض) |
| `admin-order-details.21` | الإجمالي |
| `admin-order-details.22` | ₪ [الإجمالي] |
| `admin-order-details.23` | الدفعات |
| `admin-order-details.24` | [التاريخ] · شيك رقم [الرقم] |
| `admin-order-details.25` | ₪ [المبلغ] |
| `admin-order-details.26` | المتبقي |
| `admin-order-details.27` | ₪ [المتبقي] |
| `admin-order-details.28` | تسجيل دفعة |
| `admin-order-details.29` | المبلغ (₪) |
| `admin-order-details.30` | الطريقة |
| `admin-order-details.31` | نقداً |
| `admin-order-details.32` | شيك |
| `admin-order-details.33` | رقم الشيك |
| `admin-order-details.34` | التاريخ |
| `admin-order-details.35` | تسجيل الدفعة |
| `admin-order-details.36` | حالة الطلب |
| `admin-order-details.37` | الحالة |
| `admin-order-details.38` | قيد التجهيز |
| `admin-order-details.39` | جاهز |
| `admin-order-details.40` | تم التسليم |
| `admin-order-details.41` | ملغي |
| `admin-order-details.42` | حفظ الحالة |
| `admin-order-details.43` | العميل |
| `admin-order-details.44` | [الاسم] |
| `admin-order-details.45` | [رقم الهاتف] |
| `admin-order-details.46` | كهربائي |
| `admin-order-details.47` | الاستلام: من المعرض |
| `admin-order-details.48` | ملاحظات العميل: [الملاحظات] |
| `admin-order-details.49` | منتجات الطلب |
| `admin-order-details.50` | سعر الوحدة للسطر 1 |
| `admin-order-details.51` | [السعر] |
| `admin-order-details.52` | سعر الوحدة للسطر 2 |
| `admin-order-details.53` | [الرقم] |
| `admin-order-details.54` | [التاريخ] |

## Layout
Desktop (1280) (designed):
Header: h1 "طلب <number>" with the status badge; actions: green small "مراسلة العميل", outline small "العودة للطلبات". Two columns. Left (flex 2): h2 "المنتجات" and a lines table (المنتج with code, الخيار, الكمية, سعر الوحدة (₪) as an editable number field 120 wide and 40 high, المجموع); note 13 muted; totals card (المجموع الفرعي, التوصيل, الإجمالي 18/800); payments card (list of recorded payments, "المتبقي", then the form "تسجيل دفعة": المبلغ (₪), الطريقة select نقداً or شيك, رقم الشيك, التاريخ, yellow small "تسجيل الدفعة"). Right (flex 1): card "حالة الطلب" (select + yellow small button "حفظ الحالة", full width); card "العميل" (name, phone, role badge, delivery info, notes).

Mobile (390) and tablet: not drawn. Rule: below 780px of width the sidebar wraps above the content at full width; the content keeps one column; KPI cards, form rows and detail columns stack; tables scroll sideways inside their own box.

The dashboard sidebar (AdminSide, active item: الطلبات) is shared and defined once in `handoff.md` section 6.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Price field | Input number | small (40 high) | editable on electrician orders; changing it recalculates the totals and saves on blur |
| Status select | Select |  | "حفظ الحالة" saves |
| Payment form | Input, Select, Button |  | cheque number field shown when method is شيك |
| Contact | Button | WhatsApp small | opens WhatsApp to the customer phone |

## Data
Order lines with unit price (adjustable), totals, payments list (date, method, cheque number, amount), balance = total minus payments, customer info.

## States
Loading: skeleton rows in the table or cards (`design.md` section 6 Skeleton). Empty: empty card with the sentence in Content and one button. Error: error card with `role="alert"` and a retry button. (Not drawn on boards.) Payment error: inline message under the form.

## Interactions
1. Edit a unit price: line total and order total update. 2. "حفظ الحالة": saves the status. 3. "تسجيل الدفعة": adds a payment row, updates "المتبقي" and the payment status (none, partial, paid). 4. "مراسلة العميل": opens WhatsApp.

## Accessibility
Each price field has `aria-label="سعر الوحدة للسطر N"`. Dashboard rules in `design.md` section 9 apply: sidebar `nav` with `aria-label="لوحة التحكم"`, one `h1`, tables with `aria-label` and `scope="col"`.

## SEO
`noindex, nofollow` (dashboard, signed-in owner only).

## Open items
The board note about adjusting prices applies to electrician orders; whether the owner can also adjust customer orders is not decided (O-18). Cancelling an order from here is the status "ملغي". Refunds: not in scope.
