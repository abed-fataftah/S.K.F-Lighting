# Scope: S.K.F Lighting website

An Arabic first online shop for S.K.F Lighting (chandeliers, lamps, and electrical products) where customers and electricians browse, build orders, and send them through WhatsApp, and the owner runs orders, payments, and customers from one dashboard. Prices in shekels (₪), payment by cash or cheque at launch.

**Build approach:** Tracer Bullet (prove one real order travels the whole system first, then thicken each part end to end).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`). The project default level of rigor. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (for example `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## Decisions already made

- **Launch set:** everything through Slice 8 plus Go live. Loyalty (Slice 9) and returns (Slice 10) follow right after launch. Payments are recorded from day one, so no coins are lost.
- **WhatsApp:** the site opens the customer's WhatsApp with a ready message (new order, cancellation, return request). Every one of these is also saved and flagged in the dashboard, so nothing depends on the customer pressing send.
- **Guest order lookup:** order number plus phone number, with limits on repeated attempts.
- **Languages:** Arabic only (decided 2026-10-17). The whole site, menus, pages, and product content are in Arabic, right to left. There is no English site and no language switch.
- **Catalog loading:** you fill a spreadsheet template, upload it once, then add photos in bulk, matched by product code in the file name.
- **Electrician orders for a customer** (written like "ali / mo"): the order belongs to the electrician's account, with the customer's name, phone, and delivery address on it.
- **Timeline:** no fixed date. Launch when the launch set is done and tested.
- **Responsive (decided 2026-11-18):** the storefront's phone, tablet, and desktop layouts (feature 36) get verified, then a sweep adds small phones, landscape, and large monitors (39); the dashboard gets real phone and tablet layouts (38).
- **Home hero (decided 2026-11-18):** a 3D coverflow of the featured products is the hero at every width, with the headline above it; the banner carousel shows below it when banners are on (37).
- **Light hero and orange brand (decided 2026-11-19):** the Home hero sits on white instead of the black band, and the brand colour is orange #F7931E everywhere, logo included, named `brand` in code (43).
- **Home categories (decided 2026-11-18):** the category circles become 3D photo cards that act as tabs, with the pressed category's first eight products in a grid under them (42).
- **App stores (decided 2026-11-18):** installable web app first (40), then Google Play as a wrapped web app (41). The App Store waits: Apple often rejects a plain website wrapper, and an iOS build needs a Mac and a yearly developer account.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | done |
| 4 | Design system & UI foundation | Foundation | done |
| 5 | Arabic language | Foundation | done |
| 6 | First order end to end | Slice 1 | done |
| 7 | Product management | Slice 2 | done |
| 8 | Spreadsheet import & bulk photos | Slice 2 | done |
| 9 | Categories & browsing | Slice 2 | in-progress |
| 10 | Product page | Slice 2 | done |
| 11 | Search & filters | Slice 2 | in-progress |
| 12 | Cart | Slice 3 | done |
| 13 | Checkout & delivery | Slice 3 | in-progress |
| 14 | Order confirmation & WhatsApp | Slice 3 | done |
| 15 | Order management | Slice 4 | in-progress |
| 16 | Order page & guest lookup | Slice 4 | in-progress |
| 17 | Cancel before delivery | Slice 4 | in-progress |
| 18 | Customer accounts | Slice 5 | in-progress |
| 19 | My Orders | Slice 5 | done |
| 20 | Customers & roles | Slice 5 | in-progress |
| 21 | Electrician quick order & drafts | Slice 6 | in-progress |
| 22 | Add to draft from the catalog | Slice 6 | in-progress |
| 23 | Electrician price adjustments | Slice 6 | in-progress |
| 24 | Payments & balances | Slice 7 | in-progress |
| 25 | Homepage, banners & featured products | Slice 8 | done |
| 26 | Shop settings & policy pages | Slice 8 | in-progress |
| 27 | Sales reports | Slice 8 | in-progress |
| 28 | Search engine visibility | Slice 8 | in-progress |
| 29 | Visitor stats & error alerts | Slice 8 | in-progress |
| 30 | Go live | Launch | in-progress |
| 31 | Loyalty coins | Slice 9 | planned |
| 32 | Loyalty rewards | Slice 9 | planned |
| 33 | Return requests | Slice 10 | planned |
| 34 | Returns & exchanges | Slice 10 | planned |
| 35 | Dashboard home | Slice 4 | planned |
| 36 | Storefront desktop & tablet layout | Slice 8 | done |
| 37 | Hero product coverflow | Slice 8 | in-progress |
| 38 | Dashboard on phone and tablet | Slice 8 | planned |
| 39 | Small phone, landscape & large monitor sweep | Slice 8 | in-progress |
| 40 | Installable web app | Slice 11 | planned |
| 41 | Google Play listing | Slice 11 | planned |
| 42 | Home category cards & their products | Slice 8 | in-progress |
| 43 | Light hero & orange brand | Slice 8 | done |
| 44 | Whole product photos in every frame | Slice 8 | in-progress |

## Areas

