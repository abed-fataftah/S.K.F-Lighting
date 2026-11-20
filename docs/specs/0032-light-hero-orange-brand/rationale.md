# 0032. Light hero and orange brand colour: rationale

## Context

Spec 0030 put the Home hero on a black band across the whole screen from tablet width, right under the black header. Running the app showed the first screen as nearly all black down to the category cards, and with dark placeholder tiles in the coverflow the hero read as a black block. The owner compared six options in a mockup of the whole Home page (https://claude.ai/artifact/HpWkgDiSSHDSufns77V5gq) and chose "B · Light".

In the same review the owner asked for the brand yellow to become orange across the whole site. The yellow lives in one token in `tokens.css`, but its name, `yellow`, is spread over about 65 class uses, the `.on-dark` focus outline, the logo SVG (11 fills), two PNGs used for search and link previews, the design docs, and several tests. The design rule test forbids Tailwind's own palette names (including `orange`) in classes, and the contrast test forbids yellow text on light surfaces.

The local database has a few demo products and no pictures, so every image on Home is a dark placeholder. That makes any design hard to judge, while the owner's real photos come later.

## Options considered

### Option 1: Keep the `yellow` names, change only the value

Set `--skf-yellow` to orange and leave every class name.

**Pros**: the smallest change; no merge conflicts.
**Cons**: the code says yellow and shows orange, which misleads every later reader and every later skill; tests and docs would describe a colour that no longer exists.

### Option 2: Rename to `brand` and move the hero to white (chosen)

Rename the token and classes to `brand` and `brand-tint`, recolour the logo, and put the hero and its fallback on white with orange only as fills.

**Pros**: names match what they show and survive a future colour change; passes the design rule test; one consistent light hero with or without products.
**Cons**: a wide, mechanical change in one commit; the marker is the only way to accent a word on white.

### Option 3: Rename to `orange`

**Pros**: plain and obvious today.
**Cons**: wrong again if the colour ever changes, and it reads like Tailwind's own `orange` palette, which the design rule test bans in its numbered form (`orange-500`), so the two are easy to confuse.

## Rationale

The owner made both visual calls from the mockup; the open question was how to carry them into the code. Option 2 is the only one that leaves the code honest (Option 1 does not) and survives the next colour change (Option 3 does not).

The tint moved from the mockup's #fdebd3 to #feefdc after a cross check found input edges would sit at 2.98:1 on it, just under the 3:1 rule; the two look the same. The rename is wide but mechanical and guarded by the Tailwind lock test, so a missed use fails loudly instead of silently dropping a colour.

Orange (#F7931E) has the same problem yellow had: about 2.3:1 on white, too faint for text. Keeping the rule "a fill under ink, or text on black" and using a marker behind line 2 keeps the accent without breaking contrast. The fallback card goes light with the coverflow so Home looks the same whether or not products exist. Its chandelier's pale crystals would vanish on white, so they take the brand fill.

The sample pictures are generated locally from bundled drawings instead of downloaded stock photos: no licences, no network step, the same look on every machine, and the host guard keeps it off the live shop. Writing through the existing media rules means every page shows them with no special case.
