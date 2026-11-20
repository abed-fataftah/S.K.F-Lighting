# 0031. Home category cards with their products: rationale

The decision record behind [index.md](index.md). `/develop` reads the index only.

## Context

> ⚠️ Premise note: this adds a second product surface to Home right under the hero coverflow of spec 0030. Two interactive sections on one phone screen means more motion, more client code, and a longer page. The owner asked for it knowingly ("Home should look amazing", products reachable from the categories). The design keeps the second surface calm: no auto movement, small cards, one grid of eight, and no change until a press. If Home ever feels busy, the hero stays and this section can go flat (AC-5 is the only part that moves).

Home's categories section is a row of circles: a moving carousel on phones (auto advance, pause button, loop) and a still scrolling row from `md`. A circle links to the category page. Nothing on Home shows a category's products; the only products on Home are the hero picks. The owner wants the categories to look like real cards with depth, and wants pressing a category to show its products right there, so a shopper finds a product without leaving Home.

Forces: the shop is phone first, Arabic, right to left, with a strict design rule set (tokens only, no shadows, blurs, or gradients, two breakpoints). The dashboard already controls which mains show on Home, their photo, their line, and their order; the category page already has the one product order every list uses. Public reads on Workers run under a per IP rate limit and a time limit, and the browser never reaches the database. The circle carousel carries a lot of code and tests for a feature that is going away.

Not deciding leaves Home as a hero plus a row of links, and the owner's "amazing" ask unmet.

## Options considered

### Option 1: Fix in place: keep the circles, add a grid under the centred one

Keep the carousel and shelf and add a product grid that follows the centred circle (phone) or a pressed circle (desktop).

**Pros**:
- Least code removed; the carousel's tests stay.
- The grid alone delivers the "products under the category" ask.

**Cons**:
- The auto advancing carousel would swap the grid by itself every 3.5 seconds, which is unreadable; it would have to stop, which guts the carousel anyway.
- Circles are the thing the owner asked to replace; the 3D card look does not fit a circle.

### Option 2: Tab cards with a fetched grid (chosen)

Replace the circles with 3D photo cards that are tabs. The first category's products come with the page; a press fetches the rest from a small public route, prefetched on hover or touch and cached per visit.

**Pros**:
- Matches the ask: cards, depth, products under the pressed one, an instant first paint.
- The route copies the catalog count route (limiter, time limit, error shape, the proxy skip under `/api/catalog/`), so it is one more handler on a known pattern.
- Assistive tech gets the tabs pattern, which is exactly what this is.

**Cons**:
- A press that is not prefetched shows a skeleton for one round trip.
- A pressed grid stays as fetched for the rest of the visit, so a product change can lag there; every uncached press reaches the database.
- More client state (cache, in flight, failed) to test.

### Option 3: Preload every category's products with the page

Render eight cards for every category in the HTML, hidden, and switch client side.

**Pros**:
- No spinner, no route, no cache rules.

**Cons**:
- Ten categories means eighty hidden product cards in every Home response: slower on phones, more HTML, more images to decide about.
- Wasted database work on every visit for grids nobody presses.

### Option 4: A real page load per press

Pressing navigates to `/?category=<slug>` and the server renders that grid.

**Pros**:
- Shareable address; Back undoes a press; nothing to cache on the client.

**Cons**:
- A full navigation and scroll jump per press feels like a form, not a shelf.
- The hero coverflow resets on every press.

## Rationale

The owner's two asks (cards with depth, products under the pressed category) point at Option 2. Option 1 keeps a carousel whose own movement fights a grid that follows it. Option 3 trades a round trip for a heavier page on every visit, the wrong trade on a phone first shop. Option 4 is simple but makes Home feel like a results page.

Within Option 2 the smaller calls: the first category's products ride with the page because the server already reads Home in parallel parts under time limits, so one more part costs little and the section paints complete. The route reuses the catalog count limiter rather than a new binding: one budget for public catalog reads is easier to reason about and nothing new to deploy. The cache is the page and the browser, not the edge: a Worker's own response is never stored by Cloudflare's cache, so claiming `s-maxage` would be a no op (the cross check caught this). The three cache questions: what is cached (a slug's eight products, in component state and in the browser for a minute), what invalidates it (a remount of the section, or a minute for the browser copy), and what stale means (a product edited after the press keeps its old card in that grid until the visitor comes back; the server rendered first grid is always fresh). Tabs semantics because the cards are tabs in behaviour; buttons with `aria-pressed` would make every card a Tab stop. The hover tilt runs only where a pointer exists and never under reduced motion, so the phone build stays light. The address does not change on a press because the section is a browsing aid, not a destination; the category page is the destination and is one tap away.

Cross check (another model) findings applied: no edge cache claim; the route under `/api/catalog/` so the proxy skips the session refresh; an explicit request rule; the sub names fallback for the line; the turn limited to the selected card's visual row with per card perspective; padding and a transparent border against clipping and layout shift; a 150ms wait before a key driven fetch; no prefetch on touch; the shared allowance stated; `no-store` on every error; the first read chained after the tree; the cache in component state with a failed seed; `motion-reduce:transition-none`; mouse and pen only tilt in a frame; the scale and tint as tokens; the list SQL named for the order; the on Home check in the handler; the dead token removed; the panel focusable; the test mechanics for no JavaScript and 429.

Engineer's picks during design, recorded as given: new spec amending 0011 and 0029 rather than editing them; design from the existing design system; eight products plus the link; the first category selected on load; turned cards facing the pressed one with hover tilt; photo card with a name band; a snap row on phones; no address change; first category with the page and the rest fetched on press; the category page's order; the section title kept with the category name over the grid; an inline notice with retry on failure; the shared limiter with a minute of edge cache; tabs semantics; 140, 180, and 200 pixel cards; reads only, no schema change.

## Migration plan

**Strategy**: no migration needed. One deployment replaces the circles with the cards; reverting the commit restores the circles. No data changes.
