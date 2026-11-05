# Order confirmation
Route: `/checkout/done/[number]` (proposal)
Purpose: Confirm the order was received, show the order number, explain the next steps, offer to open WhatsApp again.
Source in scope: Ordering. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Order confirmation

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `confirmation.01` | تم استلام طلبك |
| `confirmation.02` | رقم طلبك |
| `confirmation.03` | احتفظ بالرقم لمتابعة الطلب. هذا رقم تجريبي. |
| `confirmation.04` | ما الخطوة التالية؟ |
| `confirmation.05` | أرسل رسالة الطلب التي فتحها واتساب. |
| `confirmation.06` | نراجع طلبك ونتواصل معك لتأكيده. |
| `confirmation.07` | تدفع عند الاستلام. |
| `confirmation.08` | لم يفتح واتساب؟ افتحه من هنا |
| `confirmation.09` | متابعة الطلب |
| `confirmation.10` | العودة للتسوق |
| `confirmation.11` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared).
2. Card (padding 28 20, centered, margin-top 20): check disc 72px (yellow fill, 2px ink border, ink check); h1 "تم استلام طلبك" 24/800; "رقم طلبك" 14 muted; the number in a dashed box (1px dashed ink, radius 8, 28/800, `dir="ltr"`); note 13 muted.
3. Card "ما الخطوة التالية؟": ordered list of three steps.
4. Buttons stacked (gap 10): green large "لم يفتح واتساب؟ افتحه من هنا"; yellow large "متابعة الطلب"; outline large "العودة للتسوق".
5. Footer, bottom bar (tab: السلة), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: cart) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Number box | custom | dashed | copyable |
| Open WhatsApp | Button | WhatsApp large | re-opens message W5 |
| Track | Button | primary large | goes to the order page |
| Back | Button | outline large | goes to `/` |

## Data
Order number `YY-NNNNN` (year in Asia/Jerusalem). On the board the number `26-00123` and the note "هذا رقم تجريبي." are samples: do not ship the note.

## States
Order not found or no permission: not-found page. Error: not drawn.

## Interactions
1. Green button re-opens WhatsApp with W5.
2. "متابعة الطلب": opens `/orders/<number>`.
3. "العودة للتسوق": opens `/`.

## Accessibility
One `h1`. The page title change is announced (focus the h1 on load).

## SEO
`noindex`.

## Open items
Guest order lookup needs the phone number: the confirmation page does not show it.
