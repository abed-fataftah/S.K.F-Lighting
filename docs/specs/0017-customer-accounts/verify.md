# Verify: Customer accounts · spec 0017 · updated 2026-10-31
_Steps derived from spec 0017 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Before you start: `pnpm db:start` (restart it after any `supabase/config.toml` change), `pnpm db:migrate`, `pnpm dev`. Reset emails land in the local mail catcher at http://127.0.0.1:54324.

## UI / manual
- [ ] Open `/account` signed out → lands on `/account/sign-in?next=%2Faccount`, h1 "تسجيل الدخول", tab "تسجيل الدخول" has `aria-pressed="true"`, page is `noindex` → AC-1, AC-9
- [ ] Press "حساب جديد" → form changes with no page load, h1 "إنشاء حساب", address reads `?tab=register&next=%2Faccount` → AC-1
- [ ] Open `/account/sign-in?tab=bogus&error=bogus&notice=bogus` → login form, no message shown → AC-1
- [ ] Guest card: "المتابعة كضيف" goes to `/cart`, "تتبّع طلب" goes to `/orders/track` → AC-1
- [ ] Register with name "سارة", short password → focus on the name field, errors under name and password with `role="alert"`, email kept, password emptied → AC-3
- [ ] Register with a full name, a mobile, a new email, a password of 8+ characters → lands on `/account` signed in, name and phone shown, no missing phone notice → AC-2, AC-9
- [ ] Register with a password of 37 Arabic letters (74 bytes) → "كلمة المرور طويلة جداً." → AC-2
- [ ] Register with an email that already has an account → box "هذا البريد مسجّل مسبقاً." takes focus; its "تسجيل الدخول" opens the login form with the email filled and no email in the address → AC-3
- [ ] Register with a password from a known leak (in production, leaked password protection on) → message under the password field → AC-3, AC-16
- [ ] Signed in as a new account, open `/admin/orders` → sent to `/admin/login` → AC-4
- [ ] Sign in with a wrong password, then with an unknown email → both show "البريد الإلكتروني أو كلمة المرور غير صحيحة.", the box takes focus; while sending, the button reads "جارٍ الدخول" and is disabled → AC-5
- [ ] Open `/account/sign-in?next=%2F%2Fevil.example`, then `?next=%2Fadmin`, then `?next=%2F.%2Fadmin`, and sign in → each lands on `/account` → AC-6
- [ ] Open `/account/sign-in?next=%2Fp%2Fany%3Fsize%3D2` and sign in → lands on `/p/any?size=2` → AC-6
- [ ] Signed in, open `/account/sign-in?next=%2Fcart` → goes straight to `/cart` → AC-1
- [ ] "نسيت كلمة المرور؟" → reset form with no tabs, email carried over, address `?tab=reset`; send → "أرسلنا رابط الاستعادة إلى بريدك."; send again for an unknown email → the same message → AC-7
- [ ] Open the reset email in the mail catcher → Arabic subject "استعادة كلمة المرور في S.K.F", link `…/auth/confirm?token_hash=…&type=recovery` → AC-7, AC-16
- [ ] Open the link, reload it twice → the "متابعة" page still works (nothing used up); press "متابعة" → `/account/reset-password` → AC-8
- [ ] On `/account/reset-password`, mismatched confirmation → "كلمتا المرور غير متطابقتين." with focus there; matching → `/account?notice=password_set` with "تم تعيين كلمة المرور الجديدة." → AC-8
- [ ] Sign in on a second browser first, then reset on the first → the second browser is signed out on its next page → AC-8
- [ ] Open the used link again and press "متابعة" → reset form shows "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطاً جديداً." until the form is sent → AC-8
- [ ] Open `/account/reset-password` signed out → sent to sign in → AC-8
- [ ] On `/account`, change the name → "تم حفظ بياناتك.", still there after reload; a past order still shows the old name in the dashboard → AC-9
- [ ] Account with no phone → notice "أضف رقم هاتفك ليسهل علينا التواصل معك بخصوص طلباتك." above the cards → AC-9, AC-17
- [ ] Change password with a wrong current one → "كلمة المرور الحالية غير صحيحة." under it; same as current → "كلمة المرور الجديدة مطابقة للحالية."; valid → "تم تغيير كلمة المرور.", fields empty → AC-10
- [ ] "تسجيل الخروج" → home page; `/account` then asks to sign in; the cart and `skf_placed` / `skf_tracked` cookies are still there → AC-11
- [ ] The bottom bar's "حسابي" links to `/account` signed in or out, and is active on `/account`, `/account/sign-in`, `/account/reset-password` → AC-12
- [ ] Sign in as the owner on the storefront, then change the password on `/account` → "لتغيير كلمة مرور حساب لوحة التحكم اتبع دليل الاستعادة." and the dashboard asks for the code again → AC-4
- [ ] Signed in, add to cart, open `/checkout` → name and phone filled from the profile and editable; editing them does not change `/account` → AC-13
- [ ] Place that order → dashboard row shows "عميل"; open `/orders/<number>` from a fresh browser signed in to the same account → order page with no lookup and no new cookie → AC-13, AC-14
- [ ] Cancel it there → WhatsApp hand off, order cancelled, recorded as `guest` → AC-15
- [ ] Another signed in account opens `/orders/<number>` → lookup with the number filled; its cancel gets `not_found` → AC-14, AC-15
- [ ] Owner signed in at `aal2` opens a customer's `/orders/<number>` with no cookie → dashboard order page, as before → AC-14
- [ ] Tab through sign in, `/account`, `/account/reset-password`, `/auth/confirm` at 390 and 1280 → visible focus everywhere, every control at least 44 by 44, no sideways scroll → AC-18

