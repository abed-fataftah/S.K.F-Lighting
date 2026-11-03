# 0019. Customers and roles in the dashboard

**Date**: 2026-11-02
**Status**: In Progress

## Summary

You get a customers section in the dashboard at `/admin/customers`. It lists every registered account (your own admin account is hidden), lets you search by name, phone, or email, and opens a page per customer. That page shows their details, their totals, their full order history, and a short history of what you changed. From there you can switch someone between customer and electrician, fix their name and phone, or remove their account. Removal deletes the login and personal details but keeps the orders as your sales records. The role is already read fresh from the database on every request, so a change takes effect on the user's next page load with no extra work. One new table (`account_events`) records every change.

## Requirements

**User stories**:
- As the owner, I want to see every registered customer and electrician in one place, so I know who shops with me.
- As the owner, I want to find a customer fast by name, phone, or email when they call.
- As the owner, I want one page per customer with their details, totals, and every order, so I can answer any question about them.
- As the owner, I want to switch an account between customer and electrician (and back), so electricians get their tools once I trust them.
- As the owner, I want to fix a customer's name or phone when they call with a change.
- As the owner, I want to remove an account when someone asks me to delete their data, without losing my sales records.
- As an electrician, I want my account page to show I am an electrician, so I know the promotion worked.

**Acceptance criteria** (these build on spec 0014 for the dashboard order pages, spec 0017 for accounts and roles, spec 0018 for the money line and load more, and spec 0002 for account removal):

