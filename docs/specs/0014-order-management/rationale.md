# 0014. Order management: rationale

Decision record for [index.md](index.md). `/develop` builds from the index; this file holds the why.

## Context

The tracer bullet (spec 0004) proved an order travels from the cart into the dashboard. What the owner has today is a list of the latest 50 orders with a "جديد" badge, and a read only page per order that clears the badge on open. Every order stays `new` forever, because nothing can change its status. Spec 0002 deliberately left the status rules to this feature: it gave the columns (`status`, `delivered_at`, `cancelled_*`) and an event log (`order_events` with `seen_at`), and noted the starter path, but said "feature 15 decides who moves it and enforces transitions in its action".

The forces are a single owner running a small shop from a phone and a computer, with orders arriving through the site and conversations happening on WhatsApp. Two things must hold. The status the customer will see (features 16 and 17 build on this) has to be right, so wrong taps need an undo, and two places changing one order must not silently overwrite each other. And no order may be missed, which means the flag has to be visible from anywhere in the dashboard, not only on the list.

There are project rules that shape the design. Every admin write checks the session again (`requireAdmin()`). The browser never queries the database, and RLS grants nothing to `anon` or `authenticated`. Customer phones and addresses never go into logs. And Workers observability is on, so request URLs are logged by Cloudflare. Volume is small (tens of orders a day at most), so the list can be server rendered on every request without a cache.

Without this feature, the owner cannot tell a customer where their order is, cannot find an order by the phone a customer messages from, and loses new orders among old ones as the list grows.

## Options considered

### Option 1: Thicken the server rendered pages, with URL filters and Server Actions

Keep the two existing server rendered routes. Filters are URL search params read by the server component; status moves and cancels are Server Actions with a guarded update; a phone search is a Server Action returning rows; a small client timer calls `router.refresh()` for live updates.

**Pros**:
- Reuses the guard, query, and paging code that spec 0004 already ships and tests.
- Filters are bookmarkable and survive back and reload with no client state.
- Little JavaScript: only the status card, dialog, search, and refresher are client components.

**Cons**:
- Every filter change is a full server render (fast at this volume, but not instant).
- The phone search result lives in client state, so it is the one view not in the URL.

### Option 2: A client data grid fed by a route handler

Render the list as a client table (for example TanStack Table) that fetches JSON from an admin route handler, filters and sorts in the browser, and polls for updates.

**Pros**:
- Instant filter changes once data is loaded; column sorting comes for free.
- Polling only fetches JSON, not a whole render.

**Cons**:
- A second data path (route handler plus client cache) to guard, test, and keep in step with the server pages.
- Phone numbers and addresses of every loaded order sit in browser memory; filtering in the browser means loading more rows than are shown.
- More JavaScript on a phone, and a new library to learn for a list of tens of rows a day.

### Option 3: A live dashboard on Supabase Realtime

Subscribe the dashboard to `orders` and `order_events` changes through Supabase Realtime, so new orders and cancellations appear instantly.

**Pros**:
- Truly instant: no polling delay, no wasted refreshes.

**Cons**:
- Realtime's database changes need `select` rights for the `authenticated` role through RLS, which breaks the project rule of no grants to `anon` or `authenticated`.
- A browser side Supabase data path, which the rules reserve for auth and Storage only.
- A websocket per open tab and a new failure mode (dropped connections) for a gain of under a minute.

## Rationale

Option 1 wins on the forces in Context. The volume is small enough that a server render per filter change costs nothing a person notices, and it keeps one data path, the one spec 0004 already guards in the layout, every query, and every action. Option 2's speed is real but buys it with a second data path and with customer details of every row held in the browser, against the project's server boundary rule. Option 3 is the only one with instant updates, but it needs exactly the grants the RLS rule forbids, and a one minute delay is acceptable for a shop that already answers on WhatsApp.

The smaller calls were made inside Option 1:

- **Status set.** Six statuses: O-3's five plus `out_for_delivery`, so the order page (feature 16) can tell a delivery customer it is on its way. `confirmed` stays unused, since a separate check step before preparing is one more tap on every order with no new information for the customer (the owner already talks to them on WhatsApp). Runner up: O-3's five.
- **Moves.** Forward with skips plus one step back along the path. Skips match reality (a small pickup order is often ready at once); the step back fixes a wrong tap without a database fix. The step back follows the path, not the history, so it needs no event lookup and stays a pure function; the cost (undoing a skip lands one step short) is stated in Consequences. Delivered and cancelled are final, so payments, coins, and returns (later features) never see an order go back and forth. Runner up: strict one step at a time.
- **Enforcement.** A pure rule function plus a guarded update (`for update` read, then `where status = from`), not a database trigger. The rules stay in one TypeScript place, unit tested without mocks, while the guard closes the race. A trigger would duplicate the rules in plpgsql. Runner up: also a trigger.
- **`orders_delivered_check`.** Mirrors the existing `orders_cancelled_check`, so the database itself keeps `delivered_at` and the status in step. It is additive and safe, since no row is delivered yet.
- **Next step buttons over the designed select.** One tap for the usual move, cancel kept apart behind a dialog, so a wrong pick on a phone is less likely. The select from the board would be two taps and would put cancel in the same list.
- **Unseen flag.** Opening an order clears it (what is built), customer cancellations raise it again, and the owner's own writes are stored seen so they never alert the owner. The flag reads "لم يُفتح", not "جديد", so it cannot be confused with the `new` status badge.
- **Live refresh.** A 60 second `router.refresh()` while the tab is visible, skipped while typing or in a dialog so it never interrupts a form. Runner up: refresh on navigation only, which would let a new order wait unseen while the owner edits products.
- **Search by POST.** A phone in the query string would be recorded in Cloudflare's request logs. Order numbers hold no personal data, so a number search simply opens the order; only phones go by POST, and phone results ignore the list filters so a customer's whole history shows. The short form (`42`) uses this year's series because customers read their number aloud and the year prefix is the part they drop. Runner up: keep the search in the URL.
- **Date filter.** Presets for the common cases plus a from and to pair, in shop days through new `format.ts` helpers, because that file is the only place allowed to know the time zone (spec 0005). A reversed range is swapped rather than refused, since the intent is obvious.
- **Out of scope**: the payment column (feature 24, it would read "unpaid" on every order until then), private notes, editing customer details, a print slip, and the dashboard home. Each is listed in Follow-up.
