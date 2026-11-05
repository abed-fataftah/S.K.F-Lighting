# Not found
Route: `not-found` page (any unknown address, unknown product or order)
Purpose: Tell the visitor the page does not exist and offer ways forward.
Source in scope: Support pages. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Not found

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `not-found.01` | الصفحة غير موجودة |
| `not-found.02` | ربما تغيّر الرابط أو لم يعد المنتج موجوداً. جرّب البحث أو تصفّح الأقسام. |
| `not-found.03` | العودة للرئيسية |
| `not-found.04` | تصفّح الأقسام |
| `not-found.05` | اسألنا عبر واتساب |
| `not-found.06` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared).
2. Card (padding 32 20, margin-top 28, centered): "404" 64/800 (`dir="ltr"`); h1 "الصفحة غير موجودة" 22/800; text 14 muted; stacked buttons: yellow large "العودة للرئيسية", outline large "تصفّح الأقسام", green large "اسألنا عبر واتساب".
3. Footer, bottom bar (tab: الرئيسية), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: home) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Card | custom | not found |  |

## Data
None.

## States
Single state. HTTP status 404.

## Interactions
1. "العودة للرئيسية": `/`. 2. "تصفّح الأقسام": `/c`. 3. WhatsApp: W2.

## Accessibility
One `h1`.

## SEO
`noindex`. Title: `الصفحة غير موجودة | S.K.F lighting`.

## Open items
None.
