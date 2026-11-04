# 0021. Add to draft from the catalog

**Date**: 2026-11-04
**Status**: In Progress

## Summary

Electricians get an "add to draft" button on the product page and on every product card. It opens a bottom sheet where they pick the size and colour, set a quantity, and choose one of their drafts, or name a new one. Confirming adds the item to that draft, or adds to the quantity when the same option is already there. The sheet then shows where the item landed, with a link to open the draft. Nothing new is stored: this reuses spec 0020's `drafts` and `draft_lines` tables and their limits (30 drafts, 30 lines, 999 per line).

## Requirements

**User stories**:

- As an electrician browsing the catalog, I want to drop a product straight into one of my drafts, so I don't have to retype it in quick order later.
- As an electrician, I want to choose the exact size, colour, and quantity as I add it, so the draft holds what I mean.
- As an electrician with no draft for this job yet, I want to start a named draft from the same sheet, so I don't leave the product.
- As an electrician, I want a clear refusal when a draft is full or a quantity would pass 999, so nothing is lost quietly.

**Acceptance criteria** (these build on spec 0020 for drafts, lines, `resolveOption`, the name rules, and the limits; spec 0008 AC-12 for the product card; spec 0009 for the product page; spec 0019 for roles; and `docs/design/design.md` for tokens and the "no toasts" rule):

