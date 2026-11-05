# Review, feat/categories-browsing, 2026-10-22

**Reviewed by**: Sonnet 5.5 (author on a different model)
**Scope**: 14 files, uncommitted
**Verdict**: Approve with nits

## Summary
The change finishes spec 0005 on the admin screens. Phones now come from the stored E.164 value through formatPhone, the admin "from" price is wrapped in the ltr tag, and the product editor waits for hydration before it takes input. The "add another" link now stays in the app. I found no blockers or majors. I checked the other users of the changed "from" message (only the admin products page and the shop product card, which already uses t.rich) and of the removed `phone` field (none left in admin code). The remaining points are small.

## Minor
### 🟡 Focus is lost after "add another", `src/features/catalog/components/product-editor.tsx:196`
**Problem**: While the refresh runs the whole form is `inert`, so the focused "add another" link loses focus. When the fresh editor mounts, focus lands on the page body, not on the first field.
**Why it matters**: Keyboard and screen reader users must tab from the top again after every add. The spec asks for keyboard use on every screen.
**Suggested fix**: When the new editor mounts after an add another, move focus to the product name field (or the page heading).

### 🟡 Editor is dead without scripts or on a failed hydration, `src/features/catalog/components/product-editor.tsx:239`
**Problem**: The server HTML renders every field disabled until the client reports ready. If the script bundle fails to load, the page stays disabled with `aria-busy` forever and no message.
**Why it matters**: The owner sees a frozen form with no hint. It is an admin only screen, so the impact is low.
**Suggested fix**: Accept it as a tradeoff, or add a short note in the page that shows only while not ready for a long time. At minimum, note the tradeoff in the spec.

### 🟡 Orders no longer show the number as the customer typed it, `src/features/orders/server/admin-queries.ts:47`
**Problem**: `customerPhone` (typed) is still stored but the dashboard now shows only E.164 formatted. A number that is not a stored mobile (not +970 or +972 starting with 5) is shown raw as `+97...`.
**Why it matters**: A landline or other order would read as a raw plus number, which is still correct but looks different from the mobile rows.
**Suggested fix**: Fine for spec 0005 AC-8. Confirm checkout only accepts mobiles, so the raw fallback can never show.

## Nits
- ⚪ `src/features/catalog/components/product-editor.tsx:242`, the Cancel and Delete buttons set `disabled={!ready}` inside a fieldset that is already disabled. The prop is redundant.
- ⚪ `e2e/admin-setup.ts:84`, the old `e2e-admin@skf.test` user from earlier runs is never removed. Harmless on a local database.
- ⚪ `e2e/admin-auth.ts:37`, `TEST_PARALLEL_INDEX % E2E_ADMIN_COUNT` is safe now, but a short comment that the count equals the worker count would help the next reader.
- ⚪ `src/features/catalog/components/product-editor.tsx:196`, ctrl or cmd click on "add another" skips onNavigate, which is correct, but is not mentioned in the comment.

## Strengths
- The ready gate is a clean useSyncExternalStore use, with a clear comment on why typed text would otherwise be lost, and a slow network e2e that proves it.
- The one admin per Playwright worker fix addresses the real Supabase session behavior and keeps secrets in the run environment only.
- The new message catalog tests guard both the ltr price rule and the plain text WhatsApp message.
- Phone and money checks are now asserted on the real admin screens, and the db test covers the new `phoneE164` field.

## Test coverage
Good. Vitest covers the catalog rules, the db test covers the E.164 read, and the e2e tests cover the disabled until ready editor, the add another flow on a slow network, and the phone, money and time rendering on the order list and detail pages. The only untested path is focus handling after add another.
