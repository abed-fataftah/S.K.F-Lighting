# 0006. Product management: rationale

Decision record for [index.md](index.md). `/develop` does not need this file.

## Context

Slice 1 (spec 0004) shipped a four field product form: name, code, category, price, one default variant. Feature 7 must cover the whole product as the scope describes it: photos, an optional video, description, dimensions and specifications, size and colour options with a price per size, and availability per product and per option, with changes visible on the site right away.

Spec 0002 fixed the storage shape: one `product_variants` row per size and colour pair, rows that order lines reference can never be deleted, `code` and `slug` never change, and photos live in `product_media` under `products/{productId}/` in the public `product-media` bucket. Spec 0001 fixed how files travel: the browser uploads straight to Supabase Storage with a signed URL minted by an admin only action, and the Worker never carries file bytes. The storefront renders on every request, so "right away" needs no cache work beyond Hyperdrive caching being off.

The design board (`admin-product-editor.md`) draws sizes and colours as two separate lists and a video link field, and it has only a "show in shop" switch. Each of these disagrees with the data model or the scope, so the editor has to bridge them. The owner is the only admin and often works from a phone, so uploads run over mobile data. A single product can have up to 12 sizes by 12 colours. Two tabs or a later spreadsheet import (feature 8) can edit the same product.

Getting this wrong costs money in two ways: an edit that rewrites an old order line, and a stale tab that silently restores an old price.

## Options considered

### Option 1: One whole form save with server side reconciliation

The client holds the whole product in memory and sends its full wanted state to one `saveProduct` action. The server checks a `version` number and then reconciles every part (variants, colours, specs, media) against the stored rows in one transaction, archiving what orders still reference.

**Pros**:
- All or nothing: the shop never sees half an edit. One version check covers the whole product.
- The reconcile rules are a pure function, testable with plain tables.
- It matches the board's single "حفظ المنتج" button.

**Cons**:
- One large action with many responsibilities, and large payloads (up to 144 pairs).
- A failed save loses nothing on screen, but nothing at all is stored until it succeeds.

### Option 2: Fine grained actions per part

Separate actions for basic info, add, edit, and remove size, add and remove colour, toggle a pair, and add, remove, and reorder media. Each one writes immediately.

**Pros**:
- Each action is small and simple. Edits are never lost to a failed big save.

**Cons**:
- Many partial states reach the shop (a size with no price yet, a colour with no pairs).
- Version checks have to run on every call, or conflicts slip through.
- Around ten actions to secure and test. It also diverges from the board's single save.

### Option 3: Whole form save that replaces all variants

Same single save, but the server deletes every variant and media row and inserts them fresh.

**Pros**:
- The simplest server code, with no matching logic.

**Cons**:
- It breaks as soon as any variant has been ordered (the `restrict` foreign key), or forces archiving every row on every save, piling up ghost rows and changing variant ids. Carts hold variant ids, so a plain price edit would empty every cart line for that product.

## Rationale

Option 1 is the only one that meets both money risks from Context at once. The transaction plus `version` check stops a stale tab from undoing a newer price, and matching pairs by size identity and `colour_id` keeps variant ids stable, so carts survive edits and ordered rows are archived rather than rewritten. Option 3 fails the stable id requirement outright. Option 2 trades one big, well tested action for many small ones that each leak partial states into a live shop, which is worse for a single owner editing on a phone. The size of `saveProduct` is the accepted cost; pushing every rule into `planVariants` and `media-rules` keeps the impure part thin.

`version` was added instead of reusing `updated_at`, because Postgres stores microseconds and JavaScript dates keep only milliseconds, so a round trip comparison would report false conflicts.

The smaller calls, as chosen with the owner in the design conversation:
- **Availability**: two lists plus a pair grid. The board's per size and per colour switches cannot mark one pair out alone, and one row per pair is too heavy to fill. Runner up: the board's lists only.
- **Price by size only**, as the scope says. Runner up: a per pair override.
- **Video as an mp4 upload**: it fits the existing table and bucket and avoids a third party player on the product page. Runner up: a YouTube link, which needs a new column.
- **Delete if never ordered, else archive**, with restore to hidden. Runner up: always archive.
- **8 photos, 1 video**, reordered with move buttons (keyboard and phone friendly, no drag library), no colour photos yet, and resizing to 2,000 px WebP in the browser.
- **Specs**: suggested rows plus free rows. **Category**: main plus optional sub, keeping the inline new main field until feature 9. **Colours**: pick or create by name from the shared list. **No per pair code.**
- **Two status switches** (show in shop, available), matching the two columns and the scope's "mark the product out of stock".
- **Stale saves refused. Cleanup on save plus a weekly sweep** run from GitHub Actions (no custom Worker entry needed). **List**: pages of 50 like orders, the board chips plus مؤرشف, all in the address.
- **Leave warning on unsaved changes. Caps of 12 sizes and 12 colours. No price history** (orders already keep their prices). **After creating, land on the edit page.**

Decided while writing:
- **Typed object to the action rather than `FormData`**, because the nested arrays (sizes, pairs, media) are awkward and error prone as form fields. Runner up: a JSON string in a hidden field.
- **The whole colour list is loaded with the editor** rather than searched on the server. It is a small shop wide list. Runner up: a search action.
- **Two pass size renames** through a temporary label, so swapping two labels never trips the `(product_id, size_label, colour_id)` unique index. Runner up: making that constraint deferrable, which changes the schema for a rare case.
- **Storage deletes only after commit**, best effort, with the weekly sweep as the backstop. Runner up: deleting inside the request before commit, which can lose files a rolled back save still points at.
- **Admin search as a code prefix or a name `ilike`**. Feature 11 owns forgiving Arabic search. Runner up: running `normalizeForSearch` in SQL now, which would duplicate feature 11's work.