- **AC-1**: Access. Every dashboard read in this feature (`listAdminCustomers`, `getAdminCustomer`, `readCustomerOrders`, `readAccountEvents`) runs `requireAdminPage()` first, and every Server Action (`searchAdminCustomers`, `changeCustomerRole`, `updateCustomerDetails`, `removeCustomer`, `finishCustomerRemoval`) runs `requireAdmin()` first (role `admin`, `aal2`, session checked with Supabase Auth). A signed out visitor or a non admin gets the sign in redirect on pages and `forbidden` from actions, and nothing is read or written. A profile with role `admin` is never listed, never found by search, and never acted on: `/admin/customers/<its id>` returns `notFound()`, and every action on it returns `not_found`.
- **AC-2**: List. `/admin/customers` shows an h1 "العملاء" and a table of every profile with role `customer` or `electrician`, sorted by `profiles.created_at` newest first, then `profiles.id` descending on a tie. It shows 50 rows per page with numbered paging through `pageWindow(page, 50)` and `splitPage`, exactly like `/admin/orders` (`page` from the URL, read with `parsePage`; a bad value reads as 1). Columns in order: الاسم (a link to `routes.admin.customer(id)`), الهاتف (`profiles.phone` as typed, `dir="ltr"`), الدور (a badge, عميل or كهربائي), الطلبات (the count of the account's orders that are not cancelled, through `formatNumber`). A null name or phone shows "—". A profile with an unfinished removal (AC-12) shows "—" for name and phone and a small badge "حذف غير مكتمل" beside the role. With no accounts at all, an empty card reads "لا يوجد عملاء مسجّلون بعد." The sidebar's existing العملاء link (`routes.admin.customers`) opens this page and is active on any `/admin/customers` path.
- **AC-3**: Search. Above the table, a field "بحث" (placeholder "الاسم أو الهاتف أو البريد") with a "بحث" button submits to the Server Action `searchAdminCustomers({ text })` (`customerSearchSchema`: a string of at most 254 characters), so the search text never goes into a URL. A pure `classifyCustomerSearch(text)` runs `tidyText` and `toWesternDigits`, then decides in this order: text containing `@` is an **email** search (lowercased, matches `auth.users.email` containing it, case insensitive, with `%` and `_` escaped); text that `parseSearchPhone` turns into an E.164 number is a **phone** search (exact match on `profiles.phone_e164`; partial numbers are not supported); text containing no letter (only digits, spaces, `+`, and separators) that is not a full phone is `invalid`, never a name search; text whose `normalizeForSearch` result has 2 or more characters is a **name** search (the folded `full_name` contains the folded text, AC-3 folding in *Feature design*); anything else is `invalid`. `invalid` shows "اكتب اسماً أو بريداً أو رقم هاتف كاملاً." under the field. Email search reads `auth.users` through a left join on `profiles.id` (Supabase stores emails lowercased). `parseSearchPhone` is the phone branch of `classifyOrderSearch` moved into `src/lib/phone.ts` and reused by both searches, so a phone typed in Arabic digits, with or without +970/+972, with or without the leading 0, matches the same way in both. Results replace the table with up to 50 matching rows (same columns, same sort, admins excluded) under a line "نتائج البحث" and a "مسح البحث" link back to the paged list. The query fetches 51 rows; when the 51st exists, only 50 show, with the line "تظهر أول ٥٠ نتيجة، اكتب بحثاً أدق." (through `formatNumber`). No match shows "لا يوجد عميل مطابق." Nothing is logged except the kind of search (AC-15).
- **AC-4**: Customer page. `/admin/customers/[id]` returns `notFound()` when `id` is not a uuid, when no profile has that id, or when the profile's role is `admin`. The header shows the name (h1; "بدون اسم" when null), the role badge, and, when `phone_e164` is set, a green small `whatsapp` button "مراسلة العميل" opening `whatsappUrl(phone_e164, t("contactMessage", { name }))` ("مرحباً {name}، معك S.K.F للإنارة.", with "مرحباً، معك S.K.F للإنارة." when the name is null) with `target="_blank"` and `rel="noopener"`. A "العودة إلى العملاء" link goes to `routes.admin.customers`. A card "بيانات العميل" lists الاسم, الهاتف (`dir="ltr"`), البريد الإلكتروني (`auth.users.email`, `dir="ltr"`), and تاريخ التسجيل (`formatDate(profiles.created_at)`), with "—" for any null.
- **AC-5**: Totals strip. Under the header, three figures: الطلبات, the count of the account's orders that are not cancelled (`formatNumber`); المشتريات, the sum of `total` over the account's delivered orders (`formatPrice`); المتبقي, the sum of `total − amount_paid` over the account's delivered orders where `amount_paid < total` (`formatPrice`). Orders not yet delivered are never counted as owed (payment is at delivery). `total` includes the delivery fee. Money recorded on a cancelled order is ignored by both figures and by the removal block (AC-11); refunds belong to feature 24. The figures cover every order this account placed, which for an electrician includes orders for their end customers. With no orders all three read zero (`formatNumber(0)`, `formatPrice(0)`).
- **AC-6**: Order history. A card "طلبات العميل" lists every order whose `placed_by_user_id` is this profile, every status including cancelled, sorted `placed_at` newest first, then `order_number` descending. Each row shows the order number (a link to `routes.admin.order(number)`, `dir="ltr"`), `formatDate(placed_at)`, the existing `OrderStatusBadge`, `formatPrice(total)`, and the money line from `orderMoneyLine(status, amount_paid, total)` (spec 0018 AC-4: nothing, "المتبقي {amount}", or "مدفوع"). It shows 20 rows per step: `?page=N` read with `parsePage` and capped with `myOrdersLimit`, a line "تم عرض {shown} من {total} طلب" and an outline "عرض المزيد" link to `routes.admin.customerOrdersMore(id, N + 1, shown + 1)` that jumps to row `shown + 1` (`id="o-<position>"`), decided by `myOrdersStep`, exactly as spec 0018 AC-5 (positions count from 1 over the sorted list). The `{total}` here counts every order including cancelled ones, so it can be higher than the totals strip's الطلبات, which leaves cancelled orders out; both are intended. With no orders the card reads "لا توجد طلبات لهذا العميل بعد."
- **AC-7**: Change role. A card "الدور" shows the current role and one button: for a customer "تحويل إلى كهربائي", for an electrician "تحويل إلى عميل". It opens an `AlertDialog` titled "تحويل {name} إلى كهربائي؟" or "تحويل {name} إلى عميل؟" (with "هذا الحساب" when the name is null), the text "تظهر طلباته الجديدة بالنوع الجديد، وتبقى طلباته السابقة كما هي. يسري التغيير عند فتح الصفحة التالية.", and two buttons "تأكيد" and "تراجع". Confirm calls `changeCustomerRole({ profileId, from, to })`. It runs `requireAdmin()` (`forbidden`) first, then parses with `changeRoleSchema` (`profileId` a uuid; `from` and `to` each `customer` or `electrician`; `from ≠ to`; else `invalid`). In one transaction it reads the profile `for update`, then checks in this order: `not_found` when missing or role `admin`; `removal_pending` when the profile has a `removed` event (AC-12); `stale` when its role is not `from`. Otherwise it sets `profiles.role = to` and inserts an `account_events` row (`role_changed`, `from_role`, `to_role`, `actor_user_id` = the admin). On success the page refreshes (`revalidatePath` of the customer page and the list) and a toast reads "تم تحويل الحساب إلى كهربائي." or "تم تحويل الحساب إلى عميل." `stale` shows "تغيّر دور هذا الحساب في مكان آخر. حدّث الصفحة."; every other error shows the generic "تعذّر إتمام العملية. حاول مرة أخرى." The dialog stays open on an error and shows it in an alert above the buttons.
- **AC-8**: When the change takes effect. Nothing caches a role across requests: `getAccountProfile()` (keyed by the token's `sub`), checkout's `readPlacedBy()` (in `src/features/checkout/server/actions.ts`, over `getAccountProfile()`), and `requireAdmin()` (which alone also verifies the session with Supabase Auth) all read `profiles.role` from the database on each request. So after AC-7, the user's next page load shows the new role (AC-9), and their next order gets `placed_by_role` = the new role and `actor_kind` = the new role (spec 0017 AC-13). No code in this feature updates `orders.placed_by_role`, so orders placed before the change keep the role they were placed with, in the order list's type column and filter (spec 0014 AC-11).
- **AC-9**: Electrician badge. On `/account`, when `getAccountProfile().profile.role` is `electrician`, a `Badge` "حساب كهربائي" shows under the h1. Customers and the owner see nothing new. After AC-7 promotes or demotes the account, the next load of `/account` shows or hides the badge.
- **AC-10**: Edit details. On the customer page, an outline "تعديل البيانات" button in the details card opens a `Dialog` titled "تعديل بيانات العميل", with الاسم and الهاتف fields filled from the profile, and "حفظ" and "تراجع" buttons. It validates with the existing `profileSchema` (spec 0017: checkout's name and phone rules, both required, same messages under the fields, focus on the first error). Save calls `updateCustomerDetails({ profileId, name, phone })`. It runs `requireAdmin()` first, then parses (`invalid` with field errors). In one transaction it reads the profile `for update`: `not_found` when missing or role `admin`; `removal_pending` when it has a `removed` event. It then compares: `full_name` changed when the parsed name differs, `phone` changed when the typed phone or `phone_e164` differs. With no change it returns ok and writes nothing. Otherwise it writes through the existing `updateProfileInDb(tx, profileId, input)` (spec 0017, so there is one phone normalizing path) and inserts an `account_events` row (`details_edited`, `fields` = the changed ones out of `full_name` and `phone`, `actor_user_id`). The dialog closes, the page refreshes, and a toast reads "تم حفظ البيانات." Past orders keep the name and phone they were placed with. Both fields are required, so an account with no name can only be saved once you give it one (accepted). The email is shown but not editable (Follow-up).
- **AC-11**: Remove an account. At the bottom of the customer page, a card "حذف الحساب" holds a destructive outline button "حذف الحساب". It opens an `AlertDialog` titled "حذف حساب {name}؟" (or "حذف هذا الحساب؟"), with three lines: "يُحذف تسجيل الدخول والاسم ورقم الهاتف نهائياً.", "تبقى طلباته السابقة في لوحة التحكم دون ربط بحساب.", "لا يمكن التراجع عن هذا.", plus a destructive "حذف نهائي" button and "تراجع". Confirm calls `removeCustomer({ profileId })`. It runs `requireAdmin()` first, then parses (`invalid`). **Step 1**, one transaction: read the profile `for update`; `not_found` when missing or role `admin`; when the profile already has a `removed` event, skip the rest of step 1 (no checks are run again, since orders may have arrived since) and go to step 2; `has_open_orders` when any of its orders has a status other than `delivered` or `cancelled` ("لا يمكن الحذف: لدى العميل طلبات لم تُسلَّم أو تُلغَ بعد."); `has_balance` when any delivered order has `amount_paid < total` ("لا يمكن الحذف: على العميل مبلغ متبقٍ."). Otherwise set `full_name`, `phone`, `phone_e164` to null and insert an `account_events` row (`removed`, `actor_user_id`). After step 1 the shop's own tables hold nothing personal, but `auth.users` still holds the email and the sign up metadata (name and phone) until step 2 deletes the row. **Step 2**, after commit: `deleteAuthUser(profileId)` calls Supabase `auth.admin.deleteUser(profileId)` with the service role key. A "user not found" answer counts as done. On success, Postgres cascades the delete to `profiles`, existing FKs set `orders.placed_by_user_id` (and `order_events.actor_user_id`, `account_events.actor_user_id` where it pointed here) to null, the action redirects to `routes.admin.customersWith({ notice: "removed" })`, and the list shows a notice "تم حذف الحساب." Any other failure of step 2 returns `removal_unfinished` ("حُذف الاسم والهاتف لكن لم يكتمل حذف تسجيل الدخول. حاول مرة أخرى.") and the page shows AC-12. On success and on failure the action calls `revalidatePath` for the list and the customer page.
- **AC-12**: Unfinished removal. A profile that still exists and has a `removed` event is "removal pending". Its customer page shows a warning alert at the top, "لم يكتمل حذف هذا الحساب. تسجيل الدخول والبريد ما زالا موجودين.", with a button "إكمال الحذف" calling `finishCustomerRemoval({ profileId })`. That runs `requireAdmin()`; when the profile no longer exists it redirects to `routes.admin.customersWith({ notice: "removed" })` as a success (a double click, or another tab finished it); when it exists but is `admin` or has no `removed` event it returns `not_found`; otherwise it runs AC-11 step 2 only, with the same success and failure results. While pending, the role, edit, and remove cards are hidden, and the list shows the AC-2 marker. Running it twice is safe.

  While pending, the person can still sign in, so a pending account counts as removed on the storefront too. A pure `isRemovalPending` read (`exists` a `removed` event for the profile) is added to `getAccountProfile()`'s profile result as `removalPending`. `updateProfile` refuses with `account_removed` ("هذا الحساب قيد الحذف.") and writes nothing. Checkout's `readPlacedBy()` returns null, so the order is a guest order (logged as `order_profile_removed`). `/account` shows only that message and the sign out button. No new order can be linked to the account, and no personal data can be written back.
- **AC-13**: Account history. A card "سجل الحساب" lists the profile's `account_events`, newest first (`created_at desc, id desc`), each with `formatDateTime(created_at)`: `role_changed` reads "تحويل من {from} إلى {to}" (role words as in AC-2); `details_edited` reads "تعديل {fields}", with the changed fields as "الاسم", "الهاتف", or "الاسم والهاتف"; `removed` reads "بدء حذف الحساب". With no events the card reads "لا توجد تغييرات بعد." Event rows hold no name, phone, or email, so nothing personal outlives a removal. Once a removal finishes, the profile and its page are gone, so the rows stay only as a database audit record; no screen shows them.
- **AC-14**: From an order to its customer. On `/admin/orders/[number]`, the customer card gains an outline small link "عرض العميل" to `routes.admin.customer(placedByUserId)`. It shows only when `orders.placed_by_user_id` is set and that profile's current role is not `admin`. Guest orders, unlinked orders (after a removal), and the owner's own storefront orders show no link. A removal pending account still shows the link; its page shows the AC-12 alert.
- **AC-15**: Logs. Each action logs one structured line with an event name and outcome codes only: `admin_customer_search` (`kind`), `admin_customer_role_changed` (`to`), `admin_customer_details_edited` (`fields`), `admin_customer_removed`, `admin_customer_removal_failed` (`code`, the Supabase error code or `unknown`), and for every refusal `admin_customer_refused` (`action`, one of `search`, `role`, `details`, `remove`, `finish`; `code`, the result's error code). The storefront guard logs `account_removed` on a refused profile save. No name, phone, email, or address is ever logged (project rule).
- **AC-16**: Loading and failure. `loading.tsx` beside the list and the customer page shows skeletons with `role="status"` and a visually hidden "جارٍ التحميل...". A database failure on a page throws, the same as `/admin/orders`. An action that hits a database error returns `failed` with the generic message, and nothing is half written (each step is one transaction).
- **AC-17**: Database. One additive migration from `pnpm db:generate` adds the enum `account_event_type` (`role_changed`, `details_edited`, `removed`) and the table `account_events` (*Feature design*), with RLS enabled and no grants to `anon` or `authenticated`. `pnpm db:check-rls` passes. The checks reject a `role_changed` row without both roles, any other type with a role, a `details_edited` row with no fields or a field outside `full_name` and `phone`, and any other type with fields.
- **AC-18**: Tests. Vitest beside the source for `classifyCustomerSearch`, `parseSearchPhone` (with `classifyOrderSearch` still passing), `changeRoleSchema`, `changedFields`, `removalBlock`, `customerTotals`, the history line words, and the new routes. Database tests for `listAdminCustomers` (admins excluded, sort with a tie, order count without cancelled, the pending marker), the three search kinds (email case, phone in Arabic digits, a name with hamza and ta marbuta folding), `readCustomerTotals`, `changeCustomerRoleInDb` (each refusal, `stale`, the event row), `updateCustomerDetailsInDb` (no change writes nothing, one field, both), the removal step 1 (open order, balance, success clears the fields and writes one event, a second run skips the checks and writes no second event), the pending guard (`updateProfile` refuses with `account_removed`, `readPlacedBy` returns null), and the migration checks. Playwright on a phone sized RTL screen (390) and a computer sized one (1280), signed in as admin with `aal2`: register an account and place an order, find it by phone in Arabic digits and by email, open it, see details, totals, and the order; promote to electrician, sign in as that user in a second context and see the `/account` badge and their next order typed كهربائي in the order list while the first stays عميل; demote back; edit the phone and see the history line; try to remove with the open order and see `has_open_orders`; deliver the order and record full payment in the database, remove, land on the list with the notice, and see the order page with no "عرض العميل" link; a non admin on `/admin/customers` lands on sign in. Removal step 2 failing is covered with a test double for `deleteAuthUser` in the action test, not Playwright. axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) finds nothing on the list, the customer page, and each dialog; every control is at least 44 by 44; no sideways scroll at 390.

## Decision

**Chosen option**: Option 1: server rendered dashboard pages over Drizzle, guarded Server Actions with row locks, an append only `account_events` table, and the Supabase Auth admin API for the final login delete.

The list and the customer page are Server Components reading through `getDb()`. Role changes, detail edits, and removal are Server Actions that lock the profile row, check, write, and record an event in one transaction. Removal then deletes the login through `auth.admin.deleteUser`, with a retry path when that call fails.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) · `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`, the Auth admin API and service role use) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`, the new table, enum, checks, and RLS) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: one new enum and one new table; the rest is read or written as built.

New enum `account_event_type`: `role_changed`, `details_edited`, `removed` (in `src/server/db/schema/enums.ts`).

New table `account_events` (in a new `src/server/db/schema/accounts.ts`, exported from the schema index), append only:

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` (the shared `id()` helper) |
| `profile_id` | uuid | not null, **no FK** (the row outlives the profile after removal) |
| `type` | `account_event_type` | not null |
| `actor_user_id` | uuid | nullable, FK `profiles(id)` on delete set null, indexed (`account_events_actor_user_id_idx`) |
| `from_role` | `user_role` | nullable |
| `to_role` | `user_role` | nullable |
| `fields` | text[] | nullable |
| `created_at` | timestamptz | not null, default `now()` |

Index `account_events_profile_id_created_at_idx` on `(profile_id, created_at)`. Checks: `account_events_roles_check` `(type = 'role_changed') = (from_role is not null and to_role is not null)` and `(type = 'role_changed' or (from_role is null and to_role is null))`; `account_events_fields_check` `(type = 'details_edited') = (fields is not null)` and `(fields is null or (cardinality(fields) between 1 and 2 and fields <@ array['full_name','phone']))`. RLS enabled (`.enableRLS()`), no grants to `anon` or `authenticated`. No code ever updates or deletes a row.

Existing tables:

| Table | Read | Written |
|---|---|---|
| `profiles` | `id`, `full_name`, `phone`, `phone_e164`, `role`, `created_at` | `role` (AC-7, only between `customer` and `electrician`); `full_name`, `phone`, `phone_e164` (AC-10; set to null in AC-11 step 1); the row is deleted by the `auth.users` cascade (AC-11 step 2) |
| `orders` | `id`, `order_number`, `status`, `placed_at`, `total`, `amount_paid`, `placed_by_user_id` (`orders_placed_by_user_id_idx`) | never by this feature; `placed_by_user_id` goes to null through its existing `on delete set null` |
| `auth.users` (Drizzle stub in `src/server/db/schema/auth.ts`) | `email` (added to the stub as `text("email")`; Supabase owns the table and `drizzle.config.ts` already leaves the `auth` schema out of migrations, so no SQL changes) | deleted only through `auth.admin.deleteUser` |

Relationships: a profile has many orders (`placed_by_user_id`) and many account events (`profile_id`, logical link with no FK).

**State transitions**:

```
role:     customer ⇄ electrician          (AC-7; admin is never a source or target)
account:  active → removal pending → gone (AC-11 step 1, then step 2)
          active → gone                   (AC-11 both steps succeed in one request)
          removal pending → gone          (AC-12 finishCustomerRemoval)
```

"Removal pending" is not stored as a state: it is derived as "the profile exists and has a `removed` event".

**API surface**:

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/admin/customers` (`src/app/admin/(dashboard)/customers/page.tsx`, `loading.tsx`) | page | `page`, `notice` (search params) | AC-2, AC-3, AC-11 notice | `requireAdminPage(routes.admin.customersPage(page))` | redirect to sign in |
| `/admin/customers/[id]` (`.../customers/[id]/page.tsx`, `loading.tsx`) | page | `id` (segment), `page` (search param) | AC-4 to AC-7, AC-10 to AC-13 | `requireAdminPage(routes.admin.customer(id))` | `notFound()` for a bad id, a missing profile, or an admin |
| `listAdminCustomers(page)` (`src/features/customers/server/admin-queries.ts`) | query | page | `{ rows: AdminCustomerRow[], hasNext }`; row `{ id, fullName, phone, role, orderCount, removalPending }` | `requireAdminPage` | throws on DB error |
| `getAdminCustomer(id)` (same file) | query | uuid | `{ id, fullName, phone, phoneE164, email, role, createdAt, removalPending, totals: { orderCount, spent, owed } } \| null` (null for a missing profile or an admin) | `requireAdminPage` | throws on DB error |
| `readCustomerOrders(id, page)` (same file) | query | uuid, page | `{ rows, total }`, row `{ position, number, status, placedAt, total, amountPaid }`, windowed exactly like spec 0018's `readMyOrders` | `requireAdminPage` | throws on DB error |
| `readAccountEvents(id)` (same file) | query | uuid | `AccountEventRow[]` `{ id, type, fromRole, toRole, fields, createdAt }` | `requireAdminPage` | throws on DB error |
| `searchAdminCustomers` (`src/features/customers/server/admin-actions.ts`, `"use server"`) | Server Action | `{ text: string ≤ 254 }` | `Result<{ rows: AdminCustomerRow[] }, "forbidden" \| "invalid" \| "failed">` (at most 50 rows) | `requireAdmin()` | as listed |
| `changeCustomerRole` (same file) | Server Action | `{ profileId: uuid, from: "customer" \| "electrician", to: same }` | `Result<{ role }, "forbidden" \| "invalid" \| "not_found" \| "stale" \| "removal_pending" \| "failed">` | `requireAdmin()` | as listed |
| `updateCustomerDetails` (same file) | Server Action | `{ profileId: uuid, name: string, phone: string }` | `Result<{ changed: readonly ("full_name" \| "phone")[] }, "forbidden" \| "invalid" (+ field errors) \| "not_found" \| "removal_pending" \| "failed">` | `requireAdmin()` | as listed |
| `removeCustomer` (same file) | Server Action | `{ profileId: uuid }` | redirect on success; else `Fail<"forbidden" \| "invalid" \| "not_found" \| "has_open_orders" \| "has_balance" \| "removal_unfinished" \| "failed">` | `requireAdmin()` | as listed |
| `finishCustomerRemoval` (same file) | Server Action | `{ profileId: uuid }` | redirect on success; else `Fail<"forbidden" \| "invalid" \| "not_found" \| "removal_unfinished">` | `requireAdmin()` | as listed |
| `changeCustomerRoleInDb`, `updateCustomerDetailsInDb`, `startCustomerRemovalInDb` (`src/features/customers/server/account-writes.ts`) | db functions (take `db`, the admin id, the input) | as above | the result codes above | called only by the actions | as listed |
| `deleteAuthUser(userId)` (`src/server/auth/supabase-admin.ts`) | edge function over `@supabase/supabase-js` | uuid | `{ ok: true } \| { ok: false, code }` (a "user not found" error maps to ok) | server only, service role key | `code` from Supabase |

Pure modules in `src/features/customers/`:
- `search.ts`: `classifyCustomerSearch(text)` returning `{ kind: "email", text } | { kind: "phone", e164 } | { kind: "name", folded } | { kind: "invalid" }`.
- `roles.ts`: `ASSIGNABLE_ROLES = ["customer", "electrician"]`, `otherRole(role)`.
- `account-rules.ts`: `changedFields(current, input)` returning the changed subset of `full_name` and `phone`; `removalBlock(orders)` returning `"has_open_orders" | "has_balance" | null` from `{ status, total, amountPaid }[]` (open first); `customerTotals(orders)` returning `{ orderCount, spent, owed }` (used to pin the SQL sums in tests and by the page when given rows); `historyLine(event)` returning the message key and values for AC-13.
- `schemas.ts`: `customerSearchSchema`, `changeRoleSchema`, `customerDetailsSchema` (= `profileSchema` plus `profileId`), `profileIdSchema`.

Name folding in SQL (AC-3): `searchNameSql(column)` in `admin-queries.ts` builds `translate(lower(regexp_replace(coalesce(column, ''), '[ARABIC_MARKS_SOURCE]', '', 'g')), 'أإآٱىةؤئیک', 'اااايهوييك')`, using `ARABIC_MARKS_SOURCE` from `src/lib/arabic.ts`. The query compares it with `'%' || folded || '%'` (with `%` and `_` in `folded` escaped), where `folded = normalizeForSearch(text)`. A database test checks that the SQL folding and `normalizeForSearch` agree for a fixed set of names. SQL deliberately skips two of its steps, NFKC normalization and the removal of Arabic presentation forms; names typed through the shop's forms are already tidied, so these rarely matter, and the parity set avoids them.

Changed files:
- `src/lib/phone.ts` (+ test): `parseSearchPhone(text)`, moved from `classifyOrderSearch` (the `SEPARATORS` and `NATIONAL_MOBILE` rule); `src/features/orders/admin-search.ts` calls it.
- `src/server/auth/supabase-admin.ts` (new): `authAdmin()` makes a per call `createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })` from `storageEnv()`; `deleteAuthUser`. `src/server/storage/admin.ts` keeps its own client.
- `src/server/db/schema/auth.ts`: `email: text("email")` on the stub.
- `src/lib/routes.ts` (+ test): `admin.customer(id)`, `admin.customersPage(page)` (page 1 leaves out the query), `admin.customersWith({ notice })`, `admin.customerOrdersMore(id, page, position)` (`/admin/customers/<id>?page=N#o-<position>`). The existing `admin.customers` stays.
- `src/features/orders/server/admin-queries.ts`: `getAdminOrder` also returns `placedByUserId` and `placedByAccountRole` (a left join on `profiles.role`); the order page renders the AC-14 link.
- `src/app/[locale]/account/page.tsx`: the AC-9 badge.
- `src/features/shell/nav.ts`: no change (the customers item exists and `activeAdminLink` already matches `/admin/customers/*`).
- `src/features/accounts/server/profile.ts` (+ db test): `readAccountProfile` adds `removalPending`; `src/features/accounts/server/actions.ts`: `updateProfile` refuses `account_removed`; `src/features/checkout/server/actions.ts`: `readPlacedBy()` returns null when `removalPending`; `/account` renders the pending message (AC-12).
- `src/i18n/messages/ar.json`: a new `AdminCustomers` namespace with every string quoted in AC-2 to AC-13 (`metaTitle` "العملاء", `title`, the column names, `role.customer` عميل, `role.electrician` كهربائي, the search, empty, totals, history, dialog, toast, and error texts, `fields.full_name` الاسم, `fields.phone` الهاتف, `fieldsBoth` "الاسم والهاتف"), plus `Account.electricianBadge` "حساب كهربائي" and `AdminOrders.viewCustomer` "عرض العميل". Order status words stay in `AdminOrders.status`.
- Tests: `e2e/admin-customers.spec.ts` (new); `e2e/orders.ts` helpers as needed.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| List | which accounts | `profiles` where `role in ('customer','electrician')` |
| List | order and tie break | `profiles.created_at desc, profiles.id desc` |
| List | page window | `pageWindow(parsePage(searchParams.page), 50)`, `splitPage` (spec 0014) |
| List | name, phone | `profiles.full_name`, `profiles.phone` (typed form, as the account page shows it) |
| List / page | role word | `profiles.role` → `AdminCustomers.role.*` |
| List / page / totals | order count | `count(orders)` where `placed_by_user_id = id and status <> 'cancelled'` |
| List / page | removal pending | `exists(account_events where profile_id = id and type = 'removed')` |
| Search | kind and match value | `classifyCustomerSearch(text)` over `tidyText`, `toWesternDigits`, `parseSearchPhone`, `normalizeForSearch` |
| Search | email match | `auth.users.email` joined on `profiles.id` |
| Customer page | email | `auth.users.email` |
| Customer page | registered date | `formatDate(profiles.created_at)` (shop time zone, spec 0005) |
| Customer page | WhatsApp target and text | `profiles.phone_e164`; `AdminCustomers.contactMessage` with `full_name` |
| Totals | spent | `sum(orders.total)` where `status = 'delivered'` |
| Totals | owed | `sum(orders.total − orders.amount_paid)` where `status = 'delivered' and amount_paid < total` (decided here) |
| Order history | rows, total, step | as `readMyOrders` (spec 0018), filtered by the page's `id` instead of the session |
| Order history | money line | `orderMoneyLine(status, amount_paid, total)` (spec 0018) |
| Change role | current role and `from` | the page's `profiles.role` at render, sent as `from`; checked against the locked row |
| Change role | actor | `requireAdmin().data.userId` |
| Edit details | changed fields | `changedFields({ full_name, phone, phone_e164 } of the locked row, parsed input)` |
| Remove | block reason | `removalBlock` over the locked profile's orders (`status`, `total`, `amount_paid`) |
| Remove | login delete | `auth.admin.deleteUser(profileId)` with `SUPABASE_SERVICE_ROLE_KEY` from `storageEnv()` |
| Remove | notice after redirect | `notice=removed` search param → `AdminCustomers.removedNotice` |
| History | lines and times | `account_events` rows → `historyLine`; `formatDateTime(created_at)` |
| Order page | customer link | `orders.placed_by_user_id` plus the joined `profiles.role` (not `admin`) |
| `/account` | electrician badge | `getAccountProfile().profile.role` (spec 0017) |
| User's next request | the new role | `profiles.role` read per request (no cache, AC-8) |

