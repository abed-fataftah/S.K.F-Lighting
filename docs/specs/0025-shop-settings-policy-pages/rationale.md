# 0025. Shop settings and policy pages: rationale

Build spec: [index.md](index.md).

## Context

The shop's WhatsApp number is `NEXT_PUBLIC_WHATSAPP_NUMBER`, baked into the build. Changing it means a developer and a deploy, and it is the one link every order and every help request goes through. Delivery fees and the contact phone and address already live in the database (spec 0002), but nothing lets the owner edit them. The three policy pages are linked from the footer and menu (spec 0003), but the pages and their table don't exist yet.

Forces that shaped the design:
- Every page renders on each request, with Cache Components off (spec 0001). A database change is visible on the next load without any cache work.
- The client error page cannot read the database, yet must still offer WhatsApp help.
- Checkout already refuses a send whose total no longer matches (spec 0004), and orders store their own zone name and fee.
- Policy text is long, owner written Arabic. It is rendered on public, indexable pages inside a Cloudflare Worker.
- The owner works mostly from a phone. The design boards were drawn for desktop only and include an owner profile card the scope never approved.

## Options considered

### Markdown rendering

**react-markdown (chosen).** It renders Markdown straight to React elements, with no HTML string.
- Pros: safe by default (raw HTML ignored, unsafe links dropped); works in a Server Component; an element allow list is built in.
- Cons: a new dependency; the editor preview ships it to the admin bundle.

**markdown-it with HTML off.** It produces an HTML string, injected with `dangerouslySetInnerHTML`.
- Pros: fast and mature.
- Cons: brings in an injection pattern the codebase avoids today; you depend on one setting staying off for safety.

**Handwritten subset.** A pure function for headings, lists, bold, and links.
- Pros: no dependency; fully unit tested.
- Cons: you maintain a parser, and edge cases (nested lists, mixed RTL punctuation) give surprising output.

### Settings layout

**Hub plus a policy editor page each (chosen).** Short forms on the hub, long text on its own page.
- Pros: a short, fast hub on a phone; room for a tall editor with preview.
- Cons: one more route per policy; differs from the board.

**One long page (the board).**
- Pros: matches the drawn board; one route.
- Cons: three long texts make the page very long on a phone, and one save for everything risks losing edits.

**Tabs.**
- Pros: compact.
- Cons: hides content, and tab state needs URL handling to be linkable.

### Where the storefront gets the WhatsApp number

**Database with the env value as fallback (chosen).**
- Pros: the link never disappears, including on the client error page and during a database incident.
- Cons: two values can drift.

**Database only.**
- Pros: one source of truth.
- Cons: WhatsApp help vanishes exactly when something is broken, and the error page has no number at all.

## Rationale

The per request rendering from spec 0001 removes the hardest part of "updates the whole site": there is no cache to invalidate, so the design adds no caching layer and only moves where the number is read. The number joins the footer's existing single row read, so the extra cost is one column. Keeping the env value as the fallback follows the AC-15 pattern from spec 0003 (a failed settings read hides nothing important). It is also the only way the client error page can still offer help.

For policies, the deciding force is that owner text lands on public pages. `react-markdown` gives an element allow list and safe link handling without ever building an HTML string. A future edit to the component can't quietly open an injection path the way flipping one markdown-it option could. A handwritten parser was the runner up, and would be reasonable if the dependency became a problem.

Fee changes during checkout needed no new mechanism: spec 0004's total check and the order's stored fee already give the right behavior, so the spec only pins it as an acceptance criterion. The stale check is spent only where losing work hurts (long policy text). It uses an integer `version` rather than comparing `updated_at`: Postgres keeps microseconds while JavaScript dates keep milliseconds, so a timestamp round trip is fragile, and the codebase already has this pattern in `home_version`. Short contact and zone forms stay last write wins to keep the build small.

The owner profile card and the email field were left out to keep the feature to its scope row. Both are recorded as follow ups.
