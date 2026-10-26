# 0009. Product page: rationale

## Context

Slice 1 (spec 0004) shipped a product page at `/p/<slug>` that proves an order can travel the whole system: one placeholder image, the one variant `pickVariantToAdd` chooses, a quantity stepper, add to cart, WhatsApp, the description, and the spec rows. Since then spec 0006 lets the owner store up to 8 photos, one video, sizes with a price each, colours from a shared list, and per pair availability, and spec 0008 made "category shown" part of the one sellable rule. None of that reaches the customer yet: a product with four sizes still sells only its default, and its photos never show on its own page.

The page is where most buying decisions happen, almost always on a phone, in Arabic, right to left. It has to show the photos well on a slow mobile connection, make choosing a size and colour obvious, show the price of exactly what will be added, and make it impossible to add a pair the shop cannot supply, because a wrong order costs the owner a phone call and the customer's trust. WhatsApp is as important a way to buy as the cart, so the WhatsApp message must carry the same choice.

The forces: stock and prices change in the dashboard and must show on the next load (scope: "see the change on the site right away"); the shop runs on Cloudflare Workers with Supabase, where video egress and image transformations count against the Pro plan; every string, number, and direction rule from specs 0003 and 0005 applies; and the design for the phone layout exists, while the desktop layout does not (O-1).

Not deciding leaves the scope's feature 10 "Done when" unmet: choosing a size cannot update a price that cannot be chosen, and out of stock options cannot be shown.

## Options considered

### Option 1: Fix in place, server rendered with one client selection island

Keep `/p/[slug]/page.tsx` a server component. Extend the read to return all live variants (with colours and sellable flags) and media, choose the first selection on the server (honouring `?v`), and hand a plain view to a client `ProductSelectionProvider`. Small client leaves (pickers, price, add, WhatsApp, share, gallery) read it; server sections (breadcrumb, description, specs, help card shell) stay server rendered. All choosing rules are pure functions.

**Pros**:
- Builds on the shipped page and the existing `addToCart`, `pickVariantToAdd`, `isSellable`, `ErrorState`, and loader; no new action, no migration.
- First paint already has the right chips and price, including for a shared `?v` link; search engines get the full content.
- Choosing is instant, with no server trip, and the rules are testable without a browser.

**Cons**:
- Every view is a server render and a database read; there is no cache to absorb a spike.
- The client bundle grows by the gallery and the pickers, which must be kept small for phones.

### Option 2: Static shell, stock and prices fetched in the browser

Render the product's stable parts (name, photos, description) as a cached or static page, and fetch variants, prices, and availability from a route handler in the browser.

**Pros**:
- The shell could be cached at the edge and served very fast.
- Stock reads are separated and could be cached briefly on their own.

**Cons**:
- Needs cache invalidation on every product save, archive, hide, and import (spec 0006, 0007, 0008), which the project does not have today.
- The price and chips appear after a loading flash, and search engines may miss the offer data.
- Adds a public data endpoint and a second loading state for a traffic level that has not been measured as a problem.

### Option 3: One server route per choice

Make each choice a navigation (`/p/<slug>?v=<id>` rendered on the server), with chips as links, so no client state is needed.

**Pros**:
- Almost no client JavaScript for the pickers; works without JavaScript.
- The address always matches the choice by construction.

**Cons**:
- Every chip tap is a full server round trip and database read, slow on a phone and wasteful.
- Fills the history with one entry per tap unless replaced, and the gallery and stepper state reset on each navigation.
- The "follow the size" colour move becomes a redirect, which is awkward to make accessible.

## Rationale

Option 1 is chosen because it meets the freshness force with no new machinery: a per request render is how the home grid and category pages already work, so a dashboard change shows on the next load with nothing to invalidate. It also reuses every shipped rule (one sellable rule, `pickVariantToAdd`, `addToCart`), so the risk sits in pure functions and a few client parts that Vitest and one Playwright flow can cover. Option 2 solves a speed problem nobody has measured and pays for it with an invalidation system and a loading flash on the very thing customers came to see. Option 3 is clean on paper but turns every chip tap into a network trip on a phone connection.

