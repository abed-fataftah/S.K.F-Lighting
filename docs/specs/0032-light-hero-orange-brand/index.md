# 0032. Light hero and orange brand colour

**Date**: 2026-11-19
**Status**: Accepted

## Summary

Home's hero moves off the black band onto a white surface, and the shop's brand colour changes from yellow to a warm orange (#F7931E) everywhere: storefront, dashboard, logo, and the link preview pictures. You picked both from a mockup (option "B · Light") because the black hero, under a black header, made the first screen feel almost all black. In code the colour token is renamed from `yellow` to `brand`, so a future colour change is one value. A new dev only command fills your local products and categories with glowing sample pictures until you upload the real photos.

Amends spec 0030 (AC-3 surface, AC-4 tint colour, AC-5 text colours, AC-6 arrow style, AC-8 dot colours, AC-11 fallback card, AC-14 loading shape colours) and spec 0003 (the colour names and the yellow rule). Everything else in those specs stands.

## Requirements

**User stories**:
- As a shopper, I want a bright, open first screen so that the lamps and chandeliers stand out instead of disappearing into black.
- As the owner, I want my shop in orange everywhere, logo included, so that the brand looks the same on every page and in every shared link.
- As the owner working locally, I want sample pictures on my demo products so that I can judge the design before my real photos are uploaded.

**Acceptance criteria**:
- **AC-1**: The brand token. In `src/app/tokens.css`, `--skf-yellow` becomes `--skf-brand: #f7931e` and `--skf-yellow-tint` becomes `--skf-brand-tint: #feefdc` (not the mockup's #fdebd3, which put `control-border` at 2.98:1 on the tint; #feefdc gives 3.09:1 and looks the same); the Tailwind colour names `yellow` and `yellow-tint` become `brand` and `brand-tint`, and the shadcn role names that pointed at yellow (`primary`, `ring`, and any other) point at `brand`. No `yellow` colour name, `--skf-yellow` variable, or `#fcf42c` value is left anywhere in `src/` or `e2e/`; `bg-yellow` produces no CSS (the Tailwind lock test). This includes the places that are not class uses: the `colourNames` list in `src/lib/utils.ts` (so `cn()` merges `bg-brand` against other colours), the design system gallery's colours section (`src/app/(gallery)/design-system/sections/colours.tsx`: ids such as `inkOnYellow` become `inkOnBrand`) with its keys and Arabic copy in `src/i18n/messages/ar.json` ("الخلفية الصفراء الفاتحة" becomes "الخلفية البرتقالية الفاتحة", and any other "أصفر" or "صفراء" that names the brand colour becomes "برتقالي" or "برتقالية"), the `expectFocusOutline` colour option in `e2e/a11y.ts` (`"yellow"` becomes `"brand"`), the test picture colour in `e2e/homepage.spec.ts` (any colour that is not the brand), and the comments that say yellow (`logo.tsx`, `fees.ts`, `hero-chandelier.tsx`, `tokens.css`, `scripts/make-share-images.mjs`). Hover and pressed states stay `brightness-95` and `brightness-90`.
- **AC-2**: Every use moves to the new name, with the same meaning: every `bg-`, `text-`, `border-`, `fill-`, `stroke-`, and `decoration-` yellow class (storefront, dashboard, and the gallery page), the `.on-dark` focus outline (now orange on black), the bottom bar underline, the dashboard sidebar's active bar, the cart count badge, the category cards' selected edge, the hero dots, and the default button. The colour rule becomes: **brand orange is only a fill under ink text, or text or an outline on black; never text on white or on the page colour.** Ink on brand (8.22), brand on ink (8.22), ink on brand tint (about 16.5), and muted on brand tint (about 6.5) each reach at least 4.5:1; `control-border` on brand tint reaches at least 3:1; brand on white (2.30) and on page (2.10) stay below 3:1, which is why the rule forbids it. The contrast test reads the stated ratios from the "Contrast table" comment block at the end of `tokens.css`, so that block is rewritten with the new pair names and the ratios computed for the final values (its pair count stays as the test expects, plus the new `control-border` on tint pair if it is added), and its "FORBIDDEN" line states the new ratio.
- **AC-3**: The logo and brand pictures. Every `#FCF42C` fill in `public/brand/skf-logo.svg` (11 places) becomes `#F7931E`; `public/brand/logo.png` (512×512) and `public/brand/share.png` (1200×630) are made again by rerunning the existing `scripts/make-share-images.mjs`, which sets those sizes; no new image code. The paths do not change, so no code, metadata, or structured data changes. `src/app/favicon.ico` is the framework's default icon, not the yellow, and is out of scope.
- **AC-4**: The design docs follow. `docs/design/design.md` (colour table and rules), `docs/design/handoff.md` (token names), `docs/design/tokens.css` (the copy of the tokens), and every `docs/design/pages/*.md` that says yellow say brand orange with the new names and values. Specs 0003 and 0030 carry a one line "Amended by 0032" note under their status line; their text is not rewritten.
- **AC-5**: Light hero surface (replaces the surface part of spec 0030 AC-3; order, alignment, outside `PageFrame`, and clipping stand). `home-hero` is `bg-white text-ink`, with no `on-dark` class. Below `md` it is a card with `rounded-hero`, a 1px `border-border`, and `--page-pad` side margins; from `md` a white band across the whole screen with a 1px `border-border` bottom edge and no side edges or radius. The band still reaches both screen edges at 1920 with no sideways scroll.
- **AC-6**: The words. The `h1` line 1 is ink. Line 2 "وكهربائيات" is ink text on a brand marker: an inline block `bg-brand` with `rounded-btn` and `px-3`, on its own line below line 1, so no orange text is on white. The `h1` stays exactly two lines at 390 and wider. The subline is `text-muted`.
- **AC-7**: Side cards fade toward white. The tint overlay of spec 0030 AC-4 is `bg-white` instead of `bg-ink`, at the same opacity values from the 0030 geometry table; it moves and transitions with its card exactly as before. The out of stock label stays the black chip. Whether the side cards still read as faded is checked on the Home screenshots in the finish task; the 0030 rule that the build may tune by up to 10% applies to the opacities too.
- **AC-8**: Centre card words. The product name and price are `text-ink`; an out of stock price is `text-muted` (replaces `text-white` and `text-on-dark-muted` in spec 0030 AC-5).
- **AC-9**: Controls on white. Dots: each one `border-control-border`; the centred one `border-ink bg-brand` (replaces 0030 AC-8 colours); size and hit target unchanged. Arrows: `bg-white`, a `control-border` edge, ink chevrons, hover `bg-page`; still 44×44, shown from `lg`, placed as 0030 AC-6 says. The focus outline inside the hero is the ink outline of light surfaces.
- **AC-10**: Buttons. "تسوّق الآن" is the default button (brand fill, ink text); "اطلب عبر واتساب" is unchanged. Both stay 52 high.
- **AC-11**: The fallback card goes light too (replaces the colours of spec 0030 AC-11). `hero-card.tsx` uses the same surface, borders, words, marker, and buttons as AC-5, AC-6, and AC-10. The chandelier drawing stays and reads on white: its glow circles stay brand at their low opacity, its pale crystal parts (today `fill-yellow-tint`) become `fill-brand`, and the two pale yellow drawing colours that vanish on white, `--illus-08` (the chain, #e9d58a) and `--illus-09` (the candle sleeves, #f5efd0), become orange shades that show on white and match the brand (values set in `tokens.css`, each at least 1.5:1 on white, checked on the screenshot). Its shape and placement do not change.
- **AC-12**: Loading shape. `(home)/loading.tsx` draws the hero block as the light surface of AC-5 with `bg-fill-muted` skeleton blocks in place of the black surface with `sidebar-active` blocks; the shape (two lines, the card block, dots row, two buttons) is unchanged.
- **AC-13**: Accessibility holds. axe passes on `/` with the coverflow hero and with the fallback card at 390, 820, and 1280; no sideways scroll at 390, 768, 820, 1024, 1280, or 1920.
- **AC-14**: Sample pictures for dev. A new command `pnpm media:samples` (script `scripts/media-samples.ts`, run with `tsx --conditions=react-server` like the other scripts):
  - loads its settings like `scripts/media-sweep.ts` does (`.env.local` and `.dev.vars`), and stops with a clear message and a non zero exit unless **both** the database URL is local (the `isLocalDatabaseUrl` guard `seed-dev.ts` uses) **and** the Supabase URL's host is `localhost` or `127.0.0.1`, so it can never touch the live shop or mix a local bucket with a remote database;
  - gives every product that has no `product_media` row of kind `image` one generated picture, and every **main** category (`parent_id` null, the only ones that show a picture) whose `image_key` is null or empty one generated picture; anything that already has a picture is left alone, so a second run adds nothing;
  - a product picture is a 4:5 WebP, 1200×1500; a category picture is a 1:1 WebP, 800×800 (the crop the category dialog stores); both at WebP quality 80, made with `sharp` from an SVG built in code: one of five drawings (chandelier, table lamp, pendant, wall light, bulb) lit by a warm glow on a product tone background. The colours (the four `--skf-product-bg-1..4` tones and `--skf-brand` for the glow) are read from `tokens.css` at run time, as `make-share-images.mjs` reads the ink, so no colour literal is added outside `tokens.css`;
  - the drawing and tone come from `pickSample(id)`: sha256 of the id, first byte modulo 5 for the drawing, second byte modulo 4 for the tone, so a rerun on a fresh database gives the same look;
  - each file is uploaded first, straight to `MEDIA_BUCKET` with content type `image/webp` and no overwrite, under the key the media rules build (`mediaKey(productId, randomUUID(), "webp")`, `homeImageKey("category", randomUUID(), "webp")`); then the row is written: for a product a plain insert of exactly `{ productId, kind: "image", storageKey, width: 1200, height: 1500, sort: 0 }` with `alt` and `variantId` null and no `products.version` bump; for a category `image_key` set to the key. If the row write fails, the uploaded object is deleted, the item is reported, and the command exits 1 (items done so far stay; a rerun finishes the rest);
  - uses `getDirectDb()` as `seed-dev.ts` does and closes the client in a `finally`;
  - prints how many products and categories it filled.
  - The pure parts (the two host guards, `pickSample`, and the SVG builder) live in `src/features/catalog/media-samples.ts` so Vitest finds their tests (it only includes `src/**/*.test.ts`); `scripts/media-samples.ts` is a thin runner that imports them.
- **AC-15**: Tests. Unit: the contrast test reads the rewritten table and reads `--skf-brand` in its forbidden check; the Tailwind lock test moves `bg-yellow` to the list that produces nothing and lists `bg-brand` as working; the design rule test's token example uses `brand`; `src/features/catalog/media-samples.test.ts` covers the host guards (local database and Supabase hosts pass, any other host on either one stops) and `pickSample` (same id gives the same drawing and tone; over 200 generated uuids all five drawings and all four tones appear). Playwright: the focus outline checks in `e2e/design-system.spec.ts` and `e2e/shell.spec.ts` call `expectFocusOutline(…, "brand")` on black; in `e2e/hero-coverflow.spec.ts` the black surface assertions are **replaced** by checks that the hero's background is the white token and line 2 sits on the brand fill at 390, 820, and 1280, and that the fallback card is white; every other existing flow passes unchanged.

## Decision

**Chosen option**: Option 2: Rename the token to `brand` and move the hero to white.

The brand colour is one token named for its role (`brand`, #F7931E with tint #FEEFDC), applied everywhere including the logo; the Home hero and its fallback sit on white with the orange only as fills under ink.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no change. The sample command writes rows and keys that already exist: `product_media` rows and `categories.image_key`, through the existing media rules. No migration.

**API surface**: no new endpoint or action. One new dev command:

| Command | Inputs | Outputs | Auth | Errors |
|---|---|---|---|---|
| `pnpm media:samples` | the local `.env` Supabase URL and service role key (the ones `storageEnv()` and the database client already read) | uploaded WebP files, new `product_media` rows, filled `categories.image_key`, a count line | service role, local only | non local host: stop, exit 1; upload or insert failure: stop, report the item, exit 1 (items done so far stay, a rerun finishes the rest) |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Every page | brand colour, brand tint | `--skf-brand`, `--skf-brand-tint` in `tokens.css` (AC-1) |
| Logo, link previews | orange logo | `public/brand/skf-logo.svg`, and the PNGs made from it (AC-3) |
| Hero | surface, border, text colours | `white`, `border`, `ink`, `muted`, `control-border` tokens (AC-5 to AC-9) |
| Hero | side card tint opacity | spec 0030 geometry table, unchanged (AC-7) |
| `media:samples` | which items get a picture | products with no `product_media` row of kind `image`; main categories (`parent_id` null) with a null or empty `image_key` |
| `media:samples` | the drawing and tone | `pickSample(id)`: sha256 of the id, byte 0 modulo 5 (drawing), byte 1 modulo 4 (tone) |
| `media:samples` | colours inside the picture | `--skf-product-bg-1..4` and `--skf-brand`, read from `tokens.css` at run time |
| `media:samples` | size and format | product 1200×1500, category 800×800, WebP quality 80 |
| `media:samples` | storage key | `mediaKey(productId, randomUUID(), "webp")`; `homeImageKey("category", randomUUID(), "webp")` (the key rules accept `webp`) |
| `media:samples` | bucket and upload | `MEDIA_BUCKET`, content type `image/webp`, no overwrite, uploaded directly with the service role |
| `media:samples` | product row | `{ productId, kind: "image", storageKey, width: 1200, height: 1500, sort: 0 }`, `alt` and `variantId` null, no version bump |
| `media:samples` | category value | `categories.image_key` set to the key |
| `media:samples` | "is this local" | `isLocalDatabaseUrl` on the database URL and the host of the Supabase URL, both from the env loaded like `media-sweep.ts` |

**Key invariants**:
- No colour literal outside `tokens.css` (spec 0003 AC-2 stands); no `yellow` name anywhere in `src/` or `e2e/`.
- Brand orange is never text on white or the page colour.
- The hero geometry, motion, keyboard, and tests of spec 0030 are unchanged; only colours and the surface change.
- `media:samples` never runs against a non local host and never replaces an existing picture.

**Security model**: no change for the site. `media:samples` uses the service role key from the local `.env`, as the other scripts do, and its host guard is the protection against pointing it at production.

**Configuration required**: none new.

**Critical test scenarios**:
- Brand everywhere: no `yellow` name or value left; the contrast ratios hold; the focus outline on black is orange, verifies **AC-1**, **AC-2**, **AC-15**
- Light hero at 390, 820, 1280: white surface, phone card with border, desktop band edge to edge, marker under ink, white tint on the side cards, dots and arrows on white, axe clean, verifies **AC-5** to **AC-10**, **AC-13**
- Fallback card with no products is light with a readable chandelier, verifies **AC-11**, **AC-13**
- `media:samples` on a local database fills every product and category without a picture, a second run adds nothing, and a non local URL stops it, verifies **AC-14**

## Build plan

Tracer Bullet: the rename first, because every later task and test sits on the new names.

1. **The brand token, end to end.** Rename the tokens and colour names in `tokens.css` and rewrite its contrast table; every class use in `src/` (storefront, dashboard, gallery); `colourNames` in `utils.ts`; the gallery colours section and its `ar.json` keys and copy; the `.on-dark` focus rule; the shadcn role mapping; the hero chandelier's yellow classes; the stale comments; update the contrast, Tailwind lock, and design rule unit tests, `e2e/a11y.ts` and the two Playwright focus outline checks, and the test colour in `homepage.spec.ts`; update `docs/design/` and the amendment notes on specs 0003 and 0030. Satisfies **AC-1**, **AC-2**, **AC-4**, **AC-15**
2. **Logo and brand pictures.** Recolour the 11 fills in `skf-logo.svg`; rerun `scripts/make-share-images.mjs` to make `logo.png` and `share.png` again; fix its comments. Satisfies **AC-3**
3. **Light hero.** `hero-coverflow.tsx` surface, words and marker, white tint, centre card text, dots, arrows, Shop button; `hero-card.tsx` and the chandelier on white; `loading.tsx` light shape; extend `e2e/hero-coverflow.spec.ts` with the background and marker checks at three widths and the fallback card. Satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**, **AC-15**
4. **Sample pictures command.** `src/features/catalog/media-samples.ts` (host guards, `pickSample`, the SVG builder for the five drawings) with its tests; `scripts/media-samples.ts` as the runner (env loader, `sharp` to WebP, upload then row, cleanup on failure); `"media:samples": "tsx --conditions=react-server scripts/media-samples.ts"` in `package.json`; run it on the local database. Satisfies **AC-14**, **AC-15**
5. **Finish.** Run the whole Vitest and Playwright suites; axe on `/` with both heroes at three widths; screenshots of Home at 390, 820, and 1280 compared with the mockup. Satisfies **AC-13**, **AC-15**

## Consequences

**Positive**:
- The first screen is light, and black is left to the header, the footer, and the product photos.
- Changing the brand colour again is one value in `tokens.css` plus the logo file.
- Local Home, category, and product pages look finished before the real photos exist.

**Negative / tradeoffs**:
- The rename touches most UI files in one change (about 65 class uses plus tests and docs), so it conflicts with any open branch that touches the same lines.
- Orange text on white is still impossible, so every light surface accent must be a fill (the marker), which limits some future designs.
- WhatsApp and Facebook cache link previews, so old shared links may show the yellow `share.png` for some days after release.
- The logo is recoloured by hand; the owner's original logo files (open item O-4) may still differ and would replace it.

**Neutral**:
- No migration, no new dependency (`sharp` is already installed), no new environment variable.
- The category cards and product photo tiles stay dark by design; with photos they glow on white.

## Migration plan

**Strategy**: no migration needed. One deploy carries the rename, the logo, and the hero.
**Rollback**: revert the commit; no data changed. The sample pictures exist only in local databases.

## Follow-up

- [ ] Owner: confirm the orange logo looks right in the header, footer, and a shared WhatsApp link, and send the original logo files when you have them (O-4).
- [ ] After release, check a fresh WhatsApp share of the home page shows the orange preview.
