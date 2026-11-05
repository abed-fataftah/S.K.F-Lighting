# Quick order (electricians)
Route: `/account/quick-order` (electricians only)
Purpose: An electrician builds an order of up to 30 lines quickly, saves it as a named draft or sends it.
Source in scope: Accounts (electrician role), Ordering (quick-order form, 30 lines, quantity on every line, named drafts). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Electrician quick order

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `quick-order.01` | طلب سريع |
| `quick-order.02` | للكهربائيين: أضف حتى 30 سطراً في طلب واحد. |
| `quick-order.03` | اسم المسودة |
| `quick-order.04` | فتح مسودة |
| `quick-order.05` | مسودة جديدة |
| `quick-order.06` | الأسطر |
| `quick-order.07` | السطر 1 |
| `quick-order.08` | الكود أو اسم المنتج |
| `quick-order.09` | الحجم |
| `quick-order.10` | 60 سم |
| `quick-order.11` | 40 سم |
| `quick-order.12` | اللون |
| `quick-order.13` | ذهبي |
| `quick-order.14` | أسود |
| `quick-order.15` | الكمية |
| `quick-order.16` | سعر الوحدة: ₪ [السعر] |
| `quick-order.17` | ₪ [المجموع] |
| `quick-order.18` | السطر 2 |
| `quick-order.19` | السطر 3 |
| `quick-order.20` | أدخل الكمية لهذا السطر. |
| `quick-order.21` | + إضافة سطر |
| `quick-order.22` | الإجمالي |
| `quick-order.23` | ₪ [الإجمالي] |
| `quick-order.24` | حفظ كمسودة |
| `quick-order.25` | إرسال الطلب عبر واتساب |
| `quick-order.26` | حذف السطر 1 |
| `quick-order.27` | [الكود] |
| `quick-order.28` | حذف السطر 2 |
| `quick-order.29` | حذف السطر 3 |
| `quick-order.30` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared). h1 "طلب سريع" 24/800; line 14 muted.
2. Card: field "اسم المسودة" (value like `ali / mo`); two outline small buttons (flex 1): "فتح مسودة", "مسودة جديدة".
3. Row: h2 "الأسطر" 16/800 and the counter "3 / 30" 13 muted.
4. One card per line: title "السطر N" with a trash icon button 44x44; field "الكود أو اسم المنتج"; three columns (gap 8): select "الحجم", select "اللون", number "الكمية"; footer row: "سعر الوحدة: ₪ [السعر]" 13 muted and the line total 800. Error: quantity field border danger and the message "أدخل الكمية لهذا السطر." with `aria-invalid`.
5. Outline large "+ إضافة سطر" (disabled at 30 lines).
6. Totals card: "الإجمالي" 18/800; outline large "حفظ كمسودة"; green large "إرسال الطلب عبر واتساب".
7. Footer, bottom bar (tab: حسابي), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: account) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Draft name | Input |  | required to save |
| Line card | Card |  | up to 30 |
| Product field | Combobox (shadcn `Command`) | search by code or name | chooses a product; fills sizes and colors |
| Quantity | Input number | required, minimum 1 | error when empty |
| Send | Button | WhatsApp large | validates all lines, saves the order, opens W5 |

## Data
Products (code, name, sizes, colors, unit price). Prices are the normal prices; the owner may adjust line prices after the order is sent (not shown on this page). Drafts belong to the user.

## States
Line with missing quantity (board shows it). Empty draft: one empty line. 30 lines: add button disabled and the counter reads "30 / 30". Save and send errors: notice banner at the top of the totals card. Loading and success: not drawn (success = confirmation page).

## Interactions
1. Type a code or name in a line: suggestions appear; choosing fills the options.
2. Trash removes the line.
3. "+ إضافة سطر": adds an empty line (maximum 30).
4. "حفظ كمسودة": saves under the draft name; needs a name.
5. "إرسال الطلب عبر واتساب": validates every line (a quantity on every line), saves, opens W5.
6. "فتح مسودة": opens the drafts page. "مسودة جديدة": clears the lines after asking if there are unsaved changes (confirm dialog wording not designed, O-13).

## Accessibility
Each line is a `fieldset` with a `legend` "السطر N". Errors are linked with `aria-describedby`.

## SEO
`noindex`.

## Open items
Add-to-draft from the catalog (scope item) has no board: a card button is not designed (O-16). Autocomplete list design (rows, photo or not): not designed.
