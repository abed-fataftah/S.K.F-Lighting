# Verify: Order confirmation & WhatsApp · spec 0013 · updated 2026-10-27
_Steps derived from spec 0013 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones. Run on the dev seed (`pnpm db:seed`), on a 390 phone screen and on 1280._

## UI / manual
- [x] Place a delivery order for the table lamp (كبير, أسود) with two lines of notes, then open `/checkout/done/<number>` → top to bottom: the number card, "ما الخطوة التالية؟", the green and outline buttons, then "ملخص الطلب"; no "متابعة الطلب" button → AC-2
- [x] Look at the number card → the dashed number, the copy button, "الهاتف: 0599123456" with the phone in `bdi[dir=ltr]`, then "احتفظ برقم الطلب ورقم الهاتف لمتابعة الطلب."; no name, city, or address in this card → AC-3
- [x] Press the copy button → the clipboard holds the plain number, the text under it reads "تم نسخ رقم الطلب", focus stays on the button → AC-4
- [x] Make `navigator.clipboard.writeText` reject, press copy → "تعذّر النسخ"; with no Clipboard API → no button, and the empty live region is still there → AC-4
- [x] Summary row → a 52px photo (the product's first image, or the placeholder), "أباجورة طاولة حديثة", "كبير · أسود · الكمية 1", and the line total → AC-5
- [x] "الاستلام" block → "توصيل إلى الضفة الغربية", then "<city>، <address>" exactly as typed → AC-6
- [x] "ملاحظات" block → the notes, line break kept; a pickup order with no notes has no block → AC-7
- [x] Totals → subtotal, fee, and total match the fee and total in the W5 text and the `orders` row; no discount row → AC-8
- [x] Place a pickup order → "استلام من المعرض", the shop address from settings on its own line (no line when blank), and "بدون رسوم" → AC-6, AC-8
- [x] Float on the confirmation → its link text is "مرحباً، بخصوص الطلب رقم <number>." with no direction marks; on `/` it is W1; on another browser's `/checkout/done/<number>` the page is the plain 404 with no float → AC-9
- [x] Open `/checkout/done/99-99999` and `/checkout/done/%E0%A4%A` in any browser → HTTP 404, "الصفحة غير موجودة", no float, never a 500 → AC-2, AC-9
- [x] Green button → its link text equals the W5 the hand off sent; a refresh with `?wa=1` removed does not hand off again → AC-10
- [ ] Both WhatsApp links → `https://wa.me/<digits>?text=…`, `target="_blank"`, `rel="noopener"`; on 1280 it opens wa.me's page, on a phone it opens the app → AC-11
- [x] DevTools console and storage after placing and viewing → no name, phone, city, address, or notes logged; the only new storage key is `skf-wa-<orderId>` → AC-12
- [x] axe on the confirmation, pickup and delivery, on 390 and 1280 → no violations, every target 44px, no sideways scroll → AC-13

## Value sourcing
- [x] Change the product's photos after ordering → the summary shows the new first photo (current image by design), the name and options stay as saved → row photo, row name
- [x] Change a variant's price after ordering → the line total, subtotal, and total on the page stay the saved ones → subtotal, fee, total
- [x] Change the shop address in settings → a pickup order's summary shows the new address; blank it → the line goes away → pickup address
- [x] Type the phone with spaces or Arabic digits (`٠٥٩٩ ١٢٣ ٤٥٦`) → the phone line shows the saved, cleaned form → phone line
- [x] Open `/checkout/done/26%2D<n>` in the placing browser → the float still sends W7 with `26-<n>` → float message

## Commands
- [x] `pnpm exec vitest run src/features/orders src/features/shell/fab-message.test.ts` → passes (`isOrderNumber`, `orderSummaryView`, `orderNumberInPath`) → AC-1, AC-5 to AC-9
- [x] `pnpm exec vitest run src/features/checkout/server/queries.db.test.ts` (local database) → passes (subtotal, pickup address only for pickup, first photo per line, nothing without the id) → AC-2, AC-5, AC-6
- [x] `pnpm exec vitest run src/features/orders/whatsapp-message.test.ts` → passes unchanged → AC-10
- [x] `pnpm exec playwright test e2e/order-confirmation.spec.ts --project=phone --project=desktop` → 4 passed → AC-2 to AC-13
- [x] `pnpm exec playwright test e2e/guest-order.spec.ts e2e/shell.spec.ts e2e/cart.spec.ts` → passes (hand off, W1 float, cart photos on the shared fragment) → AC-10, AC-9

## Acceptance-criteria coverage
- AC-1 vitest `isOrderNumber` · AC-2 page order step, db test · AC-3 number card step · AC-4 copy steps · AC-5 row step, db test · AC-6 receive steps, db test · AC-7 notes step · AC-8 totals steps · AC-9 float step, `orderNumberInPath` tests · AC-10 green button step, W5 tests · AC-11 links step · AC-12 console and storage step · AC-13 Playwright on 390 and 1280 with axe

## Notes from the build
- Resolved by `/architect` on 2026-10-27: AC-9 and AC-13 now expect the root 404 with no float on another browser's `/checkout/done/<number>`; AC-5 uses "الكمية {quantity}" and AC-3 uses `Confirmation.phoneLine` with the `<ltr>` tag, as built.