- **AC-1**: Electricians only. The home page, both category pages (`/c/[category]` and `/c/[category]/[sub]`), the search page, and the product page each call `getAccountProfile()` and pass `canAddToDraft = canUseDrafts(account?.profile ?? null)` (spec 0020 `access.ts`) down to their product cards and the product page buttons. Signed out visitors, customers, the owner, and an account with `removalPending` see no "add to draft" control anywhere, and the HTML they get carries nothing about drafts. `readDraftPicker` and `addToDraft` check the role themselves first and return `forbidden` (spec 0020 AC-1); on `forbidden` the sheet closes and the page calls `router.refresh()`, so a demoted or signed out account loses the buttons (no redirect to sign in).
- **AC-2**: Product page trigger. Between the yellow "أضف للسلة" and the green WhatsApp button, an outline large button (52 high, full width, like its neighbours) "أضف إلى مسودة" with a `ClipboardPlus` icon. It opens the sheet (AC-4) with the page's chosen option (`selectedId` from the selection island) and the stepper's quantity. When the product is out of stock (`inStock` false), the button is disabled, like add to cart.
- **AC-3**: Card trigger. On the product card (spec 0008 AC-12: home, category, search), a 44 by 44 round white icon button with the `ClipboardPlus` icon at the photo's top end corner (`top-2 end-2`; the out of stock label keeps the start corner). Its `aria-label` is "أضف إلى مسودة: {name}". It sits above the card's stretched name link in stacking order, not inside the link, so tapping it never opens the product and it gets its own focus stop after the name link. The bottom row (add to cart and WhatsApp) does not change. Out of stock (`addVariantId` null): the button is disabled. It opens the sheet with no page choice and quantity 1; AC-5's `resolveOption` still chooses a single option at once.
- **AC-4**: The sheet. A Base UI `Sheet` from the bottom (`src/components/ui/sheet.tsx`), within the `--page-max` column at wider screens, its body scrolling inside when taller than the screen. Title "أضف إلى مسودة"; under it the product's name and `الكود: {code}` (`dir="ltr"`). Opening calls `readDraftPicker({ productId })`. While it runs, a skeleton of the option, quantity, and draft parts. A failed call (`save_failed`, `invalid`, or a network failure) shows "تعذّر تحميل المسودات." with an outline "إعادة المحاولة" button that calls it again. A product that no longer shows in the catalog (`product: null`) shows "هذا المنتج لم يعد متوفرًا." and only a close button. Escape, the close button, and tapping outside close it; focus returns to the trigger.
- **AC-5**: Option and price. The selects "الحجم" and "اللون" follow spec 0020 AC-6 exactly, through the same pure `resolveOption`: shown only when the options carry that dimension, colours limited to the chosen size, "بدون حجم" or "بدون لون" for missing values, a single option chosen at once, and an option that is not sellable listed as "{value} (غير متوفر)" and disabled. From the product page the selects start at the page's option when it is among the returned options and sellable; otherwise nothing is chosen. Under the selects: "سعر الوحدة: {price}" once an option is chosen; before that "من {lowest}" when sellable prices differ, else the single price. Every price goes through `formatPrice`.
- **AC-6**: Quantity. A field "الكمية" (`inputMode="numeric"`), starting at 1 from a card, or at the stepper's value from the product page. It accepts Arabic and Latin digits and must be a whole number from 1 to 999 (`commitPickerQuantity`, built on spec 0020's `DRAFT_MAX_QUANTITY`). Checked on confirm: anything else shows "أدخل كمية من 1 إلى 999." under the field.
- **AC-7**: Choosing the draft. A `fieldset` with the legend "المسودة" holds one radio row per draft the user owns, ordered by `updated_at` newest first, then `id` descending (as the drafts list, spec 0020 AC-3). Each row shows the name and the muted line count with spec 0020 AC-3's plural pattern ("سطر واحد", "سطران", "{shown} أسطر", …). The newest draft is chosen when the sheet opens. A draft at 30 lines stays choosable (an option already on it can still merge) and its count reads "30 / 30". The last row "+ مسودة جديدة" reveals the field "اسم المسودة" under it. With no drafts at all, only that row exists, already chosen, with its field shown. When the user already has 30 drafts, the row is disabled with the note "وصلت إلى 30 مسودة".
- **AC-8**: Confirm. The yellow large button "أضف إلى المسودة" checks the option (none chosen: "اختر الحجم واللون." under the selects), the quantity (AC-6), and, for a new draft, the name with spec 0020 AC-4's rules and messages, all inline with `aria-invalid` and `aria-describedby`, focus moving to the first problem. Then it calls `addToDraft({ productId, variantId, quantity, target })`. The server, in one transaction, in this order: the role (`forbidden`); the input schema (`invalid`: a field not a uuid, a quantity outside 1 to 999, or a name failing `draftNameSchema`, the last carrying `problem: DraftNameProblem` from spec 0020's `draftNameProblem`); the option exists, belongs to the product, and is not archived (`invalid`, no `problem`); the product is listed (`listedProduct` from `src/features/catalog/server/storefront-sql.ts`: status active and category shown) and the product and option pass `isSellable` with the live product status, availability, the real `categoryShown`, and the option's availability (`not_sellable`; a `productId` that matches no listed product is `not_sellable` too); the target draft (below, or AC-9); then:
  - the draft already has a line with this option: its quantity becomes `existing + quantity` (a null quantity counts as 0, so it can never be over 999). Over 999 is refused with `quantity_over`, carrying that line's `position` and current quantity, and nothing changes; the sheet keeps the typed quantity so the electrician lowers it or picks another draft.
  - otherwise a new line is appended: `product_id`, `variant_id`, the quantity, `sort` one past the highest. At 30 lines this is refused with `too_many_lines`.
  - a line holding only this product (no option yet) is left alone; the add appends a new line.
  The draft's `updated_at` becomes now. An existing draft target is locked `for update` with the owner check; missing or someone else's is `not_found`.
