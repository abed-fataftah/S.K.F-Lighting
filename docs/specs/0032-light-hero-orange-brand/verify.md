# Verify: Light hero & orange brand · spec 0032 · updated 2026-11-19
_Steps derived from spec 0032 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Open `/` at 390px → the hero is a white card with a 1px border and side margins; line 1 is ink, line 2 "وكهربائيات" is ink on an orange marker; the subline is grey → AC-5, AC-6
- [x] Open `/` at 820 and 1280px → the hero is a white band from edge to edge with a bottom border, no side edges or radius; at 1920 there is no sideways scroll → AC-5, AC-13
- [x] Look at the coverflow side cards → they fade toward white, not black; the out of stock label is still the black chip → AC-7
- [x] Centre card name and price are ink; an out of stock price is grey → AC-8
- [x] At 1280px, the arrows are white circles with a grey edge and ink chevrons, and turn page grey on hover; the centred dot is orange with an ink edge, the others have a grey edge → AC-9
- [x] Tab into the hero → the focus outline is ink (not orange) → AC-9
- [x] "تسوّق الآن" is orange with ink text, "اطلب عبر واتساب" is green; both 52px high → AC-10
- [x] Hide every product locally and open `/` → the fallback card is white with the marker, and the chandelier's chain, sleeves, and crystals all show on white → AC-11
- [x] With every product still hidden, open `/` at 820 and 1280px → the fallback is a white band with line 2 on the orange marker, and axe is clean → AC-11, AC-13
- [x] Throttle the network and open `/` → the loading hero is white with grey skeleton blocks in the same shape → AC-12
- [x] Look at the header, footer, bottom bar, cart badge, category cards, dashboard sidebar, and buttons → every former yellow is orange; tab through the black header → the focus outline is orange → AC-2
- [x] Open `/design-system` → 19 contrast pairs, including control border on brand tint at 3.07:1, with the Arabic copy saying "برتقالية" → AC-1, AC-2
- [x] Open `public/brand/share.png` and `logo.png`, and the header logo → bolt and "lighting" are orange → AC-3
- [x] Read `docs/design/design.md` → the colour table and rules name `--skf-brand` #F7931E; specs 0003 and 0030 carry an "Amended" line pointing to 0032 → AC-4

## Commands
- [x] `grep -rni "yellow\|fcf42c" src e2e scripts` → only the Tailwind lock entry that proves `bg-yellow` produces nothing, and the palette blocklist in `design-rules.test.ts` → AC-1
- [x] `pnpm vitest run src/app src/design-rules.test.ts src/features/catalog/media-samples.test.ts` → all pass (contrast table of 19 pairs, Tailwind lock, design rules, sample guards and pick) → AC-2, AC-15
- [x] `pnpm exec playwright test e2e/hero-coverflow.spec.ts --workers=1` → the white background and marker checks pass at phone, tablet, and desktop, axe clean → AC-5, AC-6, AC-13, AC-15
- [x] `pnpm exec playwright test e2e/shell.spec.ts e2e/design-system.spec.ts --workers=1` → the orange focus outline on black passes → AC-2, AC-15
- [x] With `NEXT_PUBLIC_SUPABASE_URL=https://abcd.supabase.co`, run `pnpm media:samples` → refuses with exit 1; same with a non local `DATABASE_URL_DIRECT` → AC-14
- [x] On a fresh local database run `pnpm media:samples` → it fills every product with no image and every main category with no picture, and prints the counts; run it again → "0 products and 0 main categories" → AC-14
- [x] Check one product row it wrote → `kind = image`, 1200×1500, `sort = 0`, `alt` and `variant_id` null, `products.version` unchanged; the stored file is a WebP of 1200×1500 (categories 800×800) → AC-14
- [x] Reseed and run it again on a fresh database → the same product id gets the same drawing and tone → AC-14

## Value sourcing
- [x] Change `--skf-brand` in `tokens.css` to another value locally → buttons, focus outline, marker, and sample glow all follow it; revert → value sourcing: brand colour
- [x] Give one product a real image and one main category an `image_key`, then run `pnpm media:samples` → neither is touched → value sourcing: which items get a picture
- [x] Give a sub category a null `image_key` → it gets no sample picture → value sourcing: main categories only

## Acceptance-criteria coverage
- AC-1 covered by the grep command and the gallery step · AC-2 by the every surface step and the focus outline flows · AC-3 by the logo step · AC-4 by the design docs step · AC-5, AC-6 by the 390 and 820/1280 steps and the hero flow · AC-7 by the side card step · AC-8 by the centre card step · AC-9 by the arrows, dots, and focus steps · AC-10 by the buttons step · AC-11 by the fallback step · AC-12 by the loading step · AC-13 by the hero flow and the 1920 step · AC-14 by the `media:samples` commands · AC-15 by the Vitest and Playwright commands
