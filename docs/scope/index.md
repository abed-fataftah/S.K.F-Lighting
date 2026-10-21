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

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | in-progress |
| 2 | Coding standards & tooling | Foundation | done |
| 3 | Data model | Foundation | in-progress |
| 4 | Design system & UI foundation | Foundation | in-progress |
| 5 | Arabic language | Foundation | in-progress |
| 6 | First order end to end | Slice 1 | in-progress |
| 7 | Product management | Slice 2 | planned |
| 8 | Spreadsheet import & bulk photos | Slice 2 | planned |
| 9 | Categories & browsing | Slice 2 | planned |
| 10 | Product page | Slice 2 | planned |
| 11 | Search & filters | Slice 2 | planned |
| 12 | Cart | Slice 3 | planned |
| 13 | Checkout & delivery | Slice 3 | planned |
| 14 | Order confirmation & WhatsApp | Slice 3 | planned |
| 15 | Order management | Slice 4 | planned |
| 16 | Order page & guest lookup | Slice 4 | planned |
| 17 | Cancel before delivery | Slice 4 | planned |
| 18 | Customer accounts | Slice 5 | planned |
| 19 | My Orders | Slice 5 | planned |
| 20 | Customers & roles | Slice 5 | planned |
| 21 | Electrician quick order & drafts | Slice 6 | planned |
| 22 | Add to draft from the catalog | Slice 6 | planned |
| 23 | Electrician price adjustments | Slice 6 | planned |
| 24 | Payments & balances | Slice 7 | planned |
| 25 | Homepage, banners & featured products | Slice 8 | planned |
| 26 | Shop settings & policy pages | Slice 8 | planned |
| 27 | Sales reports | Slice 8 | planned |
| 28 | Search engine visibility | Slice 8 | planned |
| 29 | Visitor stats & error alerts | Slice 8 | planned |
| 30 | Go live | Launch | planned |
| 31 | Loyalty coins | Slice 9 | planned |
| 32 | Loyalty rewards | Slice 9 | planned |
| 33 | Return requests | Slice 10 | planned |
| 34 | Returns & exchanges | Slice 10 | planned |

## Areas

- [Foundations](foundations.md): features 1 to 6 (stack, tooling, data model, design system, languages, first order). 1 of 6 done.
- [Catalog](catalog.md): features 7 to 11 and 25 (products, import, categories, product page, search, homepage). 0 of 6 done.
- [Ordering](ordering.md): features 12 to 17 (cart, checkout, confirmation, order management, lookup, cancel). 0 of 6 done.
- [Accounts & electricians](accounts.md): features 18 to 23 (accounts, My Orders, roles, quick order, drafts, price adjustments). 0 of 6 done.
- [Payments & reports](payments.md): features 24 and 27 (payments and balances, sales reports). 0 of 2 done.
- [Site & launch](site.md): features 26, 28 to 30 (settings and policies, search visibility, stats, go live). 0 of 4 done.
- [Loyalty](loyalty.md): features 31 and 32, after launch. 0 of 2 done.
- [Returns](returns.md): features 33 and 34, after launch. 0 of 2 done.

## Deferred

Out of scope for now, kept so the plan stays honest.
- **Online card payment at checkout**: pay on the website instead of cash or cheque · needs a decision · GA
- **Automatic WhatsApp sending**: the site messages you from the shop number by itself, through a business messaging service · needs a decision
- **PDF of a draft or order**: a clean quote electricians can share · needs a decision
- **Items outside the catalog**: electricians type a free item that you price later · needs a decision
- **JSON export of an order** · needs a decision

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
