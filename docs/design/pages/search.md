# Search results
Route: `/search?q=<text>` (proposal)
Purpose: Show products that match a name or a code.
Source in scope: Catalog (search by name or code, Arabic names must match). (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Search results

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `search.01` | نتائج البحث |
| `search.02` | 12 نتيجة للبحث عن «ثريا» |
| `search.03` | تصفية |
| `search.04` | ثريا |
| `search.05` | ثريا كريستال دائرية |
| `search.06` | الكود: [الكود] |
| `search.07` | ₪ [السعر] |
| `search.08` | · متوفر |
| `search.09` | أضف للسلة |
| `search.10` | ثريا معلّقة مودرن |
| `search.11` | ثريا كلاسيك ذهبية |
| `search.12` | غير متوفر |
| `search.13` | ثريا مودرن بحلقتين |
| `search.14` | · غير متوفر |
| `search.15` | تم عرض 4 من 12 نتيجة |
| `search.16` | عرض المزيد |
| `search.17` | لم تجد ما تبحث عنه؟ |
| `search.18` | أرسل لنا الكود أو صورة المنتج على واتساب. |
| `search.19` | اسألنا عبر واتساب |
| `search.20` | إزالة البحث ثريا |
| `search.21` | اسأل عن ثريا كريستال دائرية عبر واتساب |
| `search.22` | اسأل عن ثريا معلّقة مودرن عبر واتساب |
| `search.23` | اسأل عن ثريا كلاسيك ذهبية عبر واتساب |
| `search.24` | اسأل عن ثريا مودرن بحلقتين عبر واتساب |
| `search.25` | واتساب |

## Layout
Mobile (390) (designed):
1. Header (shared; the search field holds the query).
2. Title h1 "نتائج البحث" 24/800; line 13 muted with the count and the query in «».
3. Row (gap 8): outline small button "تصفية" and a removable chip with the query.
4. Product grid (2 columns, gap 10, padding 8 16 0), product card pattern.
5. "تم عرض N من M نتيجة" and "عرض المزيد" outline button 48 high.
6. Help card (margin-top 22): "لم تجد ما تبحث عنه؟", green small button.
7. Footer, bottom bar (tab: بحث), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: search) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Filter button | Button | outline small | same filters screen as the Category page |
| Query chip | custom | removable chip | clears the query and returns to the previous page |
| Product card | custom |  | same as Category |
| Help card | Card |  | message W2 |

## Data
Products whose name or code matches the query (Arabic matching rules are open, O-2). Same card fields as the Category page.

## States
No results, loading and error are not drawn. Use the Category boards "لا نتائج", "جارٍ التحميل" and "خطأ في التحميل" with these changes: no-results title "لا توجد نتائج لـ «<query>»". 

## Interactions
1. Submit the header search: reloads with the new query.
2. "تصفية": opens the filters screen (same as Category).
3. x on the query chip: clears the search.
4. Card actions: same as Category.
5. "عرض المزيد": loads more results.

## Accessibility
The count line is a `role="status"` region. One `h1`.

## SEO
`noindex, follow`. Title: `نتائج البحث | S.K.F lighting`.

## Open items
O-2 Arabic search matching rules (letter variants, diacritics). Suggestions while typing: not designed.
