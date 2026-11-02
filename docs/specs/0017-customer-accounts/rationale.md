# 0017. Customer accounts: rationale

Decision record for [index.md](index.md). `/develop` reads the index; this file holds the why.

## Context

Until now every shopper is a guest: they order with a name and phone and follow the order with its number plus phone (specs 0012, 0015). That works for one off buyers, but returning customers type the same details each time, and the features after this one need an owner on each order. My Orders (19), promoting electricians (20), electrician drafts (21), and loyalty coins (31) all hang off a signed in user.

Much is already decided. Spec 0001 chose Supabase Auth with cookie sessions, a reset link landing on `/auth/confirm`, and Resend as the mail sender. Spec 0002 built `profiles` (made by a trigger with role `customer`) and `orders.placed_by_user_id`. The owner already signs in with email and password plus an authenticator code, and the dashboard guard checks role `admin` and `aal2`. The design package draws one screen, `/account/sign-in`, with email and password, a register form that also asks for name and phone, and a reset form. It notes that social sign in is out of scope, and phone sign in (O-14) is not designed.

The forces: customers are mostly on phones, in Arabic, and many are not used to accounts, so friction costs sign ups. The shop has no SMS provider, so anything that needs a code by text is a new vendor and a cost per message. The owner is one person, so recovery paths that need manual help should be rare. Personal data (names, phones, addresses) must never be logged, and nothing may weaken the dashboard's protection.

Left undecided, each later feature would have to invent its own idea of "the signed in customer", and orders placed now would never be linked.

## Options considered

### Option 1: Email and password on Supabase Auth, through Server Actions (chosen)

Register with name, phone, email, and password; signed in at once; reset by an emailed link; a small account page for details and password.

**Pros**:
- Matches the design board and spec 0001, and reuses the owner sign in's client and patterns.
- Every account has an email, so self service reset always has somewhere to go.
- No new vendor or cost.

**Cons**:
- Customers must remember a password.
- Without email confirmation, a typo in the email cuts off reset.

### Option 2: Option 1 plus Google sign in

Add the Google button spec 0001 planned.

**Pros**:
- One tap sign in for Android users with a Google account.
- No password to forget.

**Cons**:
- Google gives no phone, so an extra "add your phone" step is needed before the account is useful.
- Not in the design; needs a Google OAuth client, and does not work on preview deploys (no wildcard callback URLs).
- Two sign in paths to test and support.

### Option 3: Phone and password (or a phone code)

Use the phone, which every customer already gives at checkout, as the identifier.

**Pros**:
- Familiar locally; matches how the shop already identifies guests.

**Cons**:
- Reset, and any proof of phone ownership, needs an SMS provider: a new vendor, a cost per message, and delivery problems across Palestinian and Israeli networks.
- Not designed (O-14); the shared phone problem (families, small businesses) makes a phone a weak identifier.

## Rationale

Option 1 wins because it is the only option that is fully designed, needs no new vendor, and gives every account a self service recovery path that a one person shop needs. Google (Option 2) mainly saves typing a password, but it costs a phone collection step, OAuth setup, and a sign in path that previews cannot test. It can be added later without breaking anything, since Supabase links identities by email. A phone identifier (Option 3) is attractive locally, but without SMS it cannot be verified or recovered, and a phone shared by a family would mean a shared account.

The engineer chose each of these on the record:

- **No email confirmation.** The design has no "check your inbox" state, and the shop's customers are the least tolerant of friction. A typo costs a reset path, which the owner can fix in feature 20. Requiring confirmation would also make every registration depend on Resend being live.
- **Only new orders link.** Claiming guest orders by phone is unsafe, since the phone is never verified. Claiming by this browser's cookies risks pulling a relative's order into the wrong account on a shared phone. The lookup still serves old orders.
- **Phone required, not unique.** The shop needs a phone to reach a customer on WhatsApp. Making it unique would let anyone block the real owner by registering their number first.
- **Prefilled but editable checkout.** This keeps gifts and orders for someone else easy without overwriting the profile.
- **Owner opens and cancels own orders; cancel still recorded as `guest`.** Opening and cancelling are needed so a signed in owner without the cookie is not stuck. Recording the right actor was left for later (spec 0016 follow-up stays open).
- **8+ characters and leaked password protection.** A real floor that is easy on a phone keyboard; Supabase Pro already includes the breach check.
- **Supabase limits plus a honeypot**, not Turnstile. This matches checkout's approach. Turnstile can be added if sign up spam shows up.
- **Taken email said plainly.** Without email confirmation, a neutral message would leave a real customer confused, and knowing an email is registered at a lighting shop is low value to an attacker.
- **The owner's account works on the storefront.** Admin access is still gated by `aal2` in the dashboard, so nothing weakens.
- **Sessions until sign out; no self service deletion.** These are normal for a shop, and they keep a service role key out of customer actions.
- **Current password required to change it.** This stops someone with an unlocked phone from taking over the account.
- **The account tab always links to `/account`.** If the shared layout read the session, every storefront page would become dynamic.

### Calls made while writing (runner up in brackets)

- **Server Actions with the server Supabase client** [browser Supabase client]. They give the same pattern as `signInAdmin`, Zod and the honeypot run on the server, `@supabase/ssr` writes the cookies in one place, and the error mapping is testable as a pure function. The browser client would skip a round trip but split validation across two places.
- **`token_hash` reset links verified in `/auth/confirm`** [PKCE `code` links]. A PKCE link only works in the browser that asked for it. Customers often request a reset on a computer and open the email on their phone, and a `token_hash` link works anywhere. The link lands on a page with a "متابعة" button, and the button verifies the token, because email scanners and WhatsApp link previews open links with a GET and would use up a token verified on GET (found in the cross check). The link uses `{{ .RedirectTo }}` so preview deploys keep their own links.
- **Current password checked with `signInWithPassword`** [Supabase reauthentication code by email]. It needs no extra email, and the customer already knows their password. The cost is a fresh session and one sign in against the rate limit, both acceptable.
- **`getVerifiedUser()` for account writes, `getClaims()` for reads** [`getClaims()` everywhere]. This follows the project's auth rule: a revoked session must not change a password or profile, while reads stay fast.
- **Honeypot on register and reset only** [all three forms]. Sign in creates nothing and sends no email, and Supabase already limits guessing.
- **A separate `accounts` feature** [merge with `admin-auth`]. Customer and owner sign in differ in tabs, redirects, MFA, and copy. Sharing only `createSupabaseServerClient` and the session helpers keeps each simple.
- **The 10 minute reset window is an httpOnly `skf_recovery` cookie bound to the user id** [an `amr` entry with method `otp`]. The first pick was the session's `amr` claim with method `recovery`, but local Supabase showed (2026-10-31) that a recovery `verifyOtp` records method `otp`, the same as a magic link. The engineer chose the cookie the spec had named as its fallback. It depends on nothing Supabase does, and the threat it answers is a casual person with an unlocked phone. The cost: with no signing secret, someone with developer tools could fake it (noted in Consequences). The `otp` claim is signed and cannot be faked, but it trusts that no other `otp` sign in ever reaches a customer account.
- **Owner check before the cookie check on the order page** [after]. Otherwise an owner signed in at `aal1` would hit the admin redirect before their own order could render.
