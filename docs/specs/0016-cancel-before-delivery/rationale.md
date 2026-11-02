# 0016. Cancel before delivery: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md` and can skip this file.

## Context

Feature 17 lets customers cancel an order from its order page (spec 0015). The scope says a customer cancels "at any stage before delivery", the cancel "shows in your dashboard", and WhatsApp opens with a cancellation message. The scope's standing WhatsApp decision adds that every such message is also saved and flagged in the dashboard, "so nothing depends on the customer pressing send". The design handoff (section 9, and `pages/order.md`) instead draws the cancel as a WhatsApp request only: the customer taps "إلغاء الطلب عبر واتساب", and the owner decides and sets the status. The design marks the rule for when cancelling is allowed as not decided.

Spec 0014 already shipped half of this. The owner can cancel inside one locked transaction with exactly one event row. The dashboard flags any `cancelled` event written with `seen_at` null as unseen, with a dot, a sidebar count, and an "ألغاه العميل" badge when `cancelled_by` is not `admin`. That spec left feature 17 two things to decide: write the event unseen with the customer's actor kind, and decide the customer's own cutoff.

The forces at play. The shop prepares orders by hand and delivers with its own driver, so a cancel after the order has left wastes a trip. Payment is cash or cheque at the door, but the owner can record a deposit or a partial payment (feature 24), and refunds are out of scope until the returns features. Access to the order page is by cookie only: the placing browser (`skf_placed`) or a browser that matched number plus phone (`skf_tracked`), and there are no customer accounts yet (feature 18). The site is Arabic, mobile first, and every user facing path needs phone and computer Playwright flows.

Without a decision, either customers have no way to cancel except a WhatsApp message that might never be sent, or a cancel lands on orders the owner has already shipped or taken money for.

## Options considered

### Option 1: Cancel at once through the shared guarded write (chosen)

The customer confirms in a dialog, and a Server Action checks the order cookie and a pure cutoff rule. It writes the cancel in the same locked, guarded transaction the owner uses, with the event unseen. WhatsApp then opens once with a past tense message. Blocked orders (out for delivery, or paid) get a request button instead.

**Pros**:
- Matches the scope and spec 0014 exactly; the dashboard flag already exists and needs no code.
- Works even when the customer never sends the WhatsApp message.
- One write path for both actors, so races between the customer and the owner resolve as `stale`, never a silent overwrite.
- No migration.

**Cons**:
- Final and self service: a mistaken tap cancels for real, and anyone holding the unlocked browser can cancel.
- The design boards need updating (label, dialog, notes).

### Option 2: Save a cancel request, the owner approves

The customer's tap records a "cancel requested" event and flag; the order keeps its status until the owner accepts or refuses in the dashboard.

**Pros**:
- The owner keeps full control over every cancel, at any stage.
- A mistaken request can simply be refused.

**Cons**:
- Needs a new pending state (a column or an event type reading), an approve and refuse step in the dashboard, and a customer view for "requested, waiting", which is a much larger feature.
- The customer does not know whether the order is cancelled until the owner acts, which is the waiting the feature exists to remove.
- Goes against the scope's "customers cancel".

### Option 3: WhatsApp only (the design handoff as drawn)

The button only opens the design's W6 request; nothing is saved.

**Pros**:
- Smallest build: one link.
- The owner decides everything, as the design board says.

**Cons**:
- Nothing reaches the dashboard unless the customer presses send, which breaks the scope's standing rule.
- The status the customer sees stays wrong until the owner reads WhatsApp.

## Rationale

Option 1 is the only one that honours both standing rules in the scope: customers cancel, and nothing depends on the send button. Spec 0014 was built expecting exactly this write (an unseen `cancelled` event whose `cancelled_by` is not `admin`), so the dashboard side costs nothing. The real risk of a self cancel is operational, a driver on the road or money already taken, and the cutoff answers both. Self cancel stops once the order is out for delivery or has a payment, and those orders fall back to the design's own request flow (Option 3's behaviour), so the owner still decides exactly the cases that need a person. Option 2 would add a whole approval workflow to protect the cheap cases (new, preparing, ready), where cancelling costs the shop little more than putting items back.

The engineer chose each part in the interview: cancel right away, cutoff when the order leaves the shop, block when paid, an optional reason, WhatsApp opened once plus a fallback button, a past tense message, a dialog, the label "إلغاء الطلب", a note plus request button when blocked, any browser that can open the page may cancel, a who and when line, and no undo.

Smaller calls made while writing the spec:
- **No rate limit on the action.** It needs an unguessable order uuid from an httpOnly cookie, and the write happens once and is final, so there is nothing to guess or repeat. Runner up: reuse a Workers limiter like the lookup's, which adds a binding for no measured threat.
- **`cancelled_by = 'guest'` for now.** No account path exists yet, and spec 0014 labels every non admin actor "العميل". Runner up: derive from `placed_by_role`, which would label an anonymous browser as an account holder. Feature 18 revisits it.
- **Reuse `cancelOrderSchema` and put the customer write beside the owner's.** The input shape is identical and the lock, guarded update, and stale handling must stay identical, so both live in the existing `admin-status.ts`. Its name is kept for now, which avoids churn with no change in behaviour (cross check). Runner up: a separate customer module that copies the helpers, which invites drift.
- **Cross check fixes (2026-10-28, another model).** Focus moves to a focusable header badge after the dialog goes away. The dialog message clears on a new status and on close. The cancelled line uses `formatDateTime` in `<time>`, matching spec 0014. One `ActorKind` lives in the pure `status.ts`. The hand off reads a captured constant, and a `pageshow` refresh guards the back and forward cache. The Playwright wording uses `page.route` for wa.me, checks the count after a fresh load, and leaves the server log check to the action test.
- **The cookie check runs before any query.** An id outside the cookies costs nothing and reveals nothing (`not_found`, the same as an unknown id).
- **The button renders only after mount.** A server rendered dialog trigger that does nothing until hydration is a dead control. Runner up: a separate confirm page that works without JavaScript, which the engineer declined in favour of the dialog.
- **One green button on a cancelled page.** On a customer cancel, the green button becomes the W6 "tell us" button in place of W7 (the float still sends W7), following spec 0013's rule of no second green button.
- **The customer's own reason is not shown back.** It keeps the customer page select free of free text columns, in line with spec 0015 AC-13. The owner sees it on the dashboard.
- **No storage mark for the hand off.** Unlike W5, a second successful cancel is impossible, so the one time open needs no `sessionStorage` key.
