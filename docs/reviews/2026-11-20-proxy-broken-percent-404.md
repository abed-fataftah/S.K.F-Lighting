# Review, feat/storefront-desktop-layout, 2026-11-20

**Reviewed by**: Sonnet 5.5 (author on the same family, reviewed read only)
**Scope**: 3 files, commit 9b94fd3
**Verdict**: Approve with nits

## Summary
The proxy now checks storefront paths with `decodeURIComponent` and, when it throws, rewrites to a static `/ar/broken-address` route that re-exports the catch all page, which calls `notFound()`. That gives a real 404 with the designed card and keeps the address in the browser. The logic is correct for every malformed shape you listed. The gaps are small: a few missing test cases and a couple of side effects of the new public route.

## Minor
### 🟡 Broken `%` on `/api`, `/auth`, `/admin` still reaches Next unguarded, `src/proxy.ts:60`
**Problem**: The broken path check sits behind `isOutsideLocaleRouting`, so those prefixes are passed straight through and Next may still answer its bare 400.
**Why it matters**: Probably acceptable, since these are not storefront pages, but the commit message says "any storefront address" and the behavior is not documented or tested.
**Suggested fix**: Add a test or a one line comment saying this is intentional.

### 🟡 `/broken-address` is now a public, directly reachable route, `src/app/[locale]/broken-address/page.tsx:4`
**Problem**: Anyone can open `/broken-address` (and `/ar/broken-address`, which redirects to it) and get a 404 card. It is a real route, not only an internal rewrite target.
**Why it matters**: It still returns 404 so the effect is harmless, but it adds a route that reserves the word and shows in route listings. It also means a catch all address of the same name is no longer "unknown" in code, only in behavior.
**Suggested fix**: Accept it and keep the comment, or note it in AGENTS.md or the spec so nobody later adds a real `/broken-address` page.

### 🟡 No unit test that valid encoded paths still pass through, `src/proxy.test.ts:91`
**Problem**: The new tests only cover broken input. Nothing asserts that a well formed Arabic slug such as `/c/%D8%AB%D8%B1%D9%8A%D8%A7` or an encoded slash `%2F` still goes to the normal locale rewrite.
**Why it matters**: This is the main regression risk of the change, and it is cheap to pin.
**Suggested fix**: Add a case with a valid percent encoded Arabic path, one with `%2F`, and one with a query string (for example `/c/%E0%A4%A?x=1`) to show the rewrite drops it cleanly.

### 🟡 The 404 status is not asserted at the proxy level, `src/proxy.test.ts:97`
**Problem**: The unit test checks only the `x-middleware-rewrite` header. The real status comes from the page calling `notFound()`.
**Why it matters**: If the target page ever stops calling `notFound()` (it is a re export of another file), the status would silently become 200 with no test failing here. The existing e2e specs cover `/checkout/done/%E0%A4%A` (e2e/order-confirmation.spec.ts:200), but not `/c/...` or a top level broken path.
**Suggested fix**: Extend the e2e case with one non order broken address and assert `response.status() === 404`.

## Nits
- ⚪ `src/proxy.ts:62`, nested ternary is harder to read than an early return for the broken case.
- ⚪ `src/proxy.ts:53` and `:62`, order paths and other paths each run `decodeURIComponent` separately; fine, but one helper result could be reused.
- ⚪ `src/proxy.ts:50`, `BROKEN_ADDRESS` is a hard coded string that is not in `routes`, unlike the other paths in this file.

## Strengths
- Detection is right: `decodeURIComponent` throws on `%`, `%zz`, and partial sequences like `%E0%A4%A`, while valid encoded Arabic, Hebrew, and `%2F` decode fine and are passed to next-intl untouched.
- A rewrite (not a redirect) keeps the URL and lets the page return 404, not 200 or 400. Only the path is checked, so query strings cannot trigger it, and the matcher still skips static files.
- The `/orders/` redirect stays first and has its own regression test; the noindex header still applies because the rewrite goes through the same `proxy` wrapper.
- The comments explain why the target must be static, which is the non obvious part.

## Test coverage
Three broken paths, the order redirect, and the existing noindex table are covered. Missing: valid encoded paths, query strings, the `/api` `/auth` `/admin` behavior, and a status check on a non order broken address.