- **AC-9**: A new draft from the sheet. With the "+ مسودة جديدة" row chosen, `target` is `{ newDraftName }`. In the same transaction as the add, the server tidies and checks the name (spec 0020 AC-4: 2 to 40 characters, unique per user case insensitively for Latin, the unique index as final judge), locks the profile and checks the 30 draft limit, inserts the draft, and inserts the one line with `sort` 0. The new draft has only that line, no empty line. Errors: `invalid` with the name problem, `name_taken`, `too_many_drafts`, each shown under the name field with spec 0020 AC-4's wording. A refusal creates nothing.
- **AC-10**: Success. The sheet's body is replaced, in place (no toast), by a `role="status"` block: a check icon and "أُضيف إلى «{draft}»", then "السطر {position} · الكمية {quantity}" for a new line, or "السطر {position} · الكمية الآن {quantity}" for a merge (numbers through `formatNumber`). Below it, a yellow "فتح المسودة" link (`routes.quickOrderDraft(draftId)`) and an outline "متابعة التسوق" that closes the sheet. Focus moves to the status heading. There is no "add another" inside the sheet. "متابعة التسوق" leaves the product page's chosen option and stepper as they were. Opening the sheet again starts fresh: a new `readDraftPicker` call, and the option, quantity, and draft reset through `pickerStart` from the page's current state (AC-5, AC-6, AC-7).
- **AC-11**: Refusals. Each shows in the sheet as an inline alert (`role="alert"`), and the choices stay as they were: `too_many_lines` "المسودة «{name}» ممتلئة (30 سطرًا). اختر مسودة أخرى أو أنشئ مسودة جديدة."; `quantity_over` "هذا الخيار في السطر {position} بكمية {current}. لا يمكن أن تتجاوز الكمية 999."; `not_sellable` "هذا الخيار لم يعد متوفرًا." and the sheet reloads `readDraftPicker` so the selects show the new state; `not_found` "لم تعد هذه المسودة موجودة." and the sheet reloads the draft list; `invalid` with no name problem, `save_failed`, or a network failure: "تعذّر الإضافة. حاول مرة أخرى." The button shows its pending state while the call runs and cannot be pressed twice. A reload after `not_sellable` or `not_found` keeps the typed quantity and the typed new draft name; it keeps the chosen option only while it is still among the options and sellable, otherwise clears it (the `not_sellable` alert stays); it keeps the chosen draft while it is still listed, otherwise chooses the newest (or the new draft row when none are left).
- **AC-12**: The draft page keeps up. A quick order page open on the same draft (another tab or device) shows the new or merged line through spec 0020 AC-12's reload when it becomes visible again. No change to quick order is needed.
- **AC-13**: Logs. One JSON line per event: `draft_item_added` with `merged` and `newDraft` (booleans); refusals through spec 0020's `draft_refused` with the error name (and `fields: ["name"]` for a name problem); `draft_picker_failed` with the error name. Never a draft name, a product, a quantity tied to a person, or an id.
- **AC-14**: Layout and access. At 390 and 1280 the sheet, the card button, and the product page button use only design tokens and logical properties (the design and language rule tests pass), with no sideways scroll. Every control is at least 44 by 44; the radio rows are real `label`s; the sheet has a title tied with `aria-labelledby`, traps focus while open, and returns it on close. All strings live in `ar.json` under `DraftPicker`.
- **AC-15**: Tests. Vitest beside the source for `planCatalogAdd` (merge, a null quantity merged, 999 exactly allowed and 1000 refused with position and current, append, the 30 line refusal for an append only, a product only line ignored), `commitPickerQuantity`, `addToDraftSchema`, the sheet's start state (`pickerStart`: page option kept only when present and sellable), and `CardProduct.productId` in the card view tests (spec 0008's `CardProduct` literals gain the field). Database tests for `addToDraftInDb`: append with `sort` past the highest, merge, merge into a 30 line draft, `quantity_over`, `too_many_lines`, `not_sellable`, an archived option `invalid`, someone else's draft `not_found`, `updated_at` bumped, a new draft with exactly one line, the 30 draft limit and `name_taken` creating nothing, and two concurrent adds of the same option ending as one line with the summed quantity. Playwright at 390 and 1280 as an electrician: from a card, add a product with sizes into an existing draft and open it from the success link; from a product page, see the page's option and quantity prefilled; with no drafts, name a new one in the sheet; add the same option again and see "الكمية الآن"; push it over 999 and see the refusal. A customer, the owner, and a signed out visitor see no button on the card or the product page. axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) finds nothing on a category page with the card button and on the open sheet, with every rule on.

## Decision

**Chosen option**: one shared bottom sheet, opened from a product page button and a card photo corner button, fed by one read action on open and confirmed through one `addToDraft` action that merges or appends inside a single locked transaction, creating a draft first when named.

