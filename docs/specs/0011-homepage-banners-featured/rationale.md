# 0011. Homepage, banners, and featured products: rationale

The decision record behind [index.md](index.md). `/develop` builds from `index.md`; this file says why.

## Context

Home today is a placeholder from spec 0004: the newest 24 sellable products in a grid. The design (`docs/design/pages/home.md`) draws a different page: a black hero card, a carousel of category circles with photos and short lines, an owner circle, a few featured products, four trust cards, and a yellow delivery strip. Banners from the dashboard are meant to replace the hero card, but their size, layout, and edit dialog were never drawn (open item O-9). The dashboard editor (`pages/admin-homepage.md`) shows a banner list, a featured list, and a checkbox grid of main categories, with one save button for the whole page.

Several things the page needs have no home yet. The featured count is "set in the dashboard", but the editor has no field for it. Categories have no photo and no subtitle (spec 0008 left both to this feature). The delivery fees, the address, and the owner's name and photo all belong to shop settings, which is feature 26 and not built. The owner circle itself is a scope addition the owner has not approved (O-28). The fees are seeded in `delivery_zones` with long names ("الضفة الغربية", "الداخل (مناطق 48)"), while the strip uses short ones ("الضفة", "الداخل").

Forces: one owner edits everything, on a phone or a laptop, and is not technical. Customers are on phones with mixed connections; Home is the first page most of them see, so it must load fast and never fail as a whole. The site is Arabic only and RTL, and must meet WCAG AA, which rules out a carousel that moves on its own without a pause control. Spec 0002's sketch already named `banners` and `featured_products`, but neither table was migrated, so their shape is still free to change. Everything stays on the existing stack: Postgres through Drizzle, Supabase Storage with the signed upload pattern from spec 0006, and the image loader from spec 0001.

## Options considered

### Option 1: Dedicated homepage tables plus columns on the rows they describe

`banners` and `featured_products` as their own tables; the circle photo, line, and Home tick as columns on `categories`; a short name on `delivery_zones`; a version counter on `shop_settings`.

**Pros**:
- Each fact lives on the row it describes, with real foreign keys: a deleted product leaves the featured list by cascade, and a deleted link target clears the banner link.
- Home reads are plain joins that reuse the existing category and product rules (`buildNavigation`, the listed rule, `CardProduct`).
- Each part can be read and fail on its own.

**Cons**:
- Touches four existing tables in one migration, and the category dialog from spec 0008 grows.
- Needs a separate guard (the version counter) to make the page save safe across tabs.

### Option 2: One homepage document in `shop_settings`

A single `jsonb` column holding banners, featured ids, the category choices, and the circle details, saved whole by the page button.

**Pros**:
- One read and one write; the page's single save button maps to it directly, and a version check is one compare.
- No changes to the category or zone tables.

**Cons**:
- No foreign keys: a deleted product or category leaves a stale id that every read must filter, and nothing stops a typo in the JSON shape.
- The circle photo would live away from the category it shows, so the category dialog and Home would disagree on where it is edited.
- Featured products could not join the card query cleanly, so the listed rule would be checked in code a second time.

### Option 3: Keep Home mostly fixed in code

Banners and featured products in tables, but the circles always show every main with a built line and no photo, and the strip keeps its fixed text.

**Pros**:
- The smallest build; no category or zone changes.

**Cons**:
- Fails the design: no circle photos, no control over which mains show, and the strip goes stale the first time a fee changes.
- Pushes the same work into a later feature anyway.

## Rationale

Option 1 fits the forces best. The owner edits rows that already exist (categories, zones) and two small lists, and the database keeps them honest with foreign keys, which matters because products and categories are created, hidden, archived, and deleted by three other features. Option 2's single save maps neatly to the board's one button, but it trades integrity for that convenience, and every read would have to clean up after deleted ids. Option 3 ships quickly but leaves the design half built.

The smaller calls, each made in the design conversation:

