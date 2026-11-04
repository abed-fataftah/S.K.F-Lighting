# 0021. Add to draft from the catalog: rationale

## Context

Spec 0020 gave electricians quick order: named server drafts of up to 30 lines, built by typing a product name or code into each line. That is fast when the electrician already knows the codes. When they don't, they browse the catalog like anyone else, and today the only way to get a product from a product page into a draft is to remember it and retype it in quick order. Feature 22 in the scope closes that gap: "product pages and lists offer add to draft for electricians, they choose which draft, and the item appears there with its price."

The forces: most catalog products have several options (size, colour), and a draft line is only complete with one option and a quantity, so a one tap add from a list cannot know what the electrician means. Drafts have hard limits (30 drafts, 30 lines, quantity 1 to 999, one line per option), and the scope note in spec 0020 already fixed the merge rule: an option already on the draft adds to its quantity, a new option appends a line. The storefront is phone first (390 px), product cards sit two per row with a full bottom button row, and `design.md` rules out toasts in favour of feedback in place. Catalog pages render on every request (Cache Components off, spec 0001), and the role is read fresh from the database (spec 0019), so showing a control to one role costs a profile read but no cache work.

If this is not decided, the build has to invent the option choice, the quantity, the picker, and every limit's behaviour, and the result could disagree with quick order about what a valid line is.

## Options considered

### Option 1: One bottom sheet with option, quantity, and draft choice (chosen)

Both entry points open the same sheet. It loads the drafts and the product's live options on open, reuses quick order's `resolveOption` for the selects, has a 1 to 999 quantity field, a radio list of drafts with a "new draft" row, and confirms through one action that merges or appends in a locked transaction.

**Pros**:
- The electrician adds exactly the option and quantity they mean, from any card.
- One component and one action; quick order's rules are reused, not copied.
- Room for every refusal and the success state in place, honouring "no toasts".

**Cons**:
- Two taps more than a one tap add, and a round trip on open.
- A new UI surface the design board has not drawn.

### Option 2: One tap add of the card variant into a chosen draft

The card button adds spec 0008's card variant (cheapest sellable option), quantity 1, into a draft picked from a short dropdown menu.

**Pros**:
- Fastest possible add; matches how the card's add to cart works.

**Cons**:
- For products with sizes it usually adds the wrong option, which the electrician must fix in quick order, defeating the point.
- No place to set quantity or show refusals clearly.

### Option 3: Add a product only line and finish it in quick order

Cards add a line with the product but no option; the draft shows it incomplete with the selects.

**Pros**:
- No option selects in the catalog; very little new UI.

**Cons**:
- Every add leaves homework, and repeated adds of the same product pile up as separate incomplete lines, since merging needs an option.

### Option 4: Preload drafts and options into every catalog page

Same sheet as Option 1, but the electrician's drafts and every card's options are rendered into the page.

**Pros**:
- The sheet opens instantly.

**Cons**:
- Heavier pages for every electrician view, and a draft list that goes stale when they edit drafts in another tab.

## Rationale

Option 1 is the only one where the line that lands in the draft is complete and correct at the moment of adding. That matters because a draft line without an option or quantity blocks sending (spec 0020 AC-13), so Options 2 and 3 move the work into quick order rather than removing it. Reusing `resolveOption`, the name rules, and the limits keeps the catalog path and the quick order path from ever disagreeing about a valid line, and sharing `lines-db.ts` helpers keeps the 30 line cap and one line per option rule enforced under the same lock.

Loading on open (rather than Option 4) keeps catalog pages light for everyone and always shows the current drafts; the brief skeleton is a small price for a flow the electrician starts deliberately. Refusing at 999 instead of clamping follows the engineer's choice and the general rule that a limit should never quietly drop what someone asked for. Allowing a merge into a full 30 line draft follows from the limit's purpose: it caps lines, and a merge adds none. Creating the new draft and its line in one transaction means a refused add never leaves an empty draft behind.

The card button moved from the bottom row to the photo's top end corner after measuring the layout: cards are about 174 px wide at 390, and a third 44 px button would leave "أضف للسلة" about 50 px, too narrow for its label. The corner keeps the existing row untouched. The role check on the server per request was chosen over a client side check so the buttons are in the first paint and the HTML other visitors get carries nothing about drafts; the cost is one indexed profile read per signed in page view.