## Value sourcing (one step per row)
- [ ] Register: `profiles.full_name` equals the typed name after tidying (send "  سارة   يوسف ") → stored "سارة يوسف"
- [ ] Register: `profiles.phone` is the cleaned typed phone and `phone_e164` its E.164 form (type "٠٥٩٩ ١٢٣ ٤٥٦") → "0599 123 456" and "+970599123456"
- [ ] Register: `profiles.role` is `customer` even when the sign up metadata carries `role: admin` (send it through the API)
- [ ] Register, sign in: where to go next follows a safe `next` from the page query, and an unsafe one falls back to `/account`
- [ ] Reset request: the email link starts with `NEXT_PUBLIC_SITE_URL` + `/auth/confirm` (change `NEXT_PUBLIC_SITE_URL` and the link follows; on preview the preview URL must be in the redirect list)
- [ ] Reset landing: the form holds `token_hash` and `type` from the query exactly; a `type` of `signup` lands on the expired message
- [ ] Reset landing: the session comes from `verifyOtp` (after "متابعة" the browser has Supabase auth cookies; before it, none)
- [ ] Account page: the email shown is the session's email claim (change it in the Supabase dashboard and sign in again; the new one shows)
- [ ] Account page: name, phone, and the missing phone notice come from `profiles` (null the phone in the database; the notice appears)
- [ ] Account page: the reset success line shows only with `?notice=password_set`, nothing for any other `notice`
- [ ] Change password: the current password is checked against the verified user's email (the form has no email field)
- [ ] Checkout page: prefill is empty signed out, and empty for a profile with a null phone
- [ ] Place order: `orders.placed_by_user_id` and the `created` event's `actor_user_id` equal the signed in user id; a form field named `placedByUserId` is ignored
- [ ] Place order: `placed_by_role` and `actor_kind` follow the role at submit (promote to electrician, order again → `electrician`); the owner's order has `placed_by_role = admin` and `actor_kind = customer`; signed out or with the profile row deleted → nulls and `guest`, and `order_profile_missing` logged for the latter
- [ ] Order page, cancel: ownership is `orders.placed_by_user_id = sub` (set another user id on the order in the database; the first account loses access)
- [ ] Bottom bar: the account tab link is `/account` whatever the session

## Commands
- [ ] `pnpm exec vitest run src/features/accounts src/lib/routes.test.ts src/features/shell` → all pass → AC-2 to AC-6, AC-10, AC-12, AC-17, AC-18
- [ ] `pnpm exec vitest run src/features/accounts/server/profile.db.test.ts src/features/orders/server/customer-order.db.test.ts src/features/checkout/server/place-order.db.test.ts src/features/orders/server/customer-actions.test.ts` (local database up) → all pass, none skipped → AC-2, AC-4, AC-9, AC-13 to AC-15
- [ ] `pnpm exec playwright test e2e/customer-accounts.spec.ts` → 10 pass (phone and desktop) → AC-1 to AC-18
- [ ] Server logs during the flows: every account line is `{ event, ok, code? }`; grep the dev server output for the test emails, names, phones, and passwords → no match → AC-17
- [ ] `grep -n "minimum_password_length\|template.recovery" supabase/config.toml` → 8 and the recovery template → AC-16
- [ ] `docs/runbooks/supabase-production.md` lists confirm email off, minimum 8, leaked password protection, the recovery template, Resend SMTP, the raised email rate limit, Site URL, and redirect URLs → AC-16

