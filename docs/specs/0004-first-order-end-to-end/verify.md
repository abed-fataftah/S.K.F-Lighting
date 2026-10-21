# Verify: First order end to end · spec 0004 · updated 2026-10-21
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Setup: `pnpm db:start`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`. Make an owner account in Supabase Studio (Authentication, Add user, auto confirm), then `pnpm admin:promote <email>`. Use a phone sized window (390 wide).

## UI / manual

### Admin sign in (milestone 3)
- [ ] Signed out, open `/admin/orders?page=2` → lands on `/admin/login?next=%2Fadmin%2Forders%3Fpage%3D2` → AC-1
- [ ] Sign in at `/admin/login` with a customer account's correct password → one generic message, still on `/admin/login`; then a wrong password for the owner → the exact same message → AC-1
- [ ] Owner email and password → `/admin/mfa`. With no factor: press "ابدأ الإعداد" → a QR code and the key as text appear; reload and start again twice; scan on two devices; type one code → `/admin/orders`. Studio (Authentication, the user, MFA) shows exactly one verified factor → AC-1
- [ ] Sign out (sidebar) → `/admin/login`; sign in again → asked only for a code (no setup); a wrong code shows an error and keeps focus in the field; the right code goes on → AC-1
- [ ] After the password only (no code yet), open `/admin/orders` directly → sent to `/admin/mfa?next=%2Fadmin%2Forders` → AC-1
- [ ] Sign in through `/admin/login?next=/admin/products/new` → lands on `/admin/products/new`; with `next=//evil.com` or `next=/admin%5Cx` → lands on `/admin/orders` → AC-1
- [ ] While signed in at `aal2`, run `pnpm admin:mfa-reset <owner email>` → it reports the factors removed; the next dashboard page load in the browser goes to `/admin/login` at once (not after the token's hour) → AC-1
- [ ] `pnpm admin:promote nobody@example.test` → a clear "No account with the email" message and exit code 1 → AC-1

### Owner adds a product, then sees the order (milestone 4)
- [ ] `/admin` → redirects to `/admin/orders` → AC-13
- [ ] `/admin/products/new`: name "ثريا تجربة", code ` ab-12 `, a new category name "فئة تجربة", price `١٢٥٫٥` → "تم حفظ المنتج" with a link to the product page; the link opens `/p/ثريا-تجربة-AB-12` showing ₪125.50 → AC-2
- [ ] Add another with code `ab-12` → "هذا الرمز مستخدم لمنتج آخر" on the code field, focus on it, nothing saved → AC-2
- [ ] Add another typing the new category name ` فئة تجربة ` again → it reuses that category (one row in `categories`); a name whose slug is taken gets `-2` → AC-2
- [ ] Price `0`, `1000000.01`, `12.345`, or empty → the price error; no category and no new name → "اختر فئة أو اكتب اسم فئة جديدة" → AC-2
- [ ] As a guest (another browser), order the new product for delivery; back in the dashboard the order is first in `/admin/orders` with "جديد", name, phone, "توصيل", total, and the time in shop time → AC-13, AC-16
- [ ] Open it → every line (name, code, option, quantity, unit price, line total), subtotal, fee, total, zone, city, address, notes; back on the list the "جديد" badge is gone → AC-13
- [ ] `/admin/orders?page=abc`, `?page=0`, `?page=-1` → page 1; with more than 50 orders "الصفحة التالية" appears → AC-13
- [ ] Every dashboard page above passes the axe check at 390 and at 1280 wide; at 390 the sidebar sits above the content and the tables scroll inside their box → AC-16

## Commands
- [ ] `pnpm exec vitest run` → all pass, including `promote.db.test.ts`, `admin-queries.db.test.ts`, `create-product.db.test.ts` on the local database → AC-1, AC-2, AC-13
- [ ] `pnpm exec playwright test e2e/admin-sign-in.spec.ts e2e/first-order.spec.ts --project=phone` → all pass → AC-1, AC-2, AC-13, AC-16
- [ ] `E2E_TARGET=preview pnpm exec playwright test --project=rate-limit --no-deps` → the sixth submission in a minute shows "حاول مرة أخرى بعد دقيقة" and saves nothing → AC-10
- [ ] Under `pnpm dev`, the first order submission logs `{"event":"order_rate_unchecked"}` once if the binding is missing, and the order still saves → AC-10
- [ ] `pnpm db:check-rls` → passes → security model

## Value sourcing checks
- [ ] Role comes from `profiles.role`: set the owner's role to `customer` in Studio while signed in → the next dashboard page goes to `/admin/login` → AC-1
- [ ] Assurance level comes from the `aal` claim: a password only session (`aal1`) never opens a dashboard page, even with `next` set → AC-1
- [ ] Product `code` is the input trimmed and uppercased; `slug` is `buildProductSlug(name, code)`; the variant price is `parseShekels` of the typed price (Arabic digits and `٫` included) → AC-2
- [ ] A new category: top level, `sort = 0`, `is_visible = true`, slug from `slugify(name)` with `-2`, `-3` on a clash → AC-2
- [ ] Rate limit key is `cf-connecting-ip`; two different IPs each get their own 5 a minute (workerd) → AC-10
- [ ] Admin list `isNew` comes from an unseen `created` event: set `seen_at` on that event in Studio → the badge disappears without opening the order → AC-13
- [ ] Shown times use `Asia/Hebron`: an order placed at 22:30 UTC shows the next day's date in the dashboard → AC-13

## Acceptance-criteria coverage
- AC-1 … admin sign in steps, the reset and promote commands, role and aal checks
- AC-2 … product form steps, slug and price sourcing checks
- AC-10 … the workerd rate limit test, the dev fail open log, the per IP check
- AC-13 … list, detail, paging, and seen flag steps, the time zone check
- AC-16 … the guest order seen in the dashboard, axe on every dashboard page, `first-order.spec.ts`
- AC-3 to AC-9, AC-11, AC-12, AC-14, AC-15 … built in milestones 1 and 2; covered by `guest-order.spec.ts` and their unit tests
