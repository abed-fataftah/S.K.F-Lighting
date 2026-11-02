# Verify: checkout & delivery · spec 0012 · updated 2026-10-27
_Steps derived from spec 0012 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Run on a phone sized screen (390 wide) against `pnpm dev` or `pnpm preview`, with the dev seed (`pnpm db:seed`) and one product in the cart.

- [ ] Open `/checkout` with pickup chosen → only name, phone, and notes show; the summary's delivery row reads "بدون رسوم" → AC-5, AC-6
- [ ] Choose delivery → the zones الضفة الغربية ₪20 and الداخل (مناطق 48) ₪70 show in that order, the first is preselected, and the delivery row and total follow the chosen zone → AC-6
- [ ] Before any send, type `أحمد` in the name and leave the field → no error shows → AC-7
- [ ] Send with name `أحمد`, city `رام الله 2`, address `12345` → three inline errors ("اكتب الاسم الكامل…", "استخدم الحروف فقط…", "اكتب العنوان بالكلمات…"), focus on the name, each field has `aria-invalid` and `aria-describedby` pointing at its error → AC-1, AC-3, AC-4, AC-7, AC-9
- [ ] Type `أحمد يوسف` → the name error clears while typing and focus stays in the name → AC-7
- [ ] Change the phone to `059` → nothing shows while typing; leave the field → "اكتب رقم جوال صحيحًا…" appears without `role="alert"` → AC-2, AC-7
- [ ] Switch to pickup and back to delivery → the city and address errors are gone → AC-7
- [ ] Try the names `Ahmad Yousef`, `أحمد O'Neil`, `Abu-Bakr Saleh` (pass) and `أحمد 😊`, `ا ب`, `أحمد '` (refused) → AC-1
- [ ] Try the cities `القدس (الشرقية)`, `رام الله - البيرة` (pass) and `@@` (refused) → AC-3
- [ ] Try the addresses `قطعة 00000 قرب المسجد` (passes), `....!` (address letters), and `شارع ههههههه` (repeated) → AC-4
- [ ] Try the phones `+972 54 123 4567`, `00970599123456`, `٠٥٩٩١٢٣٤٥٦` (pass) and `022123456`, `+962791234567` (refused with the mobile message) → AC-2
- [ ] Place a delivery order to each zone → the WhatsApp text and the dashboard order show the same fee and total the summary showed, and the order's zone name matches → AC-6
- [ ] Place a pickup order after typing a city and address on delivery first → the saved order has no zone, city, address, or area → AC-5
- [ ] In dev tools, check the trap field `company_fax_2`: its wrapper is `inert`, `aria-hidden="true"`, and not `display: none`; the input has `tabindex="-1"` and `autocomplete="off"`; Tab never reaches it, and a screen reader never reads it → AC-8
- [ ] Set a value in `company_fax_2` from the console and send → "تعذّر حفظ الطلب. حاول مرة أخرى." shows, no order is saved, the cart keeps its line, and the server log has one `{"event":"order_honeypot"}` line → AC-8
- [ ] Check the autofill hints: name `autocomplete="name"`, phone `type="tel"` and `autocomplete="tel"`, city `address-level2`, address `street-address` → AC-10
- [ ] After an order, `localStorage`, `sessionStorage`, and cookies hold no name, phone, city, or address → AC-10
- [ ] Send a refused form and read the server log → only the error code and field names, never a typed value → AC-11

## Value sourcing
- [ ] Zone list and fees come from `delivery_zones`: set the second zone's fee to 7500 (or make it inactive) in the local database, reload `/checkout` → the form shows ₪75 (or hides it), no code change → AC-6
- [ ] Preselected zone follows `sort`: swap the two zones' `sort` locally → the other zone is preselected → AC-6
- [ ] Summary total is the zone fee plus the cart subtotal: change the cart quantity, come back → the total moves by the line price, the fee stays → AC-6
- [ ] Pickup line shows `shop_settings.address` → AC-5
- [ ] Live errors come from `checkoutSchema` in the browser and send errors from `placeOrder`: with live mode on, block the network and type a bad value then leave the field → the error still shows → AC-7
- [ ] Error text comes from `Validation.*` in `ar.json` → AC-9
- [ ] Honeypot verdict trims the value: a value of only spaces in `company_fax_2` is treated as empty and the order goes through → AC-8
- [ ] Saved `customer_name`, `city`, `address` are the tidied values: type `  أحمـــد   يوسف ` → the dashboard shows `أحمد يوسف` → AC-1
- [ ] Saved `customer_phone_e164` follows the network prefix: type `+972599123456` → saved as `+970599123456` → AC-2
- [ ] Saved `area` is always null, for pickup and delivery → AC-5
- [ ] Saved `delivery_fee`, `delivery_zone_name`, `total` come from the zone row: change a zone's fee while the checkout page is open, then send → "price changed" refusal, nothing saved (spec 0004 AC-8) → AC-6

## Commands
- [ ] `pnpm exec vitest run src/lib/text-schemas.test.ts src/lib/phone.test.ts src/features/checkout` → all pass, the database test not skipped → AC-1 to AC-5, AC-8, AC-9, AC-11
- [ ] `pnpm exec playwright test e2e/checkout-delivery.spec.ts --project=phone` → 5 passed → AC-6, AC-7, AC-8, AC-10, AC-12
- [ ] `E2E_TARGET=preview pnpm exec playwright test` → passes on workerd, including `rate-limit.spec.ts` (the checkout flows add three orders to the shared 5 a minute allowance) → AC-8, AC-12

## Acceptance-criteria coverage
- AC-1 name rules: manual steps 4, 5, 8 · unit `personName` · e2e rejection flow
- AC-2 phone: manual steps 6, 11 · unit `phone.test.ts`, `schemas.test.ts`
- AC-3 city: manual steps 4, 9 · unit `placeName`
- AC-4 address: manual steps 4, 10 · unit `addressText`
- AC-5 pickup drops delivery fields: manual steps 1, 13 · database test
- AC-6 zones and fees: manual steps 2, 12 · value sourcing · database test · e2e zone flows
- AC-7 live errors: manual steps 3 to 7 · e2e rejection and switch flows
- AC-8 bot trap: manual steps 14, 15 · unit `actions.test.ts` · e2e trap flow
- AC-9 messages and linking: manual step 4 · unit `textErrors` · e2e
- AC-10 autofill and no browser storage: manual steps 16, 17 · e2e pickup and rejection flows
- AC-11 logs: manual step 18 · unit `actions.test.ts`
- AC-12 phone flows and axe: `e2e/checkout-delivery.spec.ts` (axe in pickup, delivery, send errors, live error after blur, save failed)
