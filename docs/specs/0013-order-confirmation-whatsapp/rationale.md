# 0013. Order confirmation and WhatsApp: rationale

Build spec: [index.md](index.md).

## Context

Spec 0004 (slice 1) already built `/checkout/done/[number]`: the dashed number box, three next steps, a green button with W5, the one time hand off to WhatsApp, and the `skf_placed` cookie guard. W5 already lists items, size, colour, quantities, fee, notes, total, and the order link. Feature 14's scope still asked for two things no spec defined: an order summary on the confirmation page, and a WhatsApp contact button that carries the order number. `confirmation.md` drew no summary, and its open item says guest lookup needs the phone number, which the page did not show. The design's message catalog (handoff section 9) already holds W7, the order contact message, and the shell float exists but always sends W1.

## Options considered

### Option 1: Thicken the existing page in place (chosen)
Add the summary card, phone line, copy button, and a path aware float to the page spec 0004 built. Reuses the route, guard, hand off, and W5 builder. Small, reversible, no migration.

### Option 2: A separate W7 button on the page
Add an outline "تواصل معنا عبر واتساب" button with W7 next to the green W5 button. Rejected: two WhatsApp buttons on one screen, one sending the whole order and one a short note, is easy to confuse right after ordering.

### Option 3: Treat the W5 button as the contact button
Change nothing; W5 already carries the number. Rejected: it sends a whole new order message again, so a customer with a question would send a duplicate looking order, and the float would still send W1 with no number.

## Rationale

- **Summary below the buttons.** If the auto open failed, the green button is what the customer needs first; a ten line summary above it would push it out of view on a phone.
- **Rows shaped like the order page.** The order page (feature 16) draws the same "المنتجات" rows, so one `OrderSummary` serves both and the customer sees the order the same way twice.
- **Saved amounts only.** The subtotal, fee, and total are the saved columns the customer agreed to and the owner sees, so the page can never disagree with the dashboard or W5.
- **Phone shown.** Guest lookup needs the number plus the phone; the page is already limited to the placing browser, and W5 opened from it already holds the phone, so showing it adds no exposure.
- **W7 on the float.** Reuses the existing float and the existing W7 wording, and the same rule extends to `/orders/[number]` later. Reading the number from the path keeps the layout free of page data; a refused order gets the root not found page today, which has no float; if a later not found page inside the shop layout shows one, it would offer W7 for the typed number, which reveals nothing.
- **Same hand off on computers.** wa.me already sends a computer to WhatsApp Desktop or Web; opening a new tab without a tap is blocked by popup blockers, and a phones only check adds device sniffing for little gain.
- **Live photo, not a copy.** `order_lines` has no photo column, and adding one is a migration for a picture; the cart already reads the first image through the product, so the page uses that path. Runner up: a copied `image_key` on the line, worth it only if the owner starts replacing photos often.
