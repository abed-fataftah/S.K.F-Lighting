# Drafts (electricians)
Route: `/account/drafts`
Purpose: An electrician sees named drafts, opens or deletes them.
Source in scope: Accounts (named drafts). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Electrician drafts

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `drafts.01` | مسوداتي |
| `drafts.02` | + مسودة جديدة |
| `drafts.03` | احفظ طلباتك لكل زبون باسم خاص، وعُد إليها في أي وقت. |
| `drafts.04` | 5 أسطر · آخر تعديل [التاريخ] |
| `drafts.05` | فتح |
| `drafts.06` | [اسم المسودة] |
| `drafts.07` | 12 أسطر · آخر تعديل [التاريخ] |
| `drafts.08` | 3 أسطر · آخر تعديل [التاريخ] |
| `drafts.09` | حذف المسودة ali / mo |
| `drafts.10` | حذف المسودة [اسم المسودة] |
| `drafts.11` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared). Row: h1 "مسوداتي" 24/800 and the yellow small button "+ مسودة جديدة" (padding-bottom 12). Line 14 muted.
2. One card per draft (padding 14, margin-bottom 10): name 16/800; line 13 muted "N أسطر · آخر تعديل [التاريخ]"; row: yellow small button "فتح" (flex 1) and outline small icon button with a trash icon (44 wide).
3. Footer, bottom bar (tab: حسابي), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: account) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Draft card | Card |  | "فتح" opens the quick order with the draft loaded |
| Delete | Button | outline small icon | asks "حذف المسودة؟" with two buttons (wording not designed, O-13) |

## Data
Drafts of the user: name, line count, last edited date.

## States
Empty: use the empty card with title "لا توجد مسودات" and a yellow button "+ مسودة جديدة" (not drawn; wording is mine). Loading and error: not drawn.

## Interactions
1. "فتح": opens `/account/quick-order?draft=<id>`.
2. Trash: confirm, then deletes.
3. "+ مسودة جديدة": opens an empty quick order.

## Accessibility
Delete buttons have `aria-label="حذف المسودة <name>"`.

## SEO
`noindex`.

## Open items
O-13 confirm wording.