**Key invariants**:
- `profiles.role` only moves between `customer` and `electrician` through this feature; `admin` is never written, read as a source, or acted on.
- Every role change, detail edit, and removal start writes exactly one `account_events` row in the same transaction as the change; a no change edit writes none; a second removal start writes no second `removed` row.
- `account_events` never holds a name, phone, email, or address, and is never updated or deleted.
- `orders.placed_by_role`, `customer_name`, `customer_phone`, `customer_phone_e164`, and `address` are never written by this feature.
- An account is removed only when it has no order outside `delivered` and `cancelled`, and no delivered order with `amount_paid < total`, checked under a `for update` lock on the profile row.
- The search text never appears in a URL or a log.

**Security model**: Owner only. Every page and query runs `requireAdminPage()`, every action runs `requireAdmin()` before parsing, and the database functions are only reachable through them (in `server/` modules with `server-only`). All data goes through `getDb()`; RLS on the new table and the revoked grants keep `profiles`, `orders`, and `account_events` closed to `anon` and `authenticated`. The service role key is read only on the server through `storageEnv()` and used only by `deleteAuthUser`; its client is made per call and never reaches the browser. Admin accounts are filtered out of every query and refused by every action, so the owner cannot change, edit, or remove their own or another admin's account from the UI (making an admin stays a database and runbook step, spec 0001). The confirm dialogs guard against a stray tap; the `from` check guards against two tabs acting at once. Next.js refuses cross site POSTs to Server Actions (Origin check). Names, phones, and emails are personal data and fall under the no logging rule (AC-15); search goes by POST so they stay out of URLs and Cloudflare request logs. Removal answers a deletion request: login, name, and phone are deleted; copies on past orders stay as the shop's sales records, which the dialog says plainly. No regulated compliance scope applies.

