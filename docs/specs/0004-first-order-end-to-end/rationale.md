# 0004. First order end to end: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md` and skips this file.

## Context

The shop's build approach is Tracer Bullet: prove that one real order travels the whole system before any part grows wide. Specs 0001 to 0003 settled the stack, the data model, and the design system, but none of them says what the thinnest real path actually contains. Without that, the first build would have to invent where the cart lives, which checkout fields are required, how the owner signs in, and what the WhatsApp message says, and each guess would leak into features 12 to 16.

Several forces pull on this slice. The customer pays in cash or cheque, so the order itself is the contract: the total the customer sends on WhatsApp must be the total the shop saved. Guests order with no account, so anyone on the internet can submit the form, and order numbers run in sequence, so a number alone must never reveal a customer's phone or address. The owner sees every customer's personal data in the dashboard, which is why spec 0001 requires a second factor (`aal2`) for every admin page and action. The site runs on Cloudflare Workers, where browsers on phones (iOS Safari most of all) block pop up windows that open after a network wait, which shapes how WhatsApp can open.

The data model has one mismatch with the checkout design: `orders.city` is required, but the design has no city field and pickup customers have no reason to give one. Feature 5 (digits and price format) is not decided yet, but every page of this slice shows prices.

If this is not decided now, the build either stalls on each question or bakes in guesses that later features must undo with breaking changes.

## Options considered

### Option 1: Server rendered slice with a cookie cart and Server Actions

Every page renders on the server. The cart is an httpOnly cookie of variant ids and quantities that only Server Actions write. `placeOrder` is one Server Action and one transaction that reads live prices, compares the total with the one the customer saw, and uses an idempotency key (a random id per attempt, so a retry finds the first result instead of making a second order). The admin path is the full spec 0001 flow with TOTP.

**Pros**:
- Cart, checkout, and the header count render with live prices and no client fetch, so there is no loading flicker and no price shown that the server did not compute.
- Fits the existing stack exactly (Server Actions, `getDb()`, Zod on both sides) and needs no new service.
- Duplicate orders and changed prices are handled at the one place money is written.

**Cons**:
- The cart does not follow a signed in customer across devices.
- Every request carries the cookie, and cart changes need a server round trip.

### Option 2: Browser cart in localStorage with a pricing Server Action

The cart lives in localStorage. The cart and checkout pages render a shell, then call a Server Action to price the lines.

**Pros**:
- No cookie on every request; cart changes are instant in the browser.
- The usual pattern in many shop templates.

**Cons**:
- Cart and checkout show a loading state on every visit, and the header count only appears after the page loads in the browser.
- Two sources of truth (browser state and server prices) that must be kept in sync in client code.
- localStorage can throw or be empty in private windows, which needs more fallback code.

### Option 3: Thinnest possible thread, no admin UI

Products come only from the dev seed or SQL, the dashboard is a plain list behind password sign in, and MFA waits for feature 15.

**Pros**:
- The fastest way to see an order in the database.
- Less UI to build now.

**Cons**:
- Breaks spec 0001's `aal2` rule while real customer phones and addresses are visible.
- Does not prove the owner's half of the path, which the scope's Done when requires ("you sign in to the dashboard and add one simple product").
- The admin guard pattern that every later admin feature copies would be designed late.

## Rationale

Option 1 wins because the order is the contract in a cash and cheque shop. Pricing on the server at render time and again inside the placing transaction, with an exact total comparison, means the customer can never send a total the shop did not save, which is the failure that would cost the owner money or trust. A cookie cart is the simplest way to give the server that cart on every render; at 30 lines of about 50 bytes it stays far under the 4 KB cookie limit, and spec 0002 already decided carts are not stored in the database.

The engineer chose the full admin path over Option 3's shortcut because the dashboard shows every customer's phone and address from the first order on, and because every later admin feature copies the guard built here. Putting `requireAdmin()` inside every action and admin query, not only the layout, follows spec 0001: Server Actions are public POST endpoints.

The smaller calls follow the same reasoning. The confirmation page opens only for the browser that placed the order (a cookie of order ids), since sequential numbers would otherwise expose names, phones, and addresses. WhatsApp opens by sending the tab to wa.me once on the confirmation page, because pop ups after a network wait are blocked on phones, while a page change is not. The city field appears only for delivery and the column becomes nullable with a delivery check, because relaxing a constraint is additive (old code still works) and pickup customers should not type a city the shop does not need. Spam is limited with the Workers rate limiting binding (no new service, no friction) rather than a bot check widget, which feature 13 can add if spam shows up. Prices go through one `formatPrice` with the `design.md` interim rule, so feature 5 changes a single function.

Smaller choices made while writing (pick, why, runner up):
- **W5 line amount is the line total**, not the unit price: the owner reads what each line costs at a glance; runner up, unit price with the quantity.
- **The checkout page makes the idempotency key on render**, not the browser: works with no client script before hydration; runner up, `crypto.randomUUID()` in the form component.
- **`skf_placed` keeps 5 order ids for 7 days**: covers a customer placing a few orders in a row; runner up, a single id, which would lock out the first of two quick orders.
- **First admin is created in the Supabase dashboard, then promoted**, since customer sign up is feature 18; runner up, a script that creates the user too, which means handling a password on the command line.
- **`admin:mfa-reset` ships in this slice**, because enforcing TOTP without the recovery script risks locking the owner out; runner up, waiting for feature 20.
- **`otpauth` for TOTP codes in tests**: small, no native code, works in Node; runner up, `otplib`.
