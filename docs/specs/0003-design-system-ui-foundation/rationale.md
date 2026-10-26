# 0003. Design system and UI foundation: decision record

The build spec is [index.md](index.md). This file keeps the reasoning; `/develop` does not read it.

## Context

The look of the shop is not open: an outside designer produced a complete package (rules, tokens, shared parts, and 27 page files) and the owner reviewed and approved every board on the design canvas. What is open is how that design becomes code that stays faithful to it for 30 features, built by one person, mostly with AI help.

The forces:
- **Drift is the main risk.** Each later feature adds screens. Without a hard boundary, a stray `bg-red-500`, a `ml-2` that breaks right to left, or a shadow sneaks in, and nobody notices until the owner does. The design forbids raw values, shadows, physical directions, and yellow text on white, so those rules need a machine check, not memory.
- **Accessibility is a contract**, not a polish step: WCAG AA, 44px targets, visible focus everywhere (yellow on black), labels, live regions, reduced motion. The designer flagged that only contrast was computed; no keyboard or screen reader pass was run, and the boards were never seen rendered.
- **The stack is fixed** by spec 0001 (Next.js 16 on Workers, Tailwind v4, shadcn/ui, next-intl, Arabic only). shadcn now defaults to Base UI as its behaviour layer, while spec 0001 named Radix; no component is installed yet.
- **The package has gaps** the code must fill without inventing a look: the menu content (O-15), the cart badge (O-26), the logo files (O-4), photos (O-5), the WhatsApp glyph (O-7), and paths and routes that were guesses (O-27).
- **Tracer Bullet** is the project approach: the first real order (feature 6) needs the shell and the basic controls, not every component in the package.

Not deciding means every page invents its own buttons and spacing, and the right to left and accessibility work is redone per page.

## Options considered

### Option 1: shadcn/ui on Base UI, restyled, Tailwind locked to the tokens, gallery page

Install only the shadcn components the design names, on Base UI, restyle their variants to `design.md`, remove Tailwind's default palette, radii, shadows, and type sizes, and prove everything on a hidden gallery page with axe and Playwright.

**Pros**:
- Accessible behaviour (focus trap, keyboard, ARIA) comes from a maintained library; only the look is hand made.
- Locking Tailwind turns most design rules into "the class does not exist".
- Base UI is shadcn's current default, so new shadcn docs, the CLI, and the installed `shadcn` skill match.

**Cons**:
- Every component is restyled by hand, and each future `shadcn add` needs the same pass.
- Base UI has a smaller community than Radix today.

### Option 2: the same, on Radix as spec 0001 wrote

**Pros**:
- No change to spec 0001; the most documented primitive set.

**Cons**:
- shadcn's default and new work have moved to Base UI; the project would start on the side that a later migration leaves.

### Option 3: hand built components, no shadcn

Write every control from scratch to the design, with Tailwind and the tokens.

**Pros**:
- Exactly the markup the boards show, nothing to restyle away.

**Cons**:
- Dialog focus traps, radio groups, toggle groups, and keyboard behaviour are hard to get right; a solo builder would own every accessibility bug.

### Option 4: tokens added beside Tailwind's defaults (no lock)

Option 1 without removing the default palette, radii, shadows, and sizes.

**Pros**:
- Less setup; generated shadcn code works before restyling.

**Cons**:
- Every forbidden value stays one class away and silently works, which is exactly the drift this decision exists to stop.

## Rationale

Option 1 wins because drift and accessibility are the two forces that decide this. Base UI and shadcn carry the behaviour that is hardest to get right (Option 3 would make the solo builder own it), and the Tailwind lock plus the rule test make the approved design the only path rather than the polite one (Option 4 leaves it optional). Base UI over Radix (Option 2) because nothing is installed yet, so the switch is free today and costly later, and the shadcn CLI, docs, and installed skill now assume Base UI.

Scope follows Tracer Bullet: the foundation plus the shared shells is what feature 6 needs to put one real order on a phone screen. ProductCard, Gallery, Timeline, the category carousel, the drop zone, and the KPI card are built by the features that have their data, from these tokens and primitives.

### The smaller calls