**Configuration required**: none new. `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` already exist for Storage (spec 0006, `src/server/storage/env.ts`), in `.env.local`, `.dev.vars`, and the Worker's secrets.

**Critical test scenarios**:
- Happy path: register, order, find by phone in Arabic digits, open, see details, totals, the order; promote, and the user's `/account` badge and next order type change while the old order stays عميل, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**
- Concurrency: two tabs open the same customer; one promotes; the other's promote returns `stale` with its message and writes nothing, verifies **AC-7**
- Removal blocked and done: open order gives `has_open_orders`; a delivered unpaid order gives `has_balance`; a delivered paid one removes, the order stays with no account link, the list shows the notice, verifies **AC-11**, **AC-14**
- Half done removal: `deleteAuthUser` fails, the page shows "لم يكتمل حذف هذا الحساب.", "إكمال الحذف" then succeeds, and a second `removeCustomer` call writes no second event, verifies **AC-11**, **AC-12**
- Auth/permission: a signed out visitor and a customer on `/admin/customers` land on sign in; each action returns `forbidden` without `aal2`; an admin's id gives `notFound()` and `not_found`, verifies **AC-1**
- Privacy: after edits and a removal, `account_events` rows hold no name or phone, and no log line holds one, verifies **AC-13**, **AC-15**