The sheet reuses quick order's option rules (`resolveOption`), name rules, and limits, so a line added from the catalog is indistinguishable from one typed in quick order.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no change. The feature writes spec 0020's `drafts` and `draft_lines` as they are. It relies on the unique `(draft_id, variant_id)` index (one line per option), the `quantity between 1 and 999` check, the unique `(owner_user_id, lower(name))` index, and the `(owner_user_id, updated_at desc, id desc)` index for the draft list. No migration.

**State transitions**: none new. A draft gains a complete line (product, option, quantity) or an existing line's quantity grows. A draft created here starts with one complete line instead of quick order's one empty line.

**API surface** (Server Actions in `src/features/drafts/server/actions.ts`, each returning `Result<T, E>`; the database half in `src/features/drafts/server/add-from-catalog.ts` with `server-only`, through `getDb()`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `readDraftPicker` | Server Action | `productId: uuid` | `{ drafts: [{ id, name, lineCount }], draftLimitReached: boolean, product: DraftProduct \| null }` | electrician (`getAccountProfile`, `canUseDrafts`) | `forbidden`, `invalid` (not a uuid), `save_failed` (read failed) |
| `addToDraft` | Server Action | `productId: uuid`, `variantId: uuid`, `quantity: 1..999`, `target: { draftId: uuid } \| { newDraftName: string }` | `{ draftId, draftName, position, quantity, merged }` | electrician, owner of the draft | `forbidden`, `invalid` (`problem?: DraftNameProblem`, set only for a new draft name), `not_sellable`, `not_found`, `too_many_lines`, `quantity_over` (`position`, `current`), `name_taken`, `too_many_drafts`, `save_failed` |

Reads and writes (server, `server-only`):
- `readDraftPickerData(db, userId, productId)`: the user's drafts with line counts in list order (the same query as `readMyDrafts`), `draftLimitReached = count >= MAX_DRAFTS`, and the product in quick order's `DraftProduct` shape (`id`, `name`, `code`, `imageKey`, product level `sellable`, and `options` with `archived_at is null` in `sort` order, at most `QUICK_SEARCH_OPTIONS`, each with its price, `archived: false`, and `sellable` from `isSellable`). The product is read by id with `listedProduct` from `storefront-sql.ts` (status active and category shown), and `isSellable` gets the real `categoryShown` (not the quick order search's hardcoded `true`, which relies on its list scope). No listed product: `product: null`.
- `addToDraftInDb(db, userId, input)`: AC-8 and AC-9 in one transaction. The live product and option row for the sellable check comes from one select by `variantId` and `productId` joining the product and its category, with `listedProduct`. For an existing draft target, a new `lockDraftForAdd(tx, userId, draftId)` locks the draft `for update` with the owner check and returns its `name` (null when missing or not the user's); then a new `lineForOption(tx, draftId, variantId)` returns that option's line `{ id, quantity, position }` or null (position from `lineOrder`), and `lineCount` gives the count. These feed the pure `planCatalogAdd`. An append sets `sort` with the same `max(sort) + 1` subquery as `addDraftLineInDb`. It reuses `lineCount`, `optionOf`, `touch`, and `afterClash` from `lines-db.ts` (exported, they are private today). The draft creation core of `createDraftInDb` (profile lock, 30 draft count, name clash, insert, `23505` on the name index as `name_taken`) moves into a shared `insertNamedDraft(tx, userId, name)`; `createDraftInDb` keeps adding its empty line after it, `addToDraftInDb` adds the item line instead. A `23505` on the line option index (a race past the lock, which cannot happen under it) maps through `afterClash` like the other line writes.

New and changed code:
- `src/features/drafts/catalog-add.ts` (pure): `planCatalogAdd({ existing: { position, quantity: number | null } | null, lineCount, quantity })` returning `merge` (new quantity), `append`, `quantity_over` (position, current), or `too_many_lines`; `commitPickerQuantity(typed)`; `pickerStart(options, pageVariantId, pageQuantity)`. Vitest beside it.
- `src/features/drafts/schemas.ts`: `addToDraftSchema` (target a union of `{ draftId }` and `{ newDraftName: draftNameSchema }`).
- `src/features/drafts/components/add-to-draft-sheet.tsx` (client): the sheet; `card-add-to-draft.tsx` (the photo corner button) and `product-add-to-draft.tsx` (the product page button reading `useProductSelection()`), both opening the sheet.
- `src/features/catalog/card-view.ts`: `CardProduct` and `CardSource` gain `productId` (named so it never clashes with `ProductCard`'s existing `id` prop, the `p-N` scroll anchor); `buildCardProduct` copies it, and the card read in `src/features/catalog/server/queries.ts` selects `products.id` for it.
- `src/features/catalog/components/product-card.tsx`: a `canAddToDraft` prop; when true, renders the corner button. `list-results.tsx`, `home-sections.tsx`, and the four page files pass it through.
- `src/app/[locale]/p/[slug]/page.tsx` and the product page's button stack: the AC-2 button when `canAddToDraft`.
- `src/i18n/messages/ar.json`: the `DraftPicker` namespace.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| catalog pages | `canAddToDraft` | `getAccountProfile()` then `canUseDrafts(profile)` (spec 0020 `access.ts`), per request |
| card button | product id | `CardProduct.productId`, from `products.id` in the card read (`queries.ts`) |
| `addToDraft` | listed and sellable | one select by `variantId` and `productId` joining product and category, `listedProduct` plus `isSellable` with the real `categoryShown` |
| `addToDraft` | existing line for the option | `lineForOption` (`draft_lines.id`, `quantity`, position by `lineOrder`) under the draft lock |
| product page button | product id, start option, start quantity | `ProductPageData.id`; `selectedId` and `quantity` from `useProductSelection()` |
| sheet | product name, code, options, prices, sellable | `readDraftPicker` → `DraftProduct` (live `product_variants.price`, `isSellable`) |
| sheet | start option | `pickerStart`: the page's `selectedId` if among the options and sellable, else `resolveOption` with nothing chosen (a single option resolves at once) |
| sheet | start quantity | 1 from a card; the stepper's value from the product page |
| sheet | draft rows, line counts, order | `readDraftPicker.drafts` (`drafts.name`, `count(draft_lines)`, `updated_at desc, id desc`) |
| sheet | chosen draft at open | the first row (newest); the new draft row when there are none |
| sheet | new draft row disabled | `readDraftPicker.draftLimitReached` (`MAX_DRAFTS = 30`) |
| sheet | unit price, "من {lowest}" | the chosen option's `price`; the lowest sellable option price when none chosen |
| `addToDraft` | merged quantity | `draft_lines.quantity` (null as 0) plus the input `quantity` |
| `addToDraft` | new line `sort` | `max(sort) + 1` in the draft, 0 for a new draft |
| `addToDraft` | `position` | merge: `lineForOption.position`; append: the new line count (it is last in `lineOrder`); a new draft: 1 |
| `addToDraft` | `current` on `quantity_over` | the existing line's `quantity` |
| `addToDraft` | `draftName` | `lockDraftForAdd`'s returned `drafts.name`; for a new draft, the tidied input |
| success block | "فتح المسودة" link | `routes.quickOrderDraft(draftId)` |

**Key invariants**:
- One line per option per draft (unique index); the catalog never creates a second line for an option already on the draft.
- A line's quantity is always 1 to 999; an add that would pass 999 changes nothing.
- A draft never passes 30 lines; a merge into a full draft is allowed because it adds no line.
- A user never passes 30 drafts; the profile row lock serialises concurrent creates.
- Every line added here is complete and sellable at the moment it is written.
- A refused add, including a refused new draft, writes nothing.

**Security model**: only an account whose role is `electrician` and is not `removalPending` (fresh from the database each request, spec 0019) can read the picker or add. Every draft read and write joins `drafts.owner_user_id = userId` in the same statement, so another user's draft id reads as `not_found`. The product read returns only listed products. No personal data is involved beyond the draft name, which is never logged. No rate limit, as in spec 0020: it needs an electrician account and each add is a deliberate confirm.

**Configuration required**: none.

**Critical test scenarios**:
- Happy path: an electrician adds a sized product from a category card into an existing draft, sees "أُضيف إلى «…»", opens the draft, and finds the line with its price, verifies **AC-3**, **AC-5**, **AC-7**, **AC-8**, **AC-10**
- Merge and cap: the same option again shows "الكمية الآن"; pushing past 999 is refused with the line number and nothing changes, verifies **AC-8**, **AC-11**
- Concurrency: two adds of the same option at once end as one line with the summed quantity, verifies **AC-8**
- New draft: with zero drafts, naming one in the sheet creates a draft holding exactly that line; a taken name or the 30 draft limit creates nothing, verifies **AC-7**, **AC-9**
- Auth: customers, the owner, and signed out visitors see no button; a direct call returns `forbidden`; another electrician's draft id returns `not_found`, verifies **AC-1**, **AC-8**

## Build plan

Tracer Bullet: one real add travels from the product page to the draft first, then each part is thickened.

1. Thin thread, product page only: `getAccountProfile` and `canAddToDraft` on the product page only; `readDraftPicker` returning the drafts and the product; `planCatalogAdd` with Vitest; `addToDraftInDb` for an existing draft (append and merge) with database tests; `addToDraft`; a first sheet with the selects, quantity, draft radios, confirm, and the success block; the AC-2 button. Satisfies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-10**
2. Cards: `CardProduct.productId` (and spec 0008's card test literals), the `canAddToDraft` prop through `ProductCard`, `list-results`, `home-sections`, and the home, category, and search pages; the photo corner button with its stacking and focus order. Satisfies **AC-1**, **AC-3**
3. New draft from the sheet: `insertNamedDraft` extracted from `createDraftInDb` (quick order tests still green), the new draft row, the zero drafts and 30 drafts states, the name errors. Satisfies **AC-7**, **AC-9**
4. Refusals and edges: every AC-11 message and reload, the read failure and retry, a product gone, `forbidden` closing the sheet and refreshing, `pickerStart` with Vitest, logs. Satisfies **AC-4**, **AC-11**, **AC-12**, **AC-13**
5. Finish: tokens and logical properties checked at 390 and 1280, focus handling, the remaining database tests (concurrency, new draft limits), Playwright as electrician, customer, owner, and signed out, axe on the category page and the open sheet. Satisfies **AC-14**, **AC-15**

## Consequences

**Positive**:
- Electricians build drafts while browsing, the way they actually shop, without retyping into quick order.
- No schema change and no new route; the feature rides on spec 0020's tables, limits, and option rules, so the two paths cannot disagree.
- One sheet component serves both entry points.

**Negative / tradeoffs**:
- Every catalog page view by a signed in user now reads the profile row (one small indexed select), even for customers who never see the button.
- Opening the sheet costs a server round trip, so the electrician sees a skeleton briefly.
- A product with more than 40 live options can only add its first 40 from the sheet (the same cap as quick order search).
- A product only line in the draft stays beside the newly added line of the same product; the electrician tidies it in quick order.
- The photo corner button sits over the product photo, a new visual element the design board has not drawn (O-16).

**Neutral**:
- `createDraftInDb`'s core moves into `insertNamedDraft`; quick order behaviour does not change.
- `CardProduct` gains `productId`.
- The quick order and catalog paths now both write `draft_lines`; any later change to line rules must cover both.

## Follow-up

- [ ] Spec 0020 Follow-up "Feature 22 (add to draft from the catalog)" is answered by this spec; tick it.
- [ ] Design handoff O-16: record the photo corner button, the product page outline button, the sheet (selects, quantity, draft radios, new draft row, success block), and the refusal wording, so the board matches.
- [ ] Later, if electricians ask: remember the last draft added to on this device instead of preselecting the newest.
