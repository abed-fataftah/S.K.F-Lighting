# 0020. Electrician quick order and drafts: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file explains why.

## Context

Electricians are the shop's biggest buyers. A typical job (a villa, a shop fit out) needs 20 to 30 different items, often many of each, and the electrician prices it for their own customer before anything is ordered. The storefront cart was built for a shopper browsing product pages one at a time: it lives in a browser cookie, caps quantities at 99, and is gone on another device. Spec 0019 can now make an account an electrician, but that role unlocks nothing yet.

The scope settled two things already. An electrician's order belongs to the electrician's account but carries the end customer's name, phone, and address. And "done" means a 30 line order built without opening product pages, kept as a named draft, edited later, and sent, with a missing quantity blocking the send. Spec 0002 sketched `drafts` and `draft_lines` tables in advance (live prices, nullable quantity, one line per option, a sent draft kept and hidden). The design handoff drew both pages for phones: a per line product search with size and colour selects, a "save as draft" button, and a send button that opens the WhatsApp step. The design leaves out where the end customer's details go, how the search suggestions look, and the desktop layout.

The forces: electricians work on site, on phones, on weak connections, so losing typed work is the main risk. Prices can change between quoting and sending, and the end customer may have been told a price. The order must be indistinguishable from a checkout order downstream (dashboard, My Orders, WhatsApp, payments later), so a second order path would double every later feature's work. Drafts hold end customers' personal data, which the project never logs and keeps no longer than needed. The app runs on Workers with a per request database client, so long held connections or server side sessions are not available.

Without this feature, Slice 6 cannot start: feature 22 (add to draft from the catalog) and feature 23 (electrician price adjustments) both assume electrician orders and drafts exist.

## Options considered

### Option 1: Server drafts with autosave, sent through the shared order insert (chosen)

Every quick order is a named draft row from the moment it has a name. Each field or line change saves through a small Server Action. A GET endpoint feeds the per line product search. Send runs the checkout's checks and the same order insert in one transaction, then deletes the draft.

**Pros**:
- Nothing typed is lost, and drafts follow the electrician across devices.
- One object to build, test, and extend; feature 22 just adds lines to it.
- One order insert for checkout and drafts; downstream features see one kind of order.

**Cons**:
- Many small writes, and partial lines in the database (nullable columns, three line states).
- Autosave UX is more work than a form: a save queue, a status line, retries, leave warnings.

### Option 2: A quick order form with an optional "save as draft" button

The page works like the cart: lines live in the page, and an explicit save stores a snapshot as a draft. Send works without saving.

**Pros**:
- Matches the design board's button exactly.
- Far fewer writes; drafts only contain lines the electrician chose to keep.

**Cons**:
- A closed tab, a dead battery, or a dropped connection loses the whole order; on a 30 line order that is the failure electricians will remember.
- Two states to reason about (saved and unsaved), and a "you have unsaved changes" dialog on every navigation.

### Option 3: Drafts kept in the browser only

Drafts live in local storage; only send reaches the server.

**Pros**:
- No new tables, no write traffic, fully offline while drafting.

**Cons**:
- Drafts do not follow the electrician to another device, and clearing the browser loses them.
- Goes against spec 0002's server tables, and feature 22 would have to write into browser storage from catalog pages.

### Option 4: Orders with a `draft` status

A draft is an `orders` row in a new status, turned into `new` on send.

**Pros**:
- No second set of tables; send is a status change.

**Cons**:
- Every order read (dashboard, My Orders, reports, counts, the totals check constraint) must learn to skip drafts, forever.
- Orders copy prices and require a quantity and customer fields; drafts need the opposite. Spec 0002 already rejected this for those reasons.

## Rationale

The main force is the job site: an electrician pricing a job on a phone will lose a form's worth of work sooner or later, and a 30 line order is too much to lose. That makes autosaved server drafts (Option 1) the right call over the form with a save button (Option 2), even though the design drew the button. The button survives as a status line, so the design's place on the screen keeps a purpose. Server tables over browser storage (Option 3) follow from the same force plus the cross device need, and they are what spec 0002 planned. A draft status on orders (Option 4) would leak into every order query for the life of the shop.

Sending through the checkout's own insert, inside one transaction that also deletes the draft, keeps one order path. Using the draft id as the order's idempotency key makes a double tap, a retry after a timeout, or a second device all land on the same order. The price check copies checkout's rule (refuse and show when the total moved) because an electrician quotes prices to their customer; a quiet change would land on them. Deleting the sent draft, rather than keeping it hidden as spec 0002 sketched, removes a second copy of the customer's phone and address that no screen reads.

The smaller calls follow the same grain. Half filled lines are saved (nullable product and option) because autosave that silently drops a line is worse than no autosave. One line per option, refusing a duplicate rather than merging, keeps lines from jumping while typing and gives feature 22 a clean merge target. The quantity cap rises to 999 for drafts only, since electricians buy spotlights by the hundred and the one line per option rule forbids splitting. The search is a GET endpoint, not a Server Action, because Server Actions run one at a time per page and the search would otherwise wait behind autosaves. The Combobox comes from the shadcn Base UI registry because the kit runs on Base UI already and its combobox carries the ARIA behaviour that is easy to get wrong by hand. Last save wins across devices, with the page reloading when it comes back into view, because a version check would refuse an electrician's own quick edits on a slow phone far more often than it would save a real conflict.

## Decisions settled with the engineer (2026-11-03)

| Question | Decision |
|---|---|
| Quick order vs drafts | Every quick order is a draft |
| Saving | Autosave every change; the design's save button becomes a status line |
| Product picker | Per line combobox as designed; an exact option code fills size and colour too |
| Send | From the draft page directly; same W5 WhatsApp page as checkout |
| Draft name | Typed first ("name first, then lines unlock"), renamable, unique per owner |
| Limits | 30 open drafts, 30 lines each (design, scope, and cart agree on 30) |
| Price change before send | Refuse, show new prices, send again |
| After send | Draft deleted in the same transaction; the order lives in My Orders |
| Who | Electricians only; others redirected to `/account` |
| End customer details | Checkout's rules, checked only at send; a "بيانات الزبون" card on the page; a "الطلب لي" shortcut |
| Unsellable lines | Marked "غير متوفر", send blocked until removed |
| Demotion | Drafts kept and hidden; back on promotion |
| Partial lines | Saved; they block send |
| Duplicate option | Refused, pointing to the existing line |
| Quantity | 1 to 999 |
| Product deleted while on a draft | Archived instead |
| Two devices | Last save wins per field; the page catches up |
| List order | Last edited first |
| Combobox | shadcn Combobox on Base UI |
| Search transport | GET route handler |
| Suggestion rows | Thumbnail, name, code, price |
| Save timing | Choices at once, quantity on leave, text on pause or leave |
| Searchable products | Same as the storefront |
| Totals | Subtotal, delivery, total |
| WhatsApp | One added line naming the electrician |
| Entry | A card on `/account` |
| Failed save | Kept on the page, retried, leave warning, send blocked |
| Remove line | At once with undo |
| Delete draft dialog | Names the draft, says it cannot be undone |
| Desktop | The design's interim 480 px column |
| Owner view of drafts | None; only sent orders |
