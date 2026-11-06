# Verify: shop settings and policy pages · spec 0025 · updated 2026-11-06
_Steps derived from spec 0025 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones. Settings are shop wide: put the WhatsApp number, zones, and pages back when you finish._

## UI / manual
- [x] Sign out, open `/admin/settings` and `/admin/settings/policies/terms` → both send you to `/admin/login` → AC-15
- [x] Sign in as the owner (aal2), open `/admin/settings` on a 390px screen → h1 "إعدادات المتجر", cards "بيانات التواصل", "رسوم التوصيل", "صفحات السياسات" in that order, `noindex`, no sideways scroll → AC-1
- [x] With no number saved, the "رقم واتساب" field shows `NEXT_PUBLIC_WHATSAPP_NUMBER`; it is `dir="ltr"` and `inputmode="tel"` → AC-2
- [x] Save an empty WhatsApp field → "أدخل رقم واتساب."; save `0599 765 432` → "أضف رمز الدولة في البداية، مثل 970."; save `9705991` → "أدخل رقم واتساب مع رمز الدولة، مثل 970599123456." → AC-2
- [x] Save `+٩٧٠ 599-765-432` → "تم حفظ الإعدادات." beside the button, the field shows `970599765432`, the database holds digits only → AC-1, AC-2
- [x] Save phone `12` → "أدخل رقم هاتف صحيحاً."; save phone and address empty → both stored as null → AC-2
- [x] Reload Home, a product page, `/c`, a category, search results, `/cart`, an order page, a confirmation page, the quick order screen, and `/policies/terms`; open the menu → every `wa.me` link uses `970599765432` → AC-3
- [x] Set `shop_settings.whatsapp_number` to null and reload Home → every link uses the env number; the error page (`[locale]/error.tsx`) always uses the env number → AC-4
- [x] In "رسوم التوصيل", save the West Bank fee as `12.5`, `501`, and empty → "أدخل رسوماً بالشيكل من 0 إلى 500، بدون كسور."; save `٢٥` → "تم الحفظ." and the field shows `25` → AC-5
- [x] Rename the West Bank zone to the other zone's name → "يوجد منطقة بهذا الاسم." under the name → AC-5
- [x] Reload Home → strip "توصيل: الضفة ₪25 · الداخل ₪70" and the delivery card shows ₪25; open checkout, pick delivery → fee ₪25 → AC-7
- [x] With checkout open, change the fee in the database, then send → refused with "الطلب تغيّر" and the fresh fee; send again → placed; change the fee again → the order keeps its `delivery_fee` and `delivery_zone_name` → AC-7
- [x] Pause the zone a checkout has picked, then send it → refused with the `zone_invalid` notice and the fresh zones → AC-7
- [x] Turn a zone's "مفعّلة" switch off → "جارٍ الحفظ", then "متوقفة"; block the request (offline) and flip it → it flips back with "تعذّر الحفظ. حاول مرة أخرى." in a `role="alert"` line → AC-6
- [x] Pause every zone → "التوصيل متوقف: كل المناطق غير مفعّلة، والاستلام من المعرض فقط متاح."; Home has no strip and no fee line; checkout offers pickup only → AC-6
- [x] "إضافة منطقة" → fill the new row → it appears active at the end of the list; at 10 zones the button is disabled with "الحد الأقصى 10 مناطق." → AC-6
- [x] Open `/policies/privacy`, `/policies/terms`, `/policies/returns` → h1 from the title, tab row in `nav aria-label="السياسات"` with the current tab `aria-current="page"`, "آخر تحديث: {date}" in shop time, the body, then "لديك سؤال؟" with "تواصل معنا عبر واتساب" opening "مرحباً، عندي سؤال عن سياسات المتجر."; title `{title} | S.K.F للإنارة`; indexable → AC-8
- [x] Open `/policies/about` → 404 → AC-8
- [x] Save a body with `# أ`, `#### ب`, a single Enter, `<script>`, an image, a quote, and `[x](javascript:alert(1))` → h2, h3, a line break, the script shown as text, no image, quote text only, `x` as plain text → AC-9
- [x] In the hub's policies card each page shows its title, "آخر تحديث", and "تعديل"; the editor has "العنوان", "النص" with the hint, the "معاينة"/"تعديل" toggle (preview drawn like the live page), "حفظ الصفحة" → "تم حفظ الصفحة.", and "عرض الصفحة" opening a new tab → AC-10
- [x] Type in the editor, then close the tab → the browser asks before leaving; click an in app link → no question → AC-10
- [x] Open one editor in two tabs, save in the first, then save in the second → "عُدّلت هذه الصفحة من مكان آخر بعد أن فتحتها. انسخ نصك، ثم أعد تحميل الصفحة." and the typed text stays; saving twice from the first tab works → AC-11
- [x] Under checkout's send button → "بإرسال طلبك فإنك توافق على الشروط والأحكام و سياسة الإرجاع."; both links open in a new tab, end with a hidden "(تفتح في نافذة جديدة)", and the typed form stays → AC-12
- [x] The footer and the menu policy links reach all three pages; each page has no sideways scroll at 390px → AC-13
- [x] After the migration the three pages exist; the returns draft says within 7 days of delivery, unused and in the original box, and the order number on WhatsApp → AC-14

## Value sourcing
- [x] Storefront links: saved number → it; null, failed, or slower than 1.5 s → env (unit test for the timeout) → AC-3, AC-4
- [x] Contact field: saved number, else env → AC-2
- [x] Stored WhatsApp: digits only after Arabic digits, `+`, spaces, `-`, `(`, `)` → AC-2
- [x] Stored phone: tidied text with Western digits, 7 to 15 digits; empty → null. Stored address: the checkout address rule; empty → null → AC-2
- [x] Zone fee field shows `fee / 100`; stored fee is shekels × 100; shown fee goes through `formatPrice` → AC-5
- [x] A new zone's `sort` is the highest plus 1; the 11th zone is refused → AC-6
- [x] Home fee line and checkout zones come only from active zones → AC-6, AC-7
- [x] Policy title, body, and date come from `pages`; the date is `updated_at` in `Asia/Hebron` (check near midnight UTC) → AC-8
- [x] The editor keeps `pages.version`; a stale save writes nothing → AC-11
- [x] Checkout line targets are `routes.terms` and `routes.returns` → AC-12

## Commands
- [x] `pnpm db:migrate` then `pnpm db:check-rls` → passes; `pages` has RLS and no grants → AC-14, AC-15
- [x] `pnpm exec vitest run src/features/settings src/features/policies src/features/shell src/server/db/schema` → all pass → AC-2, AC-4, AC-5, AC-6, AC-9, AC-11, AC-14, AC-15
- [x] `pnpm exec playwright test e2e/policies.spec.ts --project=phone --project=desktop` → passes → AC-8, AC-9, AC-12, AC-13, AC-14
- [x] `pnpm exec playwright test e2e/shop-settings.spec.ts --project=settings --no-deps` → passes and puts the settings back → AC-1 to AC-8, AC-10, AC-11, AC-15
- [x] `pnpm exec opennextjs-cloudflare build`, then compare the gzipped `.open-next/server-functions/default/handler.mjs` with the Oct 29 baseline (2.02 MB) → roughly 100 KB more, under the Workers limit → spec 0025 Feature design

## Acceptance-criteria coverage
- AC-1 to AC-4: contact steps and the storefront link steps · AC-5 to AC-7: zone steps · AC-8, AC-9, AC-13, AC-14: policy page steps · AC-10, AC-11: editor steps · AC-12: checkout line · AC-15: sign out step and the action unit tests