- [Foundations](foundations.md): features 1 to 6 (stack, tooling, data model, design system, languages, first order). 6 of 6 done.
- [Catalog](catalog.md): features 7 to 11, 25, 37, 42, and 44 (products, import, categories, product page, search, homepage, hero coverflow, category cards, whole product photos). 4 of 9 done.
- [Ordering](ordering.md): features 12 to 17 and 35 (cart, checkout, confirmation, order management, lookup, cancel, dashboard home). 2 of 7 done.
- [Accounts & electricians](accounts.md): features 18 to 23 (accounts, My Orders, roles, quick order, drafts, price adjustments). 1 of 6 done.
- [Payments & reports](payments.md): features 24 and 27 (payments and balances, sales reports). 0 of 2 done.
- [Site & launch](site.md): features 26, 28 to 30, 36, 38, 39, and 43 (settings and policies, search visibility, stats, desktop and tablet layout, dashboard on phone and tablet, the width sweep, light hero and orange brand, go live). 0 of 8 done.
- [Loyalty](loyalty.md): features 31 and 32, after launch. 0 of 2 done.
- [Returns](returns.md): features 33 and 34, after launch. 0 of 2 done.
- [Mobile app](app.md): features 40 and 41, after launch (installable web app, Google Play). 0 of 2 done.

## Deferred

Out of scope for now, kept so the plan stays honest.
- **App Store listing**: the shop on the iPhone App Store through a native shell; needs a Mac, an Apple developer account (99 USD a year), and enough app only features to pass Apple's review · needs a decision · after feature 41
- **Online card payment at checkout**: pay on the website instead of cash or cheque · needs a decision · GA
- **Automatic WhatsApp sending**: the site messages you from the shop number by itself, through a business messaging service · needs a decision
- **Opening hours and map position for search**: shop settings hold hours, location, and social page links, so the home Store block can carry them · from spec 0026 · needs a decision
- **PDF of a draft or order**: a clean quote electricians can share · needs a decision
- **Items outside the catalog**: electricians type a free item that you price later · needs a decision
- **Owner profile on Home**: your display name and a circle photo, edited in settings and shown on Home · from spec 0025, waits for your approval (O-28)
- **Copy an order into a new draft**: start a new draft from one of an electrician's past orders, for repeat jobs · from spec 0020
- **JSON export of an order** · needs a decision
- **Cheques list**: a dashboard page of live cheques sorted by due date, optionally with a "cleared" mark; the data is already stored · from spec 0023
- **Colour tagged product photos**: choosing a colour on the product page jumps to its photos (a `colour_id` on `product_media`, the editor, and the import) · needs a decision · from spec 0009
- **Cloudflare Turnstile at checkout**: a stronger bot check, only if the honeypot and rate limit logs show real spam · needs a decision · from spec 0012
- **Product page loading skeleton**: a skeleton that keeps the real 404 (the desktop layout half moved into feature 36) · needs a decision · from spec 0009
- **Wide banner image**: a wider banner variant if the 16:9 carousel at two thirds width looks short on large monitors · from spec 0029
- **Designer pass on desktop layouts**: review the built tablet and desktop pages from real screenshots, since they are specified in words, not drawn · from spec 0029
- **Edit customer details on an order**: fix a typo in the name, phone, city, or address after placing · needs a decision · from spec 0014
- **Printable order slip**: a print friendly view for packing or the driver · needs a decision · from spec 0014
- **Private owner notes on an order**: short notes saved as `note` events and shown in the history · needs a decision · from spec 0014
- **Sound or browser notification for new orders**: beyond the dot, the sidebar count, and the 60 second refresh · needs a decision · from spec 0014
- **Correct a customer's email from the dashboard**: change the login email through the Supabase Auth admin API, with a decision on confirming the new address · needs a decision · from spec 0019
- **Role filter on the customers list**: All, Customers, Electricians chips, if the number of electricians grows · from spec 0019
- **WhatsApp visits in the stats**: a source marker on share links so WhatsApp traffic stops showing as direct · needs a decision · from spec 0027

## Open questions to settle in the specs

These do not block the order above. Each is answered when `/architect` designs the feature named in brackets.
- Exact form validation rules for name, phone, area, city, and address (13).
- Order statuses and who can move an order between them (15).
- Cancellation rules, for example whether cancelling is allowed once an order is out for delivery (17).
- Sales report math: cancelled and returned orders, partly paid orders, and delivery fees (27).
- Coin earning rates, redemption rules, and how special electrician prices affect coins (31, 32).
- Return, exchange, and refund rules, and the time limit for return requests (33, 34).

## Legend

**The decision box.** Every feature carries exactly one, the step whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally, `Decide the stack (spec)` on Stack & architecture), so skills find it by that `(spec)` ending, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + **2 to 5 milestones**; the tier's closing boxes (`Verify it` Alpha+, `Test it` Beta+, `Review it` + `Document it` GA); any surfaced follow up enrolled |
| `in-progress` (building) | `/develop` | milestone boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` + milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is** (any skill sets it when you say so); `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped; the tier's last stage (`Prototype` → after `/develop`; `Alpha` → after `/check verify`; `Beta`/`GA` → after `/test`) is the suggested point to call it done |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop` (or `/audit` for standards & tooling). The tag drops once the spec is captured.
- **Atomic build tasks live in the spec's `## Build plan`, not here**: the scope carries only the milestone rollup.
- **Status** `planned` → `in-progress` → `done`, plus `existing` (built before this workflow) and `dropped` (taken out of scope, kept for history).
- **Approach tag** beside a heading (for example `· Facade`) overrides the project default for that feature; no tag means it inherits it.
- **Workflow tier tag** beside a heading (for example `· GA`) sets that one feature's rigor above or below the project default; no tag inherits the default.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`. A feature built on an unratified decision (an `Assumed` spec) stays flagged, but that never blocks `done`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.
