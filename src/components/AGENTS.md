# Components and design system

## Overview

Shared UI built from the approved design in `docs/design/`. `ui/` holds the shadcn primitives (style `base-maia`, on Base UI, RTL on) restyled to `docs/design/design.md` section 6; the files at this level are the project's own controls built on top of them. Every component is shown on the hidden gallery at `/design-system`.

## Key files

| File | Owns |
|---|---|
| `ui/` | shadcn primitives on `@base-ui/react` (Button, Field, Sheet, Tabs, and more) |
| `html-document.tsx` | `<html lang="ar" dir="rtl">` plus Base UI `DirectionProvider` for every layout |
| `ltr.tsx` | `<Ltr>` wrapper so codes, order numbers, and phone numbers read left to right |
| `quantity-stepper.tsx`, `radio-card.tsx`, `chip.tsx` | Custom controls from the design handoff |
| `icons/directional.tsx` | Arrows and chevrons that flip correctly in RTL |
| `../app/tokens.css` | The design tokens; the only colours, sizes, and radii Tailwind knows |
| `../app/(gallery)/design-system/` | Gallery page, a 404 unless `DESIGN_SYSTEM_PAGE=1` |

## Conventions

- Add primitives with the shadcn CLI so they land on Base UI, then restyle them to the design; never pull in Radix.
- Style only with token classes. `src/design-rules.test.ts` fails the build on raw hex colours, physical direction classes, arbitrary pixel values, the stock Tailwind size/colour/weight scales, `dark:` or any dark mode, `ring-` or `outline-none`, shadows, gradients, and blur.
- Focus styling comes from the global rule in `tokens.css`, never per component.
- Wrap any number, code, or phone shown inside Arabic text in `<Ltr>`.
- A new shared component gets a section on the gallery page so the Playwright and axe checks in `e2e/design-system.spec.ts` cover it.
- Build every link from `routes` in `src/lib/routes.ts`, never a hand written path.

## Gotchas

- The design rule scan skips comments, so a comment may name a forbidden class; code may not.
- Storefront strings (any message namespace not starting with `Admin`) must avoid the words listed in `design-rules.test.ts` (for example the word for cheque, since the shop takes no cheques).
- No toast component exists by design; use inline `Alert` or field errors.

## Agent skills

- [shadcn](../../.agents/skills/shadcn/): `shadcn-ui/ui`, adding and styling UI components
- [vercel-composition-patterns](../../.agents/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, component composition

## Related specs

- [0003 Design system and UI foundation](../../docs/specs/0003-design-system-ui-foundation/index.md)
- [Design handoff](../../docs/design/handoff.md), [design.md](../../docs/design/design.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
