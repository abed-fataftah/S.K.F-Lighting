# 0030. Hero product coverflow: rationale

The reasoning behind [index.md](index.md). `/develop` does not need this file.

## Context

Home's hero today is either the owner's banner carousel or, with no banner on, a black card with a drawn chandelier and the headline (spec 0011). On a desktop the banners sit in a two thirds row with a black side card repeating the headline and buttons (spec 0029). The owner's featured products show further down as a grid of product cards, the same card as a category page. The scope decided on 2026-11-18 that the hero should instead be a 3D coverflow of those featured products at every width, with the headline above and the banners under it (feature 37).

The forces: the shop sells chandeliers and lamps, which photograph well, and the owner picks up to 8 products in the dashboard; those picks deserve the top of the page. Most traffic is phones, where the hero must stay inside a 390 wide column and work with a finger. The design rules allow no shadows, gradients, or blur, so depth has to come from size, angle, and tint. Two carousels already exist on Home (banners, circles) with their own accessibility rules, and a third moving block must not fight them. Several e2e flows open "the first link in `home-products`" to reach a product page, so the hero must keep that entry.

Not deciding leaves the hero as a poster: the banners need the owner to design pictures, and the drawn card shows no product at all.

## Options considered

### Option 1: Hand rolled coverflow on CSS 3D transforms, following the circle carousel

Each card is placed by a transform (translate, rotateY, scale) and an opacity computed from its signed distance to the centre, with pointer swipe, keyboard, and the Web Animations API for the crossing fade, exactly as `category-circles.tsx` does it today.

**Pros**:
- No new dependency; the step, crossing, swipe, and reduced motion rules already exist and are unit tested.
- Full control of RTL, tokens, and the design rule test.
- The server renders the cards in place, so nothing shifts on load.

**Cons**:
- The 3D geometry is the project's own code to tune and maintain (angles, offsets, the hidden band).
- No library handles inertia or rubber banding; a swipe is one step per gesture.

### Option 2: Embla Carousel

A small headless carousel engine with right to left support and a documented tween pattern for scale and opacity.

**Pros**:
- Proven touch physics (drag, momentum, snapping).
- Headless, so it styles with the project's tokens.

**Cons**:
- Has no 3D coverflow mode; the angle and depth layer is still custom code on top of its scroll position.
- Another dependency for one component, and its loop mode clones slides, which breaks the "every product renders once" rule the existing carousels follow.

### Option 3: Swiper with its coverflow effect

A full carousel library with a built in coverflow effect and right to left support.

**Pros**:
- Coverflow, loop, keyboard, and touch out of the box.

**Cons**:
- Heavy: ships its own stylesheet, and its coverflow draws shadows by default, which the design rule test forbids, so it needs overriding.
- Clones slides for the loop and manages its own DOM, which fights React and the accessibility pattern (inert slides, one link in the list) used on Home.

### Option 4: Keep the hero and add a plain product strip

Leave the banner or card hero as is and show the featured products as a horizontal scrolling strip above the circles.

**Pros**:
- Smallest change, no 3D.

**Cons**:
- Not what the scope decided; the picked products stay below the hero and the banners still need designed pictures.

## Rationale

Option 1 wins on the forces that matter here. The project already carries a hand built, accessible, RTL safe carousel with the same rules (signed steps from the centre, a fade for a card that crosses sides, a swipe threshold, reduced motion, no copies for the loop), so a second one built the same way is the boring choice. A library would add a dependency to replace code that exists, and both libraries considered need custom code for the 3D part anyway, which is the only hard part. Keeping the list server rendered with the centre card at index 0 also protects the e2e flows that open the first link in `home-products`.

The engineer's choices shaped the rest: the coverflow carries the featured list with its newest fallback, so Home always has products in the hero and the old card is only a last resort; the grid goes, because the same products twice on one page is noise; the hero stays black, because product photos on white backgrounds need a dark surface to stand out and the yellow headline line keeps its contrast; it never moves by itself, because the circles already do and a hero that slides under a finger about to tap is a known annoyance; only the centre card is a link, so the tab order stays short and the swipe never fights a link.

## Decisions settled while writing

- **Geometry numbers** (220, 260, 300 wide; 0.74 and 0.56 scale; 35° and 45°; 0.75 and 0.5 opacity; 0.3 and 0.5 tint): chosen so a 390 wide phone shows about a quarter of each neighbour and a 1280 desktop fills the content box with five cards. The runner up was one fixed card size at every width, which leaves a desktop hero looking empty. The build may tune by up to 10%.
- **Arrows from `lg` only**: the scope asked for arrows on desktop and swiping on phones; dots and the keyboard cover a tablet with a mouse. The runner up was arrows from `md`.
- **Keyboard by physical side**: the left key brings the card on the left in, the right key the card on the right, the same in RTL, because a coverflow is a picture, not a list; the runner up (left = previous in reading order) feels backwards on a right to left page.
- **Two products**: the circle carousel's rule (the other card on the inline end side, every move swaps) is reused as is; the runner up was a non looping pair with a disabled arrow.
- **Images**: the centre card is the largest picture above the fold, so it gets `priority`; the others lazy load. `sizes` matches the three centre widths.
- **Name clamp**: two lines, because an 8 word Arabic product name would push the dots and buttons down on a phone.
- **Headline alignment**: start aligned below `lg` (the phone design), centred from `lg` (a symmetric hero around a centred coverflow). The runner up was start aligned everywhere, which looks unbalanced beside a centred coverflow.
- **`shopNowTarget`**: with the featured section gone the yellow button goes to the circles or is hidden; the runner up was to keep a jump to the hero itself, which is pointless from inside the hero.

## Cross check (2026-11-18, a different model, read only)

The draft was cross checked and twenty findings were applied: the hero must render outside the page frame for the band to reach the screen edges; the slide role goes on an inner element so the list keeps its semantics; focus follows the centre link after a step; the angle sign was inverted; card widths become tokens because bracketed pixel classes fail the design rule test; both widths' placements sit on each card so the server markup is right on a desktop; tap and swipe are told apart with a click guard; the e2e list named three flows as passing unchanged that in fact check the old hidden `h1`, side card, hero width, and grid columns, and the first order flow finds a product by name, which the named dots now allow. Smaller calls (the next card out, z index, dot direction, reserved lines, colours on black, arrow placement, overlay motion, message keys, shared hooks, banner sizes, skeleton sizes, 1024 clipping, modifier keys) were settled as recommended. The direction was judged sound with no simpler option that gives 3D at every width without cloned slides.
