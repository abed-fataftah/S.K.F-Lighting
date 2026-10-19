# Home
Route: `/`
Purpose: A visitor finds a category or product and starts an order in one tap.
Source in scope: Site (homepage banners and featured products from the dashboard, quick links to main categories), Ordering (WhatsApp), delivery information. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Home (`Main.dc.html`)

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `home.01` | توصيل: الضفة ₪20 · الداخل ₪70 |
| `home.02` | ثريات وإنارة |
| `home.03` | وكهربائيات |
| `home.04` | اختر ثم اطلب عبر واتساب |
| `home.05` | تسوّق الآن |
| `home.06` | اطلب عبر واتساب |
| `home.07` | تسوّق حسب القسم |
| `home.08` | ثريات، إضاءة جدارية، أباجورات، إضاءة خارجية، سبوت لايت، أفياش ومفاتيح |
| `home.09` | [اسم المالك] |
| `home.10` | صاحب المتجر |
| `home.11` | تواصل مباشرة عبر واتساب |
| `home.12` | منتجات مختارة |
| `home.13` | عرض الكل |
| `home.14` | ثريا كريستال دائرية |
| `home.15` | الكود: [الكود] |
| `home.16` | Ø 60 سم |
| `home.17` | ₪ [السعر] |
| `home.18` | · متوفر |
| `home.19` | أضف للسلة |
| `home.20` | أباجورة طاولة |
| `home.21` | Ø 30 سم |
| `home.22` | لماذا تشتري من S.K.F |
| `home.23` | توصيل لكل مكان |
| `home.24` | الضفة ₪20 · الداخل ₪70 |
| `home.25` | الدفع عند الاستلام |
| `home.26` | ادفع عند استلام طلبك |
| `home.27` | رسالة جاهزة برقم الطلب |
| `home.28` | استلام من المعرض |
| `home.29` | [العنوان] |
| `home.30` | [رقم الهاتف] · [العنوان] |
| `home.31` | سياسة الخصوصية |
| `home.32` | الشروط والأحكام |
| `home.33` | سياسة الإرجاع |
| `home.34` | الرئيسية |
| `home.35` | الأقسام |
| `home.36` | السلة |
| `home.37` | بحث |
| `home.38` | حسابي |
| `home.39` | القائمة |
| `home.40` | ابحث بالاسم أو الكود |
| `home.41` | التالي |
| `home.42` | السابق |
| `home.43` | واتساب |
| `home.44` | ثريات ونجف |
| `home.45` | مودرن وكريستال وكلاسيك |
| `home.46` | إضاءة جدارية |
| `home.47` | داخلية وخارجية |
| `home.48` | أباجورات |
| `home.49` | طاولة وأرضية |
| `home.50` | إضاءة خارجية |
| `home.51` | للحوش والحدائق |
| `home.52` | إضاءة داخلية |
| `home.53` | أباليك وإنارة درج |
| `home.54` | إضاءة مخفية |
| `home.55` | سقف وشريط ليد |
| `home.56` | سبوت لايت |
| `home.57` | كشافات ولمبات ليد |
| `home.58` | أفياش ومفاتيح |
| `home.59` | كهربائيات |
| `home.60` | تصفّح |