- **Carousel, not a stack or auto rotation.** A stack of five banners pushes the categories off the first screen on a phone. Auto rotation needs a visible pause control under WCAG 2.2.2 and is widely ignored. A swipe carousel with buttons and dots keeps the top short and lets the customer move it. It does not loop, so the end buttons can be disabled, which is simpler and clearer than a loop for 2 to 5 slides.
- **One 16:9 picture.** Desktop is still the 480px column (O-1), so a second wide image buys nothing yet. 16:9 holds a product photo plus words, and 1600×900 covers a 480px column at 3× pixel density. `phone_image_key` from the sketch is dropped; a wide variant can be added when O-1 is drawn.
- **The title is the alt text, and the words go in the picture.** Overlaid text on unknown photos is a contrast risk the owner cannot see. With one field, the owner names the banner once, and the editor row and the screen reader both use it.
- **Links are picked, not typed.** A stored category or product id survives renames and drops out on its own when the target goes away; a typed URL breaks silently. "Not live" is derived at read time, so showing a target again brings the link back with no edit.
- **Two save paths.** The dialog saves its banner at once, because its image is already in Storage and an unsaved banner would leave an orphan file in page state. Order, ticks, featured, and categories are cheap page state, saved together by the board's button.
- **`home_version` on `shop_settings`.** The editor spans three tables, so no single row's `updated_at` can tell whether "the homepage" changed. One counter, taken with a row lock in every homepage write, is both the stale check and the lock that keeps the 10 and 5 caps true when two writes race. Runner up: a token built from the newest `updated_at` across the three tables, which needs no column but gives false stale results whenever an unrelated category edit happens.
- **Featured count = the list.** The editor has no count field, and a separate number the owner must keep in sync with the list is a trap. Eight keeps the section short.
- **`show_on_home` on the category, default true.** New mains show without a second step, the order follows the existing category order, and there is no extra reorder screen. Mains that the menu would not list (hidden, or no listed product) are skipped even when ticked, so Home and the menu agree.
- **The circle line falls back to the subs.** The board's lines are exactly the first sub names, so the fallback looks right with no typing, and the owner can still write their own.
- **Photo and line in the category dialog.** Spec 0008 already assigned them to the category. Editing them on the homepage page would turn a checkbox grid into a list of small forms.
- **Centre crop, no crop tool.** A cropper adds a library and its keyboard and screen reader work; a centred crop with a preview is enough when the owner picks a photo with the subject in the middle.
- **Fees from `delivery_zones` with a short name.** Checkout already reads these rows, so Home can never disagree with what the customer pays. The full names would wrap the 12px strip on a phone.
- **The owner circle waits.** O-28 says build only after the owner confirms, so feature 25 adds no columns that may be thrown away. Feature 26 owns the owner fields anyway.
- **Each section fails alone.** A Home that goes blank because the featured read was slow is worse than a Home missing one section, and the hero is a natural fallback for banners.
- **The newest products become the featured fallback.** The design has no newest grid, but hiding the featured section when nothing is picked would leave launch day Home with no product at all. Showing the newest 8 sellable products in its place reuses an existing read and keeps the three e2e flows that open a product from Home working. Runner up: hide the section and rely on a launch checklist item for the owner.
- **A pause button on the circle carousel.** The board stops the auto advance on touch or focus only; WCAG 2.2.2 asks for a way to pause anything that moves on its own for more than five seconds, so a small pause and play button sits with the arrows. With 1 to 3 circles there is no carousel, so each circle is a plain link and nothing needs both selecting and navigating.
- **Cross check fixes.** An independent read found the gaps now closed in `index.md`: the strip handoff, the dialog and page merge, the error table, the raw category read for the editor, the `23503` race on featured products, picker details, and `inert` off screen slides.
- **The sweep covers the new folders.** The dialog uploads before save, so a closed dialog leaves an unreferenced file. After commit cleanup handles replacements; the weekly sweep, already running for products, is the backstop.
