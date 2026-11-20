# 0029. Storefront desktop layout: rationale

## Context

The design handoff drew the storefront for a 390px phone only and logged desktop and tablet as open item O-1. The interim rule, one centred 480px column at every width, was built into the shell (spec 0003) and repeated in specs 0009, 0010, 0011, 0018, and 0020. The site is now live, and on a laptop it looks like a phone screenshot in the middle of an empty page. The owner reads that as "the site is not responsive".

The forces:
- Most customers come from phones (WhatsApp links), so the phone layout must not move at all.
- The design system (`design.md`, tokens, `design-rules.test.ts`) is strict: tokens only, logical properties, no shadows, 44px targets, WCAG AA. Any wide layout has to live inside those rules.
- No desktop board exists. The owner chose to have the layouts proposed in the spec rather than wait for a designer.
- The shell is shared by 18 storefront routes. Changing its width changes every page at once, ready or not.
- Two deferred items already wait on O-1: the product page desktop layout (spec 0009) and quick order on computers (spec 0020).
- The admin dashboard already has a desktop design and must not be touched.

Leaving it means every desktop visitor sees a narrow strip with a phone tab bar, which looks broken and hides categories behind a menu button.

## Options considered

### Option 1: Wider column with simple stretch rules

Raise `--page-max` to around 1024px, add grid columns, keep every page's phone structure and the phone header.

**Pros**: one token and a few grid classes; little to test.
**Cons**: the phone header, bottom tab bar, and full screen filter dialog look wrong at 1024px; product and checkout pages become long single columns with huge images; it does not solve the problem the owner raised, only moves it.

### Option 2: Responsive layouts per page, rolled out through a page frame (chosen)

Design `md` and `lg` layouts for the shell and every page, built with responsive classes on the same components, and convert pages one group at a time behind a `PageFrame` component.

**Pros**: a real desktop shop; the phone stays byte for byte the same; each slice ships on its own; one DOM keeps behaviour and tests shared.
**Cons**: the most work of the three; three widths to test; layouts written in words, not drawn.

### Option 3: Separate desktop components chosen by device

Render a desktop header, desktop pages, and so on, picked by user agent or a client media query.

**Pros**: each layout can be shaped freely with no responsive class juggling.
**Cons**: two copies of every page to keep in step; user agent sniffing breaks caching and is wrong for resized windows; a client switch causes a flash and hydration mismatches. A known path to drift.

### Option 4: Wait for a designer's desktop boards

Keep the interim column until someone draws O-1.

**Pros**: the layouts would be drawn and reviewed visually first.
**Cons**: no date, the site keeps looking broken on desktop meanwhile, and the owner chose not to wait.

## Rationale

Option 2 is the only one that fixes what the owner sees while keeping the phone, most of the traffic, untouched. Responsive classes on one DOM fit the stack (Tailwind v4, server components, the design rule test) and keep a single set of components, labels, and tests. That avoids the drift Option 3 builds in. Option 1 is cheaper, but it leaves the phone navigation and dialogs on a desktop screen, which is the core complaint.

The `PageFrame` strangler matters because the shell is shared: widening it without a frame would stretch 18 pages that were never laid out for it. With the frame, slice 1 can prove the whole path (tokens, shell, one real page, tablet tests) and every later slice is small and reversible. That matches the project's Tracer Bullet approach.

Smaller calls made in the spec, with the runner up:
- **Breakpoints `md` and `lg` only**, with `sm`/`xl`/`2xl` removed. The runner up was keeping all defaults. Removing them stops ad hoc layouts at untested widths.
- **Header as one DOM with grid areas**. The runner up was two header variants shown by CSS. Two variants would duplicate the search form and its landmark.
- **Category bar overflow measured on the client** with a server rendered clipped row. The runner up was a fixed first N plus a link. Measuring uses the space well whatever the owner names categories, and the fixed height avoids layout shift.
- **Sticky boxes only on tall windows** (`lg-tall`). The runner up was always sticky. A sticky box taller than a short laptop window hides its own button.
- **The order timeline moves visually, other content does not.** The runner up was reordering the source. Moving only content with no focusable elements keeps focus order and reading order honest without a second render.
- **Quick order table built from the card's DOM with subgrid.** The runner up was a real `<table>`. Subgrid keeps one component and keeps the field labels and error links working at both sizes.
- **Add to draft sheet as an opt in `Sheet` variant.** The runner up was changing `Sheet` for all. The admin import uses `Sheet` too and must not change.
- **Tablet test size 820 by 1180**: sits between `md` and `lg`, so it tests the tablet rules, not an edge.
