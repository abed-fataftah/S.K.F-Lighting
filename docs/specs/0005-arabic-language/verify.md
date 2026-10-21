# Verify: Arabic language · spec 0005 · updated 2026-10-20
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Steps marked **(with 0004)** need spec 0004's product form, checkout, and order pages. The storefront and checkout are built now (updated 2026-10-20); steps marked **(with 0004 admin)** wait on the admin product form and orders page (feature 6's last milestone).

## UI / manual
- [x] Open `/design-system` on a phone sized screen, browser language `ar-PS`, time zone `America/New_York` → the "أرقام وتواريخ ورموز" group reads `₪1,250`, `-₪50`, `1,250`, `20/10/2026 · 4:45 م`, `26-00123`, `059 912 3456`; no Arabic Indic digit anywhere on the page → AC-1, AC-3, AC-16
- [x] Same page with browser language `en-US`, time zone `Asia/Hebron` → exactly the same text → AC-1
- [x] Same page, the type section and the orders table → `₪48,300`, `₪1,250`, `₪340` → AC-2, AC-16
- [x] Inspect the group → `-₪50`, `₪1,250`, `26-00123`, `059 912 3456` each sit in `bdi[dir=ltr]`; the date sits in `<time datetime="2026-10-20T13:45:00.000Z">` with no `bdi` around or inside it, and `م` reads after the number → AC-14
- [x] In the first quantity stepper, type `١٢` and press Enter → the box shows `12` → AC-9
- [x] **(with 0004)** Checkout with phone `٠٥٩٩١٢٣٤٥٦` → accepted; `customer_phone` holds `0599123456`, `customer_phone_e164` holds `+970599123456`, and the WhatsApp message (W5) shows Western digits → AC-8, AC-9
- [x] **(with 0004)** Checkout with phone `‏0599 123 456` (a pasted RLM in front) → accepted; `customer_phone` holds `0599 123 456` → AC-9, AC-10
- [ ] **(with 0004 admin)** Product form: name `Philips 60W` → the field shows "اكتب هذا الحقل بالعربية" with focus on it; `ثريا كريستال Philips 60W` saves → AC-11
- [ ] **(with 0004 admin)** Product form: price typed `١٬٢٥٠` → saved as 125000 agorot and shown as `₪1,250` → AC-9
- [x] **(with 0004)** In an `ar-PS` browser on `America/New_York` time, open a product, then the cart, then checkout → every `₪` price in `main` sits in `bdi[dir=ltr]`, the product code too, and no Arabic Indic digit shows → AC-1, AC-14
- [x] **(with 0004)** Place an order, then open its confirmation page → the order number sits in `bdi[dir=ltr]` → AC-14
- [ ] **(with 0004 admin)** Admin orders list and order page → every price, order number, and phone in `bdi[dir=ltr]`; every order time is `formatDateTime` inside `<time>` → AC-14

## Value sourcing
- [x] Price shown or sent → comes from integer agorot through `formatPrice`; vary the amount across `0`, `1905`, `-5000`, `123456789` and check `₪0`, `₪19.05`, `-₪50`, `₪1,234,567.89` → AC-2
- [x] Date or time shown → the instant in `Asia/Hebron`, never the browser or server zone; check `2026-03-04T22:30:00Z` reads `05/03/2026` (already the next day) → AC-3
- [x] Which `ص`/`م` → the shop's clock; check `2026-10-24T12:00:00Z` reads `2:00 م` (Jerusalem would say 3:00) and `2026-10-19T21:05:00Z` reads `12:05 ص` → AC-4
- [x] Digit shapes → `0` to `9` in a browser set to `ar-PS` (the gallery steps above) → AC-1
- [x] Phone on a page → stored E.164 through `formatPhone`: `+970599123456` reads `059 912 3456`, `+972521234567` reads `052 123 4567` → AC-8
- [x] **(with 0004)** Phone in W5 and `customer_phone` → the typed text after `digitsField` (tidied, Western digits) → AC-9
- [x] Count in a message → `formatNumber(count)` as `shown`; the header cart link reads "السلة، 3 منتجات" → AC-7, AC-13
- [x] Field errors → `Validation.arabicRequired`, `Validation.tooShort`, `Validation.tooLong` in `ar.json`, with `min`/`max` passed through `formatNumber` (wired by 0004's forms) → AC-11
- [x] Search key → `normalizeForSearch` on both sides: `إنارةُ  الزينة` and `انارة الزينه` give the same key (feature 11 uses it) → AC-12

## Commands
- [x] `pnpm exec vitest run src/lib` → format, money, arabic, text schema, phone, and quantity tests pass → AC-2 to AC-12
- [x] `pnpm exec vitest run src/language-rules.test.ts` → planted fixtures caught, comments pass, the tree and `ar.json` pass → AC-13, AC-15
- [x] Plant `x.toLocaleString()` in any component and rerun the rule test → it fails naming the file; remove it → AC-15
- [x] `grep -rn "Asia/" src --include=*.ts --include=*.tsx | grep -v test` → only `src/lib/format.ts` → AC-16
- [x] `pnpm exec playwright test e2e/arabic-language.spec.ts` → passes on phone and desktop → AC-1, AC-9, AC-14, AC-16
- [ ] `E2E_TARGET=preview pnpm exec playwright test e2e/arabic-language.spec.ts` → same on workerd (UTC runtime) → AC-1, AC-3
- [x] `pnpm exec vitest run src/features/catalog src/features/checkout` → `Philips 60W` gives `arabic_required`, `١٬٢٥٠` gives 125000 agorot, `ch-١٠٢٠` gives `CH-1020`, and phones `٠٥٩٩١٢٣٤٥٦` and `‏0599 123 456` are cleaned → AC-9, AC-10, AC-11
- [x] `DESIGN_SYSTEM_PAGE=1 pnpm exec playwright test e2e/arabic-language.spec.ts e2e/guest-order.spec.ts` (after `pnpm db:seed`) → the storefront and guest order flows pass on the phone project → AC-1, AC-9, AC-14

## Acceptance-criteria coverage
- AC-1 gallery steps 1 and 2, workerd run · AC-2 money tests, value sourcing · AC-3 format tests, gallery · AC-4 format tests (clock changes) · AC-5 format tests, gallery date row · AC-6 format tests (hidden marks) · AC-7 format tests, cart count · AC-8 format tests, checkout (with 0004) · AC-9 stepper, phone and schema tests, checkout and price (with 0004) · AC-10 arabic tests, RLM checkout (with 0004) · AC-11 schema tests, product form (with 0004) · AC-12 arabic tests · AC-13 rule test · AC-14 gallery inspect, 0004 pages · AC-15 rule test, planted call · AC-16 grep, gallery