Choosing on the server first (with `?v`) and only then in the browser gives a correct first paint for shared links, which matters because WhatsApp and the share button now carry `?v`. Keeping `?v` matched only against the product's own variants means a stale or forged id simply falls back to the default.

### Decisions made in the design conversation

| Dimension | Chosen | Runner up | Why |
|---|---|---|---|
| Design source | existing `pages/product.md` and its board | a design tool | The design already covers the phone page, its states, copy, and accessibility |
| Pair rule | follow the size: unsellable colours disabled for the chosen size, colour moves when needed | any pair, then explain | A customer can never land on a pair that cannot be bought |
| First selection | `pickVariantToAdd` (default if sellable) | cheapest sellable | The owner controls it in the editor, and it is already tested |
| Extras | full screen photos and share in; related products out | none | Chandeliers need a closer look; sharing fits how customers ask family before buying |
| Gallery | CSS scroll snap strip with arrows, counter, thumbnails | swap one image | Native swipe and correct RTL with no library |
| Full screen | Base UI dialog with the browser's pinch zoom | a zoom library | No dependency, focus handling from the existing dialog |
| Colour photos | not now | `colour_id` on `product_media` | Avoids a migration, an editor change, and an import question for this feature |
| Address | `?v=<variant id>` with `replaceState` | page state only | Shared and WhatsApp links open the same choice |
| Search engines | design's set, no share image | add `og:image` now | Keeps feature 28's scope as spec 0008 left it |
| Video loading | nothing downloads until play | `preload="metadata"` | Video egress counts against the Supabase Pro allowance |
| Wide screens | centred phone column | two columns from md | The desktop layout is not designed (O-1) |
| Share content | name plus the link with `?v` | the bare link | The recipient sees the same size and colour |
| Data read | as shown, no migration | | Confirmed by the engineer |
| Stale add | message, then `router.refresh()` | message only | Chips and price update to the truth at once |
| Share position | icon at the end of the `h1` row | a third big button | Keeps the two big buttons uncluttered |

### Calls made while writing the spec

- **Video element**: the video item is a native `<video controls preload="none" poster>` rendered from the start, rather than created on tap. With `preload="none"` nothing downloads until play, which meets the chosen "only on tap" intent, and the visitor plays it with one tap; creating the element on tap and then calling `play()` can lose the tap's permission on iPhone Safari and need a second tap. Runner up: create on tap.
- **Selection state**: one client context (`ProductSelectionProvider`) with small leaves, rather than one big client component for the whole page. Server sections stay server rendered and the client bundle stays small. Runner up: one client component for the whole purchase card plus prop drilling to the help card.
- **Selection as a variant id**: the state is the selected variant id, not a size and a colour, because the live variants form the full grid and the cart needs the id. Runner up: a size and colour pair resolved on add.
- **Colour order**: the lowest variant `sort` per colour, which is the editor's colour order (`planVariants` stores the colour index there). Runner up: `colours.sort` from the shared list.
- **Gallery movement**: `scrollIntoView` on the target item instead of computing `scrollLeft`, because RTL scroll offsets differ across browsers. Instant when reduced motion is preferred.
- **Breadcrumb**: three levels (home, main, sub) to match the category pages and the `BreadcrumbList`. Runner up: the product's own category only, as slice 1 showed.
- **JSON-LD prices**: `toShekelsInput`, which already turns agorot into `1250` or `19.90` without `Intl` or `.toFixed(`. Runner up: a new money helper.
- **Price announcement**: the price line is `aria-live="polite"`, so a screen reader hears the new price after a size change.
- **No route level loading skeleton** (from the cross check): a `loading.tsx` boundary flushes a 200 before `notFound()` can run, so an unlisted product would not get a real 404. The real 404 wins (search engines, the spec 0008 pattern); the skeleton moves to Follow-up. Runner up: keep the skeleton and accept a soft 404 with `noindex`.
- **Selection state shape** (from the cross check): one reducer in the provider owns the selection, quantity, added state, and problem message, so a refresh or a choice change has one place that decides what stays.
- **No caching**: none added (measure first); the page is dynamic anyway because it reads `searchParams`.