## Build plan

Tracer Bullet: one real account travels list, page, and a role change first; then each part thickens.

1. **Thin thread: see a customer and promote them.** The migration (`account_event_type`, `account_events`, checks, RLS) with `pnpm db:check-rls`; the `email` column on the `auth.users` stub; `routes.admin.customer`, `customersPage`; `listAdminCustomers` (no search yet) and `getAdminCustomer` (details only) with database tests; the list page with columns and paging; the customer page with the details card; `changeRoleSchema`, `changeCustomerRoleInDb` with database tests, the `changeCustomerRole` action, the role card and dialog; the `AdminCustomers` messages; one Playwright path on 390: register, open the list, open the account, promote, see the role badge. Satisfies **AC-1**, **AC-2**, **AC-4**, **AC-7**, **AC-17**
2. **The role reaches the user.** The `/account` electrician badge; e2e proving the next page load and next order use the new role while the old order keeps its type. Satisfies **AC-8**, **AC-9**
3. **Find a customer.** `parseSearchPhone` moved into `src/lib/phone.ts` with `classifyOrderSearch` tests still green; `classifyCustomerSearch` with Vitest; `searchNameSql` with the folding parity database test; `searchAdminCustomers` and the search field, results, clear link, and messages. Satisfies **AC-3**
4. **Everything about one customer.** `readCustomerTotals` and `customerTotals`; `readCustomerOrders` with load more and `routes.admin.customerOrdersMore`; the WhatsApp button; the AC-14 link on the order page (`getAdminOrder` gains `placedByUserId` and the joined role). Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-14**
5. **Edit details and history.** `changedFields`, `updateCustomerDetailsInDb`, the action and dialog; `readAccountEvents`, `historyLine`, and the history card. Satisfies **AC-10**, **AC-13**
6. **Remove an account.** `removalBlock`; `startCustomerRemovalInDb` with database tests; the storefront pending guard (`removalPending` on the profile, `updateProfile`, `readPlacedBy`, `/account` message); `src/server/auth/supabase-admin.ts` with `deleteAuthUser`; `removeCustomer` and `finishCustomerRemoval` with action tests using a test double for `deleteAuthUser`; the remove card and dialog, the pending alert, the list marker, the notice. Satisfies **AC-11**, **AC-12**
7. **Finish.** Logs for every action; `loading.tsx` for both pages; the full Playwright set on 390 and 1280 with axe. Satisfies **AC-15**, **AC-16**, **AC-18**

