# Product
Route: `/p/[code]` (proposal)
Purpose: Choose size and color, see the price and stock, add to the cart or ask on WhatsApp.
Source in scope: Catalog (size and color options, price per size, availability per option, photos, optional video, description, dimensions, specifications, product code), Ordering. (scope files were not re-uploaded in the design chat; feature numbers are not available, file names are used).
Design board: https://claude.ai/artifact/5pFRJ3SFEXJffWRdAsmtPY, boards: Product – mobile, Product – غير متوفر, Product – جارٍ التحميل

## Content (exact copy)
Arabic only. Keys are proposals for the translation file (`messages/ar.json` assumed, O-27). `[BRACKETS]` are visible placeholders for real data. Text with `{{...}}` is built from data.

| Key | Text |
|---|---|
| `product.01` | الرئيسية |
| `product.02` | ثريات ونجف |
| `product.03` | ثريا كريستال دائرية |
| `product.04` | جارٍ تحميل المنتج |
| `product.05` | غير متوفر |
| `product.06` | الكود: [الكود] |
| `product.07` | ₪ [السعر] |
| `product.08` | الحجم |
| `product.09` | · غير متوفر |
| `product.10` | اللون |
| `product.11` | الكمية |
| `product.12` | الوصف |
| `product.13` | [وصف المنتج] |
| `product.14` | المواصفات |
| `product.15` | هل تحتاج مساعدة في الاختيار؟ |
| `product.16` | اسألنا عن الحجم أو اللون المناسب لغرفتك. |
| `product.17` | اسألنا عبر واتساب |
| `product.18` | مسار التنقل |
| `product.19` | فيديو المنتج |
| `product.20` | الصورة التالية |
| `product.21` | الصورة السابقة |
| `product.22` | إنقاص الكمية |
| `product.23` | زيادة الكمية |
| `product.24` | واتساب |
| `product.25` | 30 سم |
| `product.26` | 40 سم |
| `product.27` | 60 سم |
| `product.28` | 80 سم |
| `product.29` | ذهبي |
| `product.30` | أسود |
| `product.31` | أبيض |
| `product.32` | صورة 1 |
| `product.33` | صورة 2 |
| `product.34` | صورة 3 |
| `product.35` | تمت الإضافة إلى السلة |
| `product.36` | أضف للسلة |
| `product.37` | متوفر |
| `product.38` | للحجم |
| `product.39` | اسأل عن توفره عبر واتساب |
| `product.40` | اطلب عبر واتساب |
| `product.41` | نوع القاعدة |
| `product.42` | القدرة |
| `product.43` | القطر |
| `product.44` | الارتفاع |
| `product.45` | [الارتفاع] |
| `product.46` | الخامة |
| `product.47` | [الخامة] |

## Layout
Mobile (390) (designed):
1. Header (shared). Breadcrumb: الرئيسية، category (link), current product (700).
2. Gallery (padding 8 16 0): main area 300 high, radius 12, dark product background; image 270x270 centered; arrows 44 round (white, 1px ink) at 10px from each edge, vertically centered; counter "1 / 4" (12px white on ink, radius 4) at the end-bottom corner; "غير متوفر" black label at the start-top corner when out of stock. Under it a row of thumbnails 56x56 radius 8 (8 gap); selected thumb has a 2px yellow border, others 1px control border; the last thumbnail is the video (play icon).
3. Title block (padding-top 20): h1 22/800 (1.35); a line with `الكود: [الكود]` 13 muted and the stock word (700, green "متوفر" or muted "غير متوفر"); price 28/800 with `· للحجم <size>` 13 muted.
4. Options card (white, padding 14, margin-top 16): "الحجم" (16/800) with chips; "اللون" with chips (dot 18px plus name); "الكمية" with the stepper. Unavailable options: disabled chip, struck through, extra text "· غير متوفر".
5. Buttons (stacked, gap 10, margin-top 16): yellow "أضف للسلة" 52 high; green "اطلب عبر واتساب" 52 high with icon.
6. Cards (margin-top 24 then 12): الوصف; المواصفات (rows with a label in muted and the value in 700, 1px lines); help card "هل تحتاج مساعدة في الاختيار؟" with a green small button.
7. Footer, bottom bar (tab: الأقسام), float.

Desktop (1280) and tablet: NOT designed (open item O-1). Interim: render the mobile layout in one centered column, `max-width: 480px` (`--page-max`), page background on both sides.

Header (SiteHeader), footer (SiteFooter), bottom bar (BottomBar, active tab: cats) and the WhatsApp float are shared parts defined once in `handoff.md` section 6. They are not repeated below.

## Components
| Element | Component | Variant | Props and result |
|---|---|---|---|
| Gallery | custom |  | arrows, thumbnails, video |
| Size chips | ToggleGroup item | toggle chip, single select | disabled when unavailable |
| Color chips | ToggleGroup item | toggle chip with dot | disabled when unavailable |
| Quantity stepper | custom | product (min width 48) | 1 to 99 |
| Add to cart | Button | primary large | disabled when out of stock |
| WhatsApp | Button | WhatsApp large | message W3; when out of stock the label is "اسأل عن توفره عبر واتساب" and the message is W4 |
| Spec list | `dl` rows |  |  |

## Data
Product: name, code, description, photos (up to the number uploaded), optional video, spec rows (base type, power, diameter, height, material and others the owner adds), sizes (label, price, availability), colors (label, swatch, availability). Price shown = price of the selected size. Default selection on load: the first available size and the first available color (the board shows 60 سم preselected as a sample). When all options are unavailable the product is "غير متوفر".

## States
Default (board 1). Out of stock (board 2): all chips disabled, stock word muted "غير متوفر", price muted, "أضف للسلة" disabled with the label "غير متوفر", WhatsApp button label changes. Loading (board 3): skeleton of the gallery, thumbnails, title, price, two bars and a button. After add: button ink fill, white text "تمت الإضافة إلى السلة" for 2 seconds. Error (not drawn): error card, retry and WhatsApp buttons. Not found: the not-found page.

## Interactions
1. Arrow or thumbnail changes the main image; arrows loop (after the last comes the first). Video thumbnail shows the video in the main area with native controls.
2. Size chip: selects the size, updates the price text and the price note.
3. Color chip: selects the color.
4. Stepper: − and + change the quantity, minimum 1, maximum 99.
5. "أضف للسلة": adds the quantity with the selected size and color to the cart and shows the added state.
6. "اطلب عبر واتساب": opens WhatsApp with message W3.
7. Breadcrumb category link returns to the category with its filters restored.

## Accessibility
Gallery images have Arabic alt text with the product name; arrows have `aria-label` ("الصورة السابقة", "الصورة التالية"); thumbnails have `aria-label` and `aria-pressed`. Size and color groups are labeled by their headings (`role="group"` with `aria-labelledby`). The stepper value is `aria-live="polite"`.

## SEO
Title: `<product> | S.K.F lighting`. Description: first 155 characters of the description. Share image: first product photo. Structured data: Product (name, sku = code, image, description) with Offer or AggregateOffer (`priceCurrency: "ILS"`, price from the sizes, availability InStock or OutOfStock).

## Open items
O-1 desktop layout. Photos and video are drawings on the board. Price per size is `₪ [السعر]`. Size guide or dimensions image: not designed. "Notify me when available" is not in scope.
