# Verify: First order end to end · spec 0004 · updated 2026-10-23
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: `pnpm db:start`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`. Make an owner account in Supabase Studio (Authentication, Add user, auto confirm), then `pnpm admin:promote <email>`. Use a phone sized window (390 wide).

## UI / manual

### Admin sign in (milestone 3)
- [x] Signed out, open `/admin/orders?page=2` → lands on `/admin/login?next=%2Fadmin%2Forders%3Fpage%3D2` → AC-1
- [x] Sign in at `/admin/login` with a customer account's correct password → one generic message, still on `/admin/login`; then a wrong password for the owner → the exact same message → AC-1
- [x] Owner email and password → `/admin/mfa`. With no factor: press "ابدأ الإعداد" → a QR code and the key as text appear; reload and start again twice; scan on two devices; type one code → `/admin/orders`. Studio (Authentication, the user, MFA) shows exactly one verified factor → AC-1
- [x] Sign out (sidebar) → `/admin/login`; sign in again → asked only for a code (no setup); a wrong code shows an error and keeps focus in the field; the right code goes on → AC-1
- [x] After the password only (no code yet), open `/admin/orders` directly → sent to `/admin/mfa?next=%2Fadmin%2Forders` → AC-1
- [x] Sign in through `/admin/login?next=/admin/products/new` → lands on `/admin/products/new`; with `next=//evil.com` or `next=/admin%5Cx` → lands on `/admin/orders` → AC-1
- [x] While signed in at `aal2`, run `pnpm admin:mfa-reset <owner email>` → it reports the factors removed; the next dashboard page load in the browser goes to `/admin/login` at once (not after the token's hour) → AC-1
- [x] `pnpm admin:promote nobody@example.test` → a clear "No account with the email" message and exit code 1 → AC-1

### Owner adds a product, then sees the order (milestone 4)
- [x] `/admin` → redirects to `/admin/orders` → AC-13
- [x] Make the category "فئة تجربة" on `/admin/categories` first (spec 0008). Then `/admin/products/new`: name "ثريا تجربة", code ` ab-12 `, choose "فئة تجربة", price `١٢٥٫٥` → "تم حفظ المنتج" with a link to the product page; the link opens `/p/ثريا-تجربة-AB-12` showing ₪125.50 → AC-2
- [x] Add another with code `ab-12` → "هذا الرمز مستخدم لمنتج آخر" on the code field, focus on it, nothing saved → AC-2
- Retired (spec 0008 AC-17 removed the inline category field): reusing a typed category name. Instead, on `/admin/products/new` there is no "أو قسم جديد" field and a "إدارة الأقسام" link is shown; category making is verified in spec 0008's `verify.md` → AC-2
- [x] Price `0`, `1000000.01`, `12.345`, or empty → the price error; no category chosen → "اختر القسم الرئيسي" on the category field → AC-2
- [x] As a guest (another browser), order the new product for delivery; back in the dashboard the order is first in `/admin/orders` with "جديد", name, phone, "توصيل", total, and the time in shop time → AC-13, AC-16
- [x] Open it → every line (name, code, option, quantity, unit price, line total), subtotal, fee, total, zone, city, address, notes; back on the list the "جديد" badge is gone → AC-13
- [x] `/admin/orders?page=abc`, `?page=0`, `?page=-1` → page 1; with more than 50 orders "الصفحة التالية" appears → AC-13
- [x] Every dashboard page above passes the axe check at 390 and at 1280 wide; at 390 the sidebar sits above the content and the tables scroll inside their box → AC-16

## Commands
- [x] `pnpm exec vitest run` → all pass, including `promote.db.test.ts`, `admin-queries.db.test.ts`, `create-product.db.test.ts` on the local database → AC-1, AC-2, AC-13
- [x] `pnpm exec playwright test e2e/admin-sign-in.spec.ts e2e/first-order.spec.ts --project=phone` → all pass → AC-1, AC-2, AC-13, AC-16
- [x] `E2E_TARGET=preview pnpm exec playwright test --project=rate-limit --no-deps` → the sixth submission in a minute shows "حاول مرة أخرى بعد دقيقة" and saves nothing → AC-10
- [x] `pnpm exec vitest run src/features/checkout/rate-limit.test.ts` → passes, including "fails open without a binding or when it throws" (both give `unchecked`) → AC-10
- [x] Under `pnpm dev` (the binding is live there too), five order submissions in a minute go through and the sixth shows "حاول مرة أخرى بعد دقيقة"; the dev log has no `order_rate_unchecked` line. Wait a minute after it before any other order check → AC-10
- [x] `pnpm db:check-rls` → passes → security model

## Value sourcing checks
- [x] Role comes from `profiles.role`: set the owner's role to `customer` in Studio while signed in → the next dashboard page goes to `/admin/login` → AC-1
- [x] Assurance level comes from the `aal` claim: a password only session (`aal1`) never opens a dashboard page, even with `next` set → AC-1
- [x] Product `code` is the input trimmed and uppercased; `slug` is `buildProductSlug(name, code)`; the variant price is `parseShekels` of the typed price (Arabic digits and `٫` included) → AC-2
- Retired (spec 0008 AC-17): the new category values from the product editor. Spec 0008 AC-2 now sets them (`nextFreeSlug`, `sort` one above its siblings) and its `verify.md` checks them → AC-2
- [x] Rate limit key is `cf-connecting-ip`; two different IPs each get their own 5 a minute (workerd) → AC-10
- [x] Admin list `isNew` comes from an unseen `created` event: set `seen_at` on that event in Studio → the badge disappears without opening the order → AC-13
- [x] Shown times use `Asia/Hebron`: an order placed at 22:30 UTC shows the next day's date in the dashboard → AC-13

## Acceptance-criteria coverage
- AC-1 … admin sign in steps, the reset and promote commands, role and aal checks
- AC-2 … product form steps, slug and price sourcing checks
- AC-10 … the workerd rate limit test, the fail open unit tests, the limit under dev, the per IP check
- AC-13 … list, detail, paging, and seen flag steps, the time zone check
- AC-16 … the guest order seen in the dashboard, axe on every dashboard page, `first-order.spec.ts`
- AC-3 to AC-9, AC-11, AC-12, AC-14, AC-15 … built in milestones 1 and 2; covered by `guest-order.spec.ts` and their unit tests
