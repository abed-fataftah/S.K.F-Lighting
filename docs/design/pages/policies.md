# Policy pages
Route: `/policies/privacy`, `/policies/terms`, `/policies/returns`
Purpose: Show the privacy policy, terms and return policy written by the owner.
Source in scope: Site (privacy, terms and return policy pages in Arabic, edited in Shop settings). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Policy pages

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `policies.01` | آخر تحديث: [التاريخ] |
| `policies.02` | [عنوان البند الأول] |
| `policies.03` | [نص البند الأول] |
| `policies.04` | [عنوان البند الثاني] |
| `policies.05` | [نص البند الثاني] |
| `policies.06` | [عنوان البند الثالث] |
| `policies.07` | [نص البند الثالث] |
| `policies.08` | لديك سؤال؟ |
| `policies.09` | تواصل معنا عبر واتساب |
| `policies.10` | السياسات |
| `policies.11` | واتساب |
| `policies.12` | سياسة الخصوصية |
| `policies.13` | الشروط والأحكام |
| `policies.14` | سياسة الإرجاع |

## Layout
Mobile (390) (designed):
1. Header (shared). h1 24/800 with the policy name (padding 12 0 12).
2. Tab row (scrolls sideways): three toggle buttons "سياسة الخصوصية", "الشروط والأحكام", "سياسة الإرجاع", 44 high.
3. Card: line "آخر تحديث: [التاريخ]" 13 muted, then sections: h2 16/800 and paragraph 14 with line height 1.8 (three on the board).
4. Card (margin-top 12): "لديك سؤال؟" and a green small button "تواصل معنا عبر واتساب".
5. Footer, bottom bar (tab: الرئيسية), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: home) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Policy tabs | links styled as toggle chips |  | each tab is its own address; the current one has `aria-current="page"` |
| Text | rich text |  | headings and paragraphs from the owner text |

## Data
Policy text from Shop settings (one text per policy), last-updated date.

## States
Empty text: show "لم تُضف هذه الصفحة بعد." (wording is mine). Loading and error: not drawn.

## Interactions
1. Tabs open the other policy page. 2. WhatsApp button: W2.

## Accessibility
One `h1`.

## SEO
Indexable. Title: `<policy> | S.K.F lighting`.

## Open items
Policy text from the owner. How the owner formats headings in Shop settings (plain text with blank lines is the interim rule).
