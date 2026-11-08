# Review, feat/electrician-price-adjustments, 2026-11-05

**Reviewed by**: Sonnet 5.5 (author on same family, fresh context)
**Scope**: 13 files, uncommitted
**Verdict**: Changes requested

## Summary
The change makes the account pages (account, orders, reset password, sign in, and the electrician drafts pages) ask Supabase Auth for the user instead of trusting the token claims, so a session ended by a password reset elsewhere is signed out on its next page (AC-8). It adds `getVerifiedAccount`, two focused unit test files, and an e2e flow for the "other browser" case. The page level work is clean and well tested. The gap is that the same revoked session can still write: draft Server Actions still trust the claims.

## Major
### 🟠 Draft Server Actions still trust claims, so a revoked session can still write and send drafts, `src/features/drafts/server/actions.ts:53`
**Problem**: `electricianId()` uses `getAccountProfile()` (claims only). The pages now refuse a revoked session, but the actions behind them (create, edit, delete, send a draft) do not. `requireElectricianPage` says the session "no longer reads the drafts", yet it can still change and send them. The same holds for `src/features/checkout/server/actions.ts:47` and `src/app/api/quick-order/products/route.ts:9`.
**Why it matters**: The point of AC-8 is to cut off someone who took over the account. Until the token expires (up to an hour) that browser can still call the actions it already has open, and sending a draft creates a real order. This also contradicts the spec's own rule that writes use `getVerifiedUser()`.
**Suggested fix**: Have the draft actions (at least the send and any write) resolve the electrician through `getVerifiedAccount()`, and add a unit test beside it. Decide for checkout and the quick order search route, and record the choice in the spec.

## Minor
### 🟡 Spec text left stale, `docs/specs/0017-customer-accounts/index.md` (New password page row of the table)
**Problem**: The row still says the page compares against `getClaims().sub`; the page now uses `getVerifiedUser().id`. The "Change password" row also still reads the owner role from `getAccountProfile()` which is fine, but the neighbours changed.
**Why it matters**: The spec is the source of truth for later work.
**Suggested fix**: Update that row.

### 🟡 Auth outage reads as signed out, `src/server/auth/session.ts:15` (used by the changed pages)
**Problem**: `getVerifiedUser` returns null on any error, including a network failure to Supabase Auth. Pages now redirect to sign in during an outage, where before the local claims check kept working. The sign in page then shows the form to someone who is really signed in.
**Why it matters**: A brief outage looks like a forced logout. Acceptable trade, but not noted anywhere.
**Suggested fix**: Accept and note it in the spec consequences, or tell a real "no user" error apart from a transport error and throw to the error card on the latter.

### 🟡 Unrelated config change in this diff, `next.config.ts:12`
**Problem**: `devIndicators: false` is a dev tooling change for e2e taps, not part of customer accounts.
**Why it matters**: It hides Next dev error badges for everyone locally and muddies the commit.
**Suggested fix**: Move it to its own commit with a short reason.

## Nits
- ⚪ `src/features/accounts/server/profile.ts:46`, `getVerifiedAccount` is wrapped in `cache` but `getVerifiedUser` is not, so two callers in one request still make two Auth calls; the cache only helps repeated `getVerifiedAccount` calls.
- ⚪ `src/features/accounts/server/profile.test.ts:1`, the tests mock the database chain shape, so they prove wiring more than behavior; fine here, but a change to the query builder will break them.

## Strengths
- The sign in page was changed to match the other pages, avoiding a redirect loop between a revoked session and the page that sent it, and the reason is written in the comment and the spec.
- The e2e flow proves AC-8 with two real browser contexts, and the earlier expired link test was reordered to remove a race.
- Unit tests cover the null user, missing profile, missing email, and database failure paths, and assert that claims are not read when the verified path is used.

## Test coverage
New logic (`getVerifiedAccount`, the guard switch) has unit tests for each branch, plus one Playwright flow for AC-8. Not covered: the draft actions and checkout still on claims (see the major finding), and the sign in page and orders page redirect behavior is only covered by the e2e flow.
