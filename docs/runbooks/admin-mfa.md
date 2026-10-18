# Runbook: admin sign in and authenticator codes

From spec [0001](../specs/0001-stack-architecture/index.md). The admin signs in with email and password, then a 6 digit code from an authenticator app (Supabase MFA, TOTP). Supabase has no backup codes, so plan for a lost phone now.

> The `/admin` pages and the two scripts below are built with the admin features (feature 6 for sign in, feature 20 for roles). Until then this runbook describes the intended setup.

## First admin

1. Sign up on the site like any customer. You start with role `customer`.
2. From a trusted machine with `DATABASE_URL_DIRECT` set to production, run:
   ```
   pnpm admin:promote <your email>
   ```
3. Open `/admin`. You are sent to `/admin/mfa` to set up an authenticator app.
4. **Enroll two devices** (for example your phone and a tablet). If one is lost, the other still works.

## Lost one device

Sign in with the other device, then remove the lost one and enroll a replacement on `/admin/mfa`.

## Lost both devices

1. From a trusted machine with `SUPABASE_SERVICE_ROLE_KEY` and the production Supabase URL set, run:
   ```
   pnpm admin:mfa-reset <your email>
   ```
   This removes your authenticator factors using the service role key.
2. Sign in with email and password, then enroll two devices again on `/admin/mfa`.
3. Keep the service role key off shared machines. Anyone holding it can do this reset.