## Acceptance-criteria coverage
- AC-1: UI steps 1 to 4, 14 · AC-2: UI 6, 7, value rows 1 to 3 · AC-3: UI 5, 8, 9 · AC-4: UI 10, 27 · AC-5: UI 11 · AC-6: UI 12, 13 · AC-7: UI 15, 16, value row 5 · AC-8: UI 17 to 21, value rows 6, 7 · AC-9: UI 22, 23, value rows 8 to 10 · AC-10: UI 24, value row 11 · AC-11: UI 25 · AC-12: UI 26, value row 16 · AC-13: UI 28, 29, value rows 12, 13 · AC-14: UI 29, 31, 32, value row 14 · AC-15: UI 30, 31 · AC-16: UI 9, 16, commands 5, 6 · AC-17: UI 23, value row 13, command 4 · AC-18: UI 33, commands 1 to 3

# Verify: customer accounts hardening (build plan step 8) · spec 0017 · updated 2026-10-31
_Steps for the hardening from the cross check. On local Supabase a recovery `verifyOtp` writes `amr` method `otp`, not `recovery`, so the 10 minute window uses the spec's cookie runner up: `skf_recovery` (httpOnly, max age 600, value `<user id>.<seconds>`), set by `confirmRecovery`, checked by `isFreshRecovery` in `src/features/accounts/recovery-cookie.ts`, cleared after a new password is saved._
## UI / manual
- [ ] Open a reset link, press "متابعة" → `/account/reset-password` opens, and the browser holds an httpOnly `skf_recovery` cookie → AC-8
- [ ] Save a new password there, then open `/account/reset-password` again → lands on `/account` (one link sets one password) → AC-8
- [ ] Sign in with the password (no reset link) and open `/account/reset-password` → lands on `/account` → AC-8
- [ ] Open a reset link, wait past 10 minutes (or set the cookie's stamp 601 seconds back), then save → "انتهت مهلة رابط الاستعادة. اطلب رابطاً جديداً أو غيّر كلمة المرور من حسابي." in the alert box, and a reload of the page lands on `/account` → AC-8
- [ ] Open a reset link for account A, then copy its `skf_recovery` value into a browser signed in as account B → B's `/account/reset-password` lands on `/account` → AC-8
- [ ] View the source of `/auth/confirm?token_hash=x&type=recovery` → `<meta name="referrer" content="no-referrer">` → AC-8
- [ ] As the owner (role `admin`), sign in on the storefront and submit change password with any current password → "لتغيير كلمة مرور حساب لوحة التحكم اتبع دليل الاستعادة." and the server log shows no `account_sign_in` call for the check; an open dashboard session in another tab stays valid → AC-4
- [ ] Stop local Supabase Auth (`docker stop supabase_auth_SKF-Pro`) and sign in → "تعذّر إتمام العملية. حاول مرة أخرى.", not the wrong password message → AC-5
- [ ] Sign in as the owner of an order, revoke the session in Supabase (`delete from auth.sessions where user_id = …`), then cancel from the order page with no order cookie → refused as `not_found` → AC-15
## Commands
- [ ] `pnpm exec vitest run src/features/accounts/recovery-cookie.test.ts src/features/accounts/server/actions.test.ts src/features/orders/server/customer-actions.test.ts` → all pass → AC-4, AC-5, AC-8, AC-15, AC-17
- [ ] `pnpm exec playwright test e2e/customer-accounts.spec.ts` → 10 pass, including the referrer meta and both `/account/reset-password` redirects → AC-8
- [ ] In the action tests, a failing `signOut({ scope: "others" })` logs `{"event":"other_sessions_kept","userId":…,"code":…}` and the password set or change still succeeds → AC-17
## Acceptance-criteria coverage
- AC-4: UI 7 · AC-5: UI 8 · AC-8: UI 1 to 6, commands 1, 2 · AC-15: UI 9 · AC-17: command 3

# Verify: end the reset window when you leave (build plan step 9) · spec 0017 · updated 2026-11-01
_Steps for clearing `skf_recovery` on sign out and after a password change, so an unused reset link stops counting once you leave._
## UI / manual
- [ ] Open a reset link, press "متابعة", go to `/account` without saving and press "تسجيل الخروج" → the browser no longer holds `skf_recovery`; sign in with the password and open `/account/reset-password` → lands on `/account` → AC-8, AC-11
- [ ] Open a reset link, press "متابعة", go to `/account` and change the password with the current one → "تم تغيير كلمة المرور."; open `/account/reset-password` → lands on `/account` → AC-8
## Commands
- [ ] `pnpm exec vitest run src/features/accounts/server/actions.test.ts` → all pass, including `forgetRecovery` after a changed password (not after a wrong current one) and on sign out even when `signOut` fails → AC-8, AC-11
- [ ] `pnpm exec playwright test e2e/customer-accounts.spec.ts -g "unused reset window"` → 2 pass (phone and computer) → AC-8, AC-11
## Acceptance-criteria coverage
- AC-8: UI 1, 2, commands 1, 2 · AC-11: UI 1, commands 1, 2
