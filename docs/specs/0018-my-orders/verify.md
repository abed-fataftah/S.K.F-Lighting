# Verify: My Orders · spec 0018 · updated 2026-11-23

_Steps derived from spec 0018 acceptance criteria, with two later changes: spec 0023 AC-13 (a cancelled order with money paid shows the amount owed back) and spec 0029 AC-15 (two cards across from `md`, replacing the 480px column of AC-10). `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Signed out, open `/account/orders` → lands on `/account/sign-in?next=%2Faccount%2Forders`; sign in → back on `/account/orders` → AC-1
- [ ] On `/account/orders` → title "طلباتي | S.K.F للإنارة", `meta robots` has `noindex`, h1 "طلباتي" → AC-1
- [ ] Signed in as the owner (shopping as themself) → the same page with only the owner's own orders → AC-1
- [ ] An account with an older inserted order plus a real checkout → both cards, newest first → AC-2
- [ ] Two orders with the same `placed_at` → the higher `order_number` comes first → AC-2
- [ ] A second account → sees only its own orders, never the first account's numbers; a guest order with the same phone never shows → AC-2
- [ ] A card → order number (`dir="ltr"`) at the start, status badge at the end, "{date} · {items}" muted, total in ₪, "عرض الطلب" link labelled "عرض الطلب {number}" that opens `/orders/{number}` → AC-3
- [ ] An order with one line → "منتج واحد"; two lines → "منتجان"; three → "٣ منتجات" style count from `formatNumber` → AC-3
- [ ] The date on a card placed at 23:30 UTC → shows the next day (shop time zone `Asia/Hebron`, spec 0005) → AC-3
- [ ] No payment recorded → no money line on any card → AC-4
- [ ] `amount_paid` set to total minus ₪10 → "المتبقي ₪10"; set to the total → "مدفوع" → AC-4
- [ ] Cancel an order with ₪10 paid → badge "ملغي" and "مبلغ يُعاد إليك ₪10" (spec 0023 AC-13); cancel one with nothing paid → no line → AC-4
- [ ] 21 orders → 20 cards, "تم عرض 20 من 21 طلب", "عرض المزيد"; tap it → `?page=2#o-21`, card 21 in view, the line and link gone → AC-5
- [ ] `?page=abc` and `?page=0` → 20 cards; `?page=9` → all 21, no link; `?page=999999999` → renders, no error → AC-5
- [ ] A new account → empty card: icon disc, h2 "لا توجد طلبات بعد", the line, and "تصفّح الأقسام" to `/c` → AC-6
- [ ] "بياناتي وكلمة المرور" under the h1 → `/account`; "طلباتي" on `/account` → back; both reachable by Tab with a visible focus outline and at least 44px tall → AC-7
- [ ] Phone: the bottom bar's "حسابي" tab → `/account/orders`, marked current; desktop: the header's account link → `/account/orders` → AC-8
- [ ] Sign in or register with no `next` → lands on `/account/orders`; the password reset flow still lands on `/account?notice=password_set` → AC-8
- [ ] Slow the database (or throttle) → three skeleton cards with `role="status"` and a hidden "جارٍ التحميل..." → AC-9
- [ ] Stop the database and reload → the shared error card with retry and WhatsApp; the server log holds no name, phone, or address → AC-9
- [ ] At 390 → one card across; at 820 and 1280 → two cards across inside the shared shell, no sideways scroll → AC-10

## Commands

- [ ] `pnpm exec vitest run src/features/orders/my-orders.test.ts src/lib/routes.test.ts src/features/shell/nav.test.ts src/features/accounts/next-path.test.ts` → all pass → AC-11
- [ ] `pnpm exec vitest run src/features/orders/server/my-orders.db.test.ts` (local Supabase running) → all pass → AC-2, AC-11
- [ ] `pnpm exec playwright test e2e/my-orders.spec.ts --project=phone --project=desktop --workers=2` → 6 passed → AC-11
- [ ] `pnpm exec playwright test e2e/customer-accounts.spec.ts e2e/shell.spec.ts --project=phone --project=desktop --workers=2` → all pass (landing and tab changes) → AC-8

## Acceptance-criteria coverage

- AC-1 by the sign in round trip, the title and robots step, the owner step · AC-2 by the newest first, tie, and second account steps plus the database test · AC-3 by the card, count, and time zone steps · AC-4 by the three money line steps · AC-5 by the 21 orders and bad page steps · AC-6 by the empty step · AC-7 by the links step · AC-8 by the tab and landing steps plus the accounts and shell flows · AC-9 by the skeleton and failure steps · AC-10 by the widths step · AC-11 by the commands
