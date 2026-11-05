# Runbook: admin sign in and authenticator codes

From spec [0001](../specs/0001-stack-architecture/index.md), built in spec [0004](../specs/0004-first-order-end-to-end/index.md). The admin signs in at `/admin/login` with email and password, then a 6 digit code from an authenticator app (Supabase MFA, TOTP). Supabase has no backup codes, so plan for a lost phone now.

## First admin

Customer sign up arrives with the accounts feature (18). Until then, create the owner's account by hand:

1. In the Supabase dashboard: **Authentication → Users → Add user**. Enter the owner's email and a strong password, and tick **Auto Confirm User**. The account starts with role `customer`.
2. From a trusted machine with `DATABASE_URL_DIRECT` set to production (the session pooler URL), run:
   ```
   pnpm admin:promote <owner email>
   ```
   It says so clearly if no account has that email, or if the account has no profile row.
3. Open `/admin/login` and sign in. You are sent to `/admin/mfa` to set up an authenticator app.
4. Press **ابدأ الإعداد**, then **scan the same QR code on two devices** (for example your phone and a tablet), or type the key shown under it into both. Then type one code to finish. If one device is lost, the other still works.

## Lost one device

Sign in with the other device. To set up a new second device, reset the factor (below) while you still have one working device, then enroll both devices again in one go.

## Lost both devices

1. From a trusted machine with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set to production (locally the script reads `.env.local` and `.dev.vars`), run:
   ```
   pnpm admin:mfa-reset <owner email>
   ```
   This removes every authenticator factor on the account and signs it out of every session.
2. Sign in at `/admin/login` with email and password, then set up two devices again on `/admin/mfa`.
3. Keep the service role key off shared machines. Anyone holding it can do this reset.

## Change or reset the owner's password

The storefront's "نسيت كلمة المرور؟" and "تغيير كلمة المرور" (spec 0017) cannot change this account's password: Supabase asks for the authenticator code before it changes the password of an account that has one, and the storefront never asks for codes. Both forms answer "لتغيير كلمة مرور حساب لوحة التحكم اتبع دليل الاستعادة." and point here.

1. From a trusted machine, as in "Lost both devices", run:
   ```
   pnpm admin:mfa-reset <owner email>
   ```
   This removes the authenticator factors and signs the account out everywhere.
2. On the storefront, open `/account/sign-in?tab=reset`, request the link for the owner email, open it, press "متابعة", and save the new password.
3. Sign in at `/admin/login` with the new password and set up two devices again on `/admin/mfa`.

Signing in on the storefront with the owner account is fine for shopping, but it replaces the browser's session, so the dashboard asks for a code again afterwards.

## Notes

- Failed password attempts are limited by Supabase Auth (its sign in rate limits), not by the app.
- A wrong password and a correct password on an account that is not an admin show the same message, so the page never says whether an email exists.