## Layout
Mobile (390) (designed):
Top to bottom, all inside the 480px column:
1. Info strip: yellow, 12/800 ink, centered, padding 8 12. Text in Content (`strip`). Home only.
2. Header (black): menu button (44x44, start side), logo 52px high (center), cart button (44x44, end side). Padding 8 8 6. Then the search bar: white, radius 12, 52 high, input flex 1, yellow 42x42 search button (radius 8) at the end. Block padding 4 14 16.
3. Hero card: black, radius 20, margin 0 16. Chandelier drawing 200x160 hanging from the top edge on the physical left. Headline 32/800: line 1 white, line 2 yellow. Subline 14 white. Two buttons 52 high: yellow "تسوّق الآن" and green WhatsApp "اطلب عبر واتساب".
4. Section "تسوّق حسب القسم" (title 22/800) with subline 13 muted, then the category circle carousel (below), then the yellow button naming the selected category.
5. Owner circle (centered): 112px circle, 4px yellow ring, 4px inner gap, photo; name 16/800; "صاحب المتجر" 13 muted; green pill button 44 high "تواصل مباشرة عبر واتساب".
6. Section "منتجات مختارة" with link "عرض الكل" (44 high) at the end; two product cards side by side (product card pattern, `design.md` section 7).
7. Section "لماذا تشتري من S.K.F": 2x2 grid of trust cards (white card, 40x40 yellow icon tile radius 10, title 16/800, line 13 muted). Four cards in Content (`trust`).
8. Footer (black): logo 64px, contact line, three policy links (44 high each).
9. Bottom bar and WhatsApp float.
Section side padding is 16 (the board has 14 in places: build 16).

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: home) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Info strip | custom | yellow | text only, no link |
| Header, search | SiteHeader | Home variant with strip above | search submits to `/search?q=` |
| Hero buttons | Button | primary large, WhatsApp large | "تسوّق الآن" scrolls to the categories section; WhatsApp opens the general message (handoff section 9, message W1) |
| Category carousel | custom | circles | see Interactions |
| Owner circle | custom | 112px | name and photo from Shop settings; whole circle is a button that opens WhatsApp (message W1) |
| Product card x2 | Product card | default | featured products |
| Trust card x4 | Card | icon tile | static |
| Footer | SiteFooter |  | policy links go to `/policies/privacy`, `/policies/terms`, `/policies/returns` |

## Data
Categories (main level, 8 shown) from the Categories dashboard page, with name, subtitle and photo. Featured products (2 on the board; show the count set in the dashboard) from Homepage dashboard page. Owner name and photo from Shop settings. Delivery fees (`₪20`, `₪70`), address and phone from Shop settings. Banners from the Homepage dashboard page replace the hero card when at least one is active (hero card is the fallback). Banner layout is not designed (O-9).

## States
Loading, empty (no featured products: hide the section) and error are not designed. Loading, empty and error are not drawn for this page. Build them with the shared patterns in `design.md` section 7 (skeleton of the real content with `role="status"`; empty or error card with a retry button and a WhatsApp button). Owner photo missing: show the person icon on `--skf-fill-muted` as on the board.

## Interactions
1. Tap a carousel arrow or swipe: moves one category, loops forever.
2. Carousel auto-advances every 3500ms until the first touch; after a touch it never auto-advances again on that page view. No auto-advance under `prefers-reduced-motion: reduce`.
3. Tap the centered circle or the yellow button "تصفّح <category>": opens `/c/<category>`.
4. "تسوّق الآن": scrolls to the section "تسوّق حسب القسم".
5. "عرض الكل": opens `/c` (all products). Route is a proposal (O-1).
6. "أضف للسلة" on a card: same behavior as on the Category page.
7. Owner circle or its green pill: opens WhatsApp (W1).

## Accessibility
One `h1` (the hero headline). Carousel: each circle is a button with the category name; arrows have `aria-label` ("القسم السابق", "القسم التالي"); the carousel region has `aria-roledescription="carousel"` and an `aria-live="off"` while auto-advancing, `polite` after the first touch; a visible pause is not needed because auto-advance stops on touch, but add a keyboard stop: any focus inside the carousel stops auto-advance.

## SEO
Title: `S.K.F lighting | ثريات وإنارة وكهربائيات`. Description: `[وصف الصفحة الرئيسية]`. Share image: `[صورة المشاركة]`. Structured data: Organization (name, logo, telephone `[رقم الهاتف]`, address `[العنوان]`).

## Open items
O-1 desktop layout. O-9 banner layout. Real category photos (the circles are drawings). Real hero image or confirm the chandelier drawing stays. Owner name and photo. Owner circle is not in the scope document (scope addition, needs approval). Home still has its own copy of header and footer in the prototype: build with the shared ones.
