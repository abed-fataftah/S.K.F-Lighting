# 0008. Categories and browsing: rationale

Decision record for [index.md](index.md). `/develop` builds from `index.md`; this file says why.

## Context

The shop already stores categories (spec 0002: two levels, a slug, a sort, an `is_visible` switch, an optional description), and two features already create them by name: the product editor's inline field (spec 0006 AC-18) and the spreadsheet import (spec 0007). What is missing is a place for the owner to manage them, and any way for a customer to browse them: the bottom bar's "الأقسام" tab points at `/c`, which does not exist, and the menu sheet waits for a category list (spec 0003). Today the only storefront list is a temporary home grid of the newest sellable products.

The scope asks for four owner actions (add, rename, reorder, hide) and for category pages with clear empty and out of stock states. The design handoff draws the category page and the dashboard categories page, but leaves several things open: what hiding does, page size (O-10), the edit dialog (O-23), add to cart from a card with options (O-11), and the `/c` page itself. The filter screen it draws belongs to feature 11, which has its own decision still to make.

Forces at play: a single owner running the shop from a phone; a catalog of hundreds, not tens of thousands, of products; customers on phones with uneven connections; Cloudflare Workers with server rendering and no caching layer (Hyperdrive caching is off so prices and stock stay live); a rule from spec 0002 that one shared "sellable" rule guards every read and every order. Imports leave many categories at `sort` 0, so any ordering scheme must cope with ties. Shared links to categories travel on WhatsApp, so addresses should not break.

Not deciding leaves `/develop` to guess what a hidden category means. Each guess either leaks hidden products into the shop or blocks orders in surprising ways.

## Options considered

### Option 1: Server rendered pages, existing tables, "category shown" in the sellable rule

Category pages render on the server per request. "Load more" is a link to `?page=N`. Dashboard edits are small Server Actions on the existing columns. Hiding a category (or its main) removes its products from every storefront read and from ordering, by adding "category shown" to the one sellable rule.

**Pros**:
- No migration, no new endpoints for client fetching, no client data state; works without JavaScript.
- One meaning of "hidden" enforced where orders are checked, so nothing can leak.
- Pages are shareable at any depth and cheap to test.

**Cons**:
- Every storefront read and `placeOrder` must join the category and its parent; four call sites change together.
- "Load more" reloads the page, instead of appending in place as the design shows.

### Option 2: Navigation only hiding, client side "load more"

Hiding a category removes it from the menus and makes its page 404, but products keep their own status and stay on home and by link. "Load more" fetches the next 24 with a client component and appends them.

**Pros**:
- No change to the sellable rule or to ordering; the owner hides products one by one with the existing product status.
- Matches the design's "appends in place" exactly.

**Cons**:
- "Hidden" means two different things (the section is gone, its products are not), which the owner must remember; a hidden category's products still show on home.
- Needs a public read endpoint, client state, and loading and error handling for the appended part; the address does not keep the place.

### Option 3: Store a derived "listed" flag on products

Keep a stored `is_listed` column on products, updated by triggers or actions whenever a product, its variants, or its category change, and filter every read by it.

**Pros**:
- Storefront queries stay simple single table filters.

**Cons**:
- A stored derived value goes stale the moment one writer forgets to update it (editor, import, category actions, archive). It needs a migration and triggers to fix a performance problem nobody has measured.

## Rationale

Option 1 fits the forces best. The shop's promise is that what a customer sees can be ordered, and spec 0002 already keeps that promise in one sellable rule. Making "category shown" part of that rule means hiding a section works the way the owner expects (it is gone) and cannot be bypassed by an old link or a cart cookie. The cost is a join on four reads, which the parity test and DB tests guard. Option 2's split meaning of "hidden" is exactly the kind of rule that confuses a single owner months later. Option 3 trades a cheap join for a cache that can go wrong, at a catalog size where the join costs nothing.

Server rendering with a `?page=N` link suits Workers and phones: there is no extra endpoint, no client state, and no hydration cost for a list of 24 cards, and a shared WhatsApp link to page 2 works. The design's in place append was weighed against that; the jump and focus to the first new card keep a customer's place, and an append can be layered on later without changing the read.

Smaller calls made in the conversation or here, each with its runner up:

- **Subs follow their main, flags kept** (runner up: overwrite the subs' flags). Showing a main again restores exactly what was there.
- **Slug fixed on rename** (runner up: new slug plus a redirect table). Links on WhatsApp keep working with no new table; a redirect table can come later if old names in addresses ever matter.
- **24 per page** (runner up: 12). Twelve rows of two on a phone, matching the board's sample.
- **Spec chips are the first three rows' values** (runner up: fixed labels). The owner controls them by ordering specs in the editor, and a typo in a label cannot hide a chip.
- **Sub chips are links** (runner up: in page toggle). Server rendered, shareable, no client state.
- **`/c` lists the main categories** (runner up: all products). It matches the tab's name and gives customers the map of the shop.
- **In stock first, then newest** (runner up: plain newest first per spec 0002). Customers see what they can buy first; a deliberate change for category lists only.
- **Empty categories leave navigation** (runner up: always listed). Customers never tap into an empty section; the page itself still answers.
- **Menu lists mains only** (runner up: mains with subs). Short on a phone; subs are one tap away.
- **Sibling names unique** (runner up: allowed). The editor and import find categories by name, so duplicates would make them pick one at random.
- **Parent fixed at create** (runner up: a parent select in the dialog). Keeps the two level rule trivially true.
- **Editor's inline field removed** (runner up: keep it). Categories are made in one place; the import still makes them by name.
- **Last write wins** (runner up: a version column). One owner and tiny edits; reorder renumbers siblings in one transaction.
- **Delete only when empty, any product status counts** (runner up: no delete). Cleans up import typos; archived products still point at their category, so the foreign key already forbids it.
- **Reorder renumbers siblings in the transaction** (runner up: swap the two sort values). Swapping equal values does nothing, and imports leave many at 0.
- **Out of stock cards show the lowest live price, muted** (runner up: no price). Spec 0002 defines the list price over sellable variants only, which is empty for an out of stock product. A muted price still helps the customer decide whether to ask on WhatsApp. This is a call made in this spec, not in the conversation; change it here if you prefer no price.
- **The card adds the cheapest sellable option** (runner up: O-11's first available option, `pickVariantToAdd`). The card shows the lowest price, so adding anything dearer would surprise the customer in the cart. Settled after the cross check.
- **W4 on out of stock cards** (runner up: W3 everywhere). Follows `pages/product.md`, which already asks about availability for out of stock items.
- **Locks instead of unique indexes** for sibling names and sort (runner up: a unique expression index, which needs a migration). One owner rarely races; a lock in the same transaction closes the gap with no schema change. Settled after the cross check.
- **Pages 2 and up: noindex, no canonical** (runner up: canonical to page 1). Pointing a paged page's canonical at page 1 while also marking it noindex sends search engines mixed signals.
- **Slug fallback `qism`** when the name has no letters or digits to keep (runner up: refuse the name). Rare, and `nextFreeSlug` keeps it unique.
- **Category description at most 500 characters**: enough for a search engine description and a short intro.