Engineer picks (each with its runner up):

| Call | Pick | Why | Runner up |
|---|---|---|---|
| Home of the design files | `docs/design/` for all of it | Keeps the root clean next to `AGENTS.md`; `/sync` adds the pointer | `design.md` at the root as the handoff suggested |
| How much to build | Foundation plus shared shells | What feature 6 needs; the rest arrives with its data | Every component in `design.md` section 6 now |
| Proof | Hidden gallery page, flag gated | One place for axe, Playwright, and the owner's eye, no second toolchain | Storybook |
| Menu button | Simple start side sheet | A working button for keyboard and screen readers, room for categories later | Hide the button until designed |
| Logo | Download the canvas asset | Exact approved artwork today, same path for the originals | Wait for the owner's files |
| No photo | Dark tile with a lamp icon, drop `--illus-*` | Honest, permanent, no throwaway art | Port the canvas drawings |
| Rule enforcement | Vitest scan of `src/` | Runs with the existing tests in pre commit and CI, sees `cn()` calls too | ESLint regex rules |
| WhatsApp glyph | Simple Icons path, inlined | CC0 path data, one file, no package | WhatsApp's own brand asset |
| Tailwind | Locked to tokens | Wrong classes produce nothing | Defaults kept |
| Font | `next/font/google` | Self served from the shop's domain with a matched fallback, as the handoff says | `next/font/local` with committed files |
| Accessibility checks | axe in Playwright | Catches contrast, labels, landmarks, ARIA on every run | Lighthouse by hand |
| URL map | Handoff routes, products at `/p/[slug]` | Spec 0002 already builds a readable Arabic slug; better links in WhatsApp and search | `/p/[code]` |
| Footer contact | `shop_settings`, hide when empty | No bracket placeholder can reach a customer | Copy in `ar.json` |
| Cart badge | Designed now, wired by feature 12 | Header complete and consistent today | Leave to feature 12 |

Calls made in this spec (each with its runner up):

- **NativeSelect over the Base UI Select**: the design allows it, phones show their own picker, and it is the most accessible option. Runner up: Base UI Select for a styled list.
- **shadcn Field for labels and errors**: it already wires `aria-describedby` and `aria-invalid`. Runner up: a local `FormField` wrapper.
- **One unlayered focus rule, component rings removed**: the design wants a solid outline with offset, not a ring shadow; unlayered CSS beats Tailwind utilities, so no component can hide it. Runner up: restyle each component's ring classes.
- **`type-*` utilities, not `--text-*` keys**: `cn()` treats unknown `text-*` classes as colours and drops one. Runner up: `--text-*` keys with a custom `tailwind-merge` config.
- **Tailwind's 4px spacing unit kept**: it maps every step of the scale exactly (14 is `3.5`), and the generated components already use it. Runner up: `--spacing: 1px` so class numbers equal pixels, which breaks every generated class at once.
- **New tokens for the bar height, float offset, sheet width, and layers**: the fixed shell needs them, and adding them to `tokens.css` keeps "no value outside the tokens" true. Runner up: arbitrary values, which the rule test forbids.
- **Active tab and admin link from the path**, as pure functions: no prop threading through every page, unit testable. Runner up: each page passes its tab.
- **حسابي always links to `/account/orders`**: the shell never reads the session, so storefront pages need no auth call for navigation. Runner up: read `getClaims()` in the layout to pick sign in or orders.
- **InfoStrip shown by path** in the layout: the strip sits above the header, which the layout owns. Runner up: a route group with its own layout for `/`.
- **Footer read per request with a 1.5 second timeout** (from the cross check): a hung database connection must not block every storefront page; cross request caching waits for a measured need. Runner up: copy in `ar.json` until feature 26.
- **Gallery in its own route group, outside the shell**: inside the storefront layout it would duplicate landmarks, and the 480 column would make the dashboard frame impossible. Runner up: hide the shell on that path.
- **No toast component installed**: the design says no toasts, so none is offered. Runner up: install and leave unused.
- **Agent Skills for lucide, axe, and Base UI declined**: the installed `shadcn` and `playwright-cli` skills already cover them; recorded so they are not offered again.