## Consequences

**Positive**:
- You can find, understand, and manage any registered account from one page, and the order page links to it.
- Promotion needs no new mechanism: the role already lives in one column read on every request.
- Deletion requests have a real, tested answer, and the sales records survive it.
- `account_events` gives you a lasting record of who was promoted or edited when, with no personal data to scrub.

**Negative / tradeoffs**:
- Removal is two steps (database, then the Supabase API), so a failure between them leaves a "removal pending" account that needs a tap on "إكمال الحذف". The shop's tables are already clear at that point, but `auth.users` still holds the email and sign up metadata until the retry succeeds.
- A pending account needs a storefront guard (profile save refused, orders placed as guest), which touches spec 0017's code in three places.
- The check before removal holds a lock only until step 1 commits. A pending account's new orders are guest orders (AC-12), so nothing new gets linked in that gap.
- An open access token for a removed user stays valid until it expires (up to an hour). Their profile is gone, so checkout treats them as a guest (spec 0017) and My Orders shows nothing.
- Name search folds Arabic letters in SQL on every row instead of reading a stored key. That is fine for a shop's few thousand accounts, but it duplicates `normalizeForSearch` in SQL, which the parity test must keep honest.
- Guests are not customers here; a guest who orders often is only findable through the order search by phone.
- There's no role filter in the list (your choice); finding all electricians means scanning the role column.
- Moving `parseSearchPhone` out of `classifyOrderSearch` touches spec 0014's search code (behaviour unchanged).
- Removal stays blocked while a delivered order is unpaid, so a customer with a bad debt can't be removed until you record the payment or cancel the order.

**Neutral**:
- A second module now creates a service role client (`src/server/auth/supabase-admin.ts` beside `src/server/storage/admin.ts`); both read the same `storageEnv()`.
- The `auth.users` stub gains `email`; it stays out of migrations.
- The dashboard sidebar link already existed and now has a page.

## Follow-up

- [ ] Correct a customer's email from the dashboard (spec 0017 follow up, deferred here): needs a decision on confirming the new address, and uses the same `authAdmin()` client.
- [ ] Feature 21 (electrician quick order and drafts): decide what happens to an electrician's drafts when you switch them back to customer.
- [ ] Feature 31 (loyalty coins): once coin or redemption rows exist, the profile can't be deleted (spec 0002). Removal must then switch to anonymize and ban instead of deleting, and the totals strip gains the coin balance.
- [ ] Feature 24 (payments): `has_balance` and the owed total read `amount_paid`, so they become meaningful once payments are recorded. Review the "owed" rule if partial payments before delivery become common.
- [ ] Consider a role filter on the list later if the number of electricians grows.
- [ ] Add a runbook line to `docs/runbooks/` for making a second admin, since the dashboard deliberately cannot.
