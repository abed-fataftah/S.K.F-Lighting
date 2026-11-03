# 0019. Customers and roles: rationale

The build spec is [index.md](index.md). This file is the decision record.

## Context

Spec 0017 gave the shop registered accounts. Every new account gets role `customer`, and no code writes `profiles.role` yet. The roles `customer`, `electrician`, and `admin` already exist as a Postgres enum. Each order copies the role of the account that placed it (`orders.placed_by_role`), and the dashboard order list already filters by it (spec 0014). What is missing is the owner's side: a place to see who has registered, find someone when they call, see everything about them, and decide who is an electrician. Electricians matter because Slice 6 (quick order, drafts, price adjustments) is built for them, and it can't start until an account can become one.

The scope's done line sets three conditions: only the owner can change roles, a change takes effect on the user's next page load, and each customer's details and order history are visible in one place. The second one depends on where the role is read. Today `requireAdmin()`, `getAccountProfile()`, and checkout's `readPlacedBy()` all read `profiles.role` from the database on each request, and none read it from the signed token's claims. Nothing has to change for the timing to hold; the risk is a later change that starts trusting a token claim.

Spec 0017 also handed this feature two jobs: correcting a customer's email, and removing an account by anonymizing it (spec 0002 sets the rule: clear the personal fields, and delete the login only while no coin ledger row points at the profile). Removal touches two systems: the shop database (through Drizzle) and Supabase Auth, which owns `auth.users`. The orders keep their own copies of name, phone, and address, so removing a profile does not by itself remove those copies.

Forces: one owner runs everything, often from a phone; a few hundred to a few thousand accounts; the project's rules forbid logging phones and addresses and require `requireAdmin()` inside every admin action; all data goes through Drizzle, with the Supabase client for auth only. Without a decision, the build would have to invent who appears in the list, what "owed" means, what removal does to old orders, and how a half finished removal is recovered.

## Options considered

### Overall shape

**Option 1: server rendered pages, guarded Server Actions with row locks, an events table, and the Auth admin API for the login delete.** The list and customer page are Server Components over `getDb()`, like `/admin/orders`. Each write is a Server Action that locks the profile row, checks, writes, and records an `account_events` row in one transaction. Removal clears the details in that transaction, then calls `auth.admin.deleteUser`.
- Pros: same pattern as every other dashboard area; each write is atomic in the database; a stale tab is caught by the `from` check; there's a lasting history; the login delete goes through Supabase's supported path.
- Cons: removal spans two systems, so it needs a "removal pending" state and a retry button; one new table and enum.

**Option 2: the same pages, with no history table (server logs only).**
- Pros: no migration; smallest build.
- Cons: you can't see in the dashboard who was promoted or edited when; logs expire; any later dispute about a role or a changed phone has no record.

**Option 3: store the role in the Supabase token (`app_metadata` or a custom access token hook) and read it from claims.**
- Pros: role checks without a database read; a common Supabase pattern.
- Cons: a change only reaches the user when their token refreshes (up to an hour), which breaks the scope's "next page load" condition; it means two sources of truth for the role; and everything that reads `profiles.role` today would need rewiring. It solves a performance problem the shop doesn't have.

### Who is listed

- **Accounts with role customer or electrician (chosen).** Clear and actionable; your own admin account, which you could never act on, stays out.
- **Accounts plus guests grouped by phone.** Richer, but a phone is not an identity (an electrician orders with each end customer's phone), and it mixes rows you can act on with rows you can't.
- **Every account, admin included.** Simplest query, but it adds a row that every action must refuse.

### Which role moves

- **Customer and electrician only (chosen).** Admin also needs an authenticator (`aal2`) and is the keys to the shop; granting it from a phone screen is the wrong place.
- **Also grant admin.** It would let a second owner be added from the dashboard, at the cost of a much larger security surface.

### Deleting the login

- **Auth admin API after a locked check (chosen).** The supported path, and it reuses the service role key that Storage already has. The cost is a short gap between the check and the delete, and a failure mode to recover from.
- **SQL delete from `auth.users` in the same transaction.** Fully atomic, but it writes into a schema Supabase Auth owns, where Supabase has been narrowing what the `postgres` role may do; a platform change could break removal silently.
- **Ban instead of delete.** It keeps every row, but the email stays taken forever, and it does not honour a deletion request.

### Old orders on removal

- **Keep the copies, unlink the account (chosen).** Orders are the shop's sales records; the existing `on delete set null` FK does the unlinking with no new code.
- **Scrub name, phone, and address on old orders.** Stronger privacy, but you lose who bought what, and the order search by phone stops finding them.

### Search transport

- **POST Server Action (chosen).** Matches the orders search and keeps phones and emails out of URLs, browser history, and Cloudflare request logs.
- **GET with `?q=`.** Shareable and back button friendly, but it puts personal data in URLs and logs.

### Name search matching (decided here)

- **Fold Arabic letters in SQL at query time (chosen).** A `translate` plus `regexp_replace` expression mirrors `normalizeForSearch`, with a parity test. No column to keep in sync across the trigger, register, the account page, and the dashboard edit.
- **A stored folded name column, like products' `search_text`.** Faster at scale and indexable, but four write paths (one of them a SQL trigger) must keep it current, for a table of a few thousand rows.

### Where the history table points (decided with you)

- **A plain `profile_id` uuid with no FK (chosen).** The `removed` row and earlier rows survive the profile's deletion and stay grouped. An id alone is not personal data.
- **FK with set null.** Rows survive but lose their grouping.
- **FK with cascade.** Removal erases its own record.

## Rationale

Option 1 is the only shape that meets all three of the scope's conditions without new machinery. "Only you can change roles" comes from `requireAdmin()` in every action, plus filtering admins out of every query. "Next page load" holds because the role already lives in one column read per request. Option 3 would break this condition while adding a second source of truth. "Details and order history in one place" is a read over tables that already exist. The one new table earns its place because role changes are access control changes, and the project treats those like money: they need a record you can see. Option 2 saves a migration but leaves the owner blind to their own past decisions.

Removal drove most of the design. A deletion request is the one moment the shop must prove it can forget someone, and the person's details live in two systems. Doing the database part first, under a row lock and in one transaction, means the shop's own personal fields are gone before anything can fail halfway. If the Auth API call then fails, what remains is a login (with its email and sign up metadata) that the storefront already treats as removed, plus a visible "finish removal" button that is safe to press twice. The storefront guard matters because the person can still sign in during that window; without it they could type their details back in or link new orders to an account being deleted. Doing the API call first would leave nothing to retry, but it would also skip the locked check for open orders and unpaid balances. Those checks exist so a removal never strands a delivery in progress or a debt nobody can trace. Keeping order copies follows from the same reasoning: they are business records, and the dialog tells the owner exactly that before they confirm.

The smaller calls follow the project's existing grain. The search reuses the orders search's POST shape and phone parsing, so a phone typed in Arabic digits behaves the same in both boxes. The order history reuses spec 0018's windowed query and load more, so electricians with hundreds of orders stay fast. The name search folds Arabic in SQL instead of storing a key, because the table is small and every stored derived value is another thing to keep in sync. A parity test makes the duplication safe.
