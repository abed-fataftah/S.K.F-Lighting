# 0014. Order management in the dashboard

**Date**: 2026-10-28
**Status**: In Progress

## Summary

This turns Slice 1's plain order list and read only order page into the place where you run every order. You move an order through six statuses with one tap (skip ahead or undo one step), cancel it with an optional reason, see its history, and message the customer on WhatsApp with the status already written. The list filters by status, date, type, and pickup or delivery, and searches by number or phone (a phone search goes by POST, so no customer phone reaches a log). Orders you have not opened carry a yellow dot and a sidebar count that refresh every minute, and the only database change is one check tying `delivered_at` to the delivered status.

## Requirements

**User stories**:
- As the owner, I want to see every order with its status, and filter by status, date, type, and pickup or delivery, so I can plan the day's work.
- As the owner, I want to find an order fast by its number or the customer's phone when someone calls or messages.
- As the owner, I want to move an order to its next step in one tap, and undo a wrong tap, so the status the customer sees is right.
- As the owner, I want new orders and customer cancellations to stand out until I open them, wherever I am in the dashboard, so none is missed.
- As the owner, I want to message the customer on WhatsApp about their order with the number and status already written.

**Acceptance criteria** (these build on spec 0004 AC-13, which stays the record of what Slice 1 shipped; spec 0002 owns the columns):

- **AC-1**: Statuses. Six statuses are used, with these labels (`AdminOrders.status.*`): `new` جديد, `preparing` قيد التجهيز, `ready` جاهز, `out_for_delivery` قيد التوصيل, `delivered` تم التسليم, `cancelled` ملغي. No code writes `confirmed`. It keeps the label تم التأكيد and is treated exactly like `new` by every rule below, in case a row ever holds it: the جديد chip matches `status in ('new', 'confirmed')`, a `status=confirmed` URL param is ignored, `orderMoves('confirmed')` equals `orderMoves('new')`, and the action schemas accept all seven values as `from` but never `confirmed` as `to`. Each status shows as a `Badge`: `new` and `confirmed` use variant `new`, `preparing`, `ready`, and `out_for_delivery` use `proc`, `delivered` uses `ok`, `cancelled` uses `off`.
- **AC-2**: Allowed moves. A pure `orderMoves(fulfilment, status)` in `src/features/orders/status.ts` returns `{ next, forward, back, canCancel }` from the order's path. The pickup path is `new → preparing → ready → delivered`. The delivery path is `new → preparing → ready → out_for_delivery → delivered`. `next` is the following step on the path. `forward` is every later step after `next` (skips). `back` is the previous step on the path (for example `ready` goes back to `preparing`, whatever it came from), or `null` at `new`. `canCancel` is true for every status except `delivered` and `cancelled`. `delivered` and `cancelled` are final: every field is empty or false. A pickup order never reaches `out_for_delivery`. A pure `isAllowedMove(fulfilment, from, to)` is true only when `to` is `next`, in `forward`, or `back`. Cancelling goes only through AC-4, never through this check.
- **AC-3**: Change status. The Server Action `changeOrderStatus({ orderId, from, to })` runs `requireAdmin()` first (`forbidden`), then parses its input with `changeStatusSchema` (`invalid`; it and `cancelOrderSchema` and `orderSearchSchema` live in `src/features/orders/schemas.ts`). In one transaction it reads the order `for update` and checks in this order: `not_found` when missing, then `stale` when the stored status is not `from` (compared as stored, so `confirmed` is not `new` here), then `not_allowed` when `isAllowedMove` is false. Otherwise it updates `status = to` with `where id = orderId and status = from`, sets `delivered_at = now()` when `to` is `delivered`, and inserts one `order_events` row: type `status_changed`, `actor_kind = 'admin'`, `actor_user_id` the admin's user id, `from_status`, `to_status`, `data = {}`, `seen_at = now()`. It then revalidates `routes.admin.orders` and `routes.admin.order(number)`, and logs `{ event: "order_status_changed", orderId, from, to }` only. It returns `ok({ status: to })`.
- **AC-4**: Cancel. A "إلغاء الطلب" button, shown only when `canCancel`, opens an `AlertDialog`. The title is "إلغاء الطلب <number>؟", there is an optional textarea "سبب الإلغاء (اختياري)" (`cancelOrderSchema`: `tidiedText({ optional: true })`, at most 300 characters after tidying, blank becomes `null`), and two buttons, "تأكيد الإلغاء" and "تراجع". While the action runs both buttons are disabled. On success the dialog closes. On an error it stays open and shows the AC-5 message for that error in a `role="alert"` line inside the dialog. The Server Action `cancelOrderByAdmin({ orderId, from, reason? })` follows AC-3's guard, transaction, check order, revalidation, and errors: `not_found`, then `stale` (stored status is not `from`, so cancelling an already cancelled order is `stale` and the refreshed page shows the cancelled state), then `not_allowed` when `orderMoves(fulfilment, from).canCancel` is false. It logs `{ event: "order_cancelled", orderId, from }` only. It sets `status = 'cancelled'`, `cancelled_at = now()`, `cancelled_by = 'admin'`, and `cancel_reason` (the reason, or `null` when blank). It inserts one `cancelled` event (`actor_kind = 'admin'`, `actor_user_id`, `from_status`, `to_status = 'cancelled'`, `data = {}`, `seen_at = now()`). The reason lives only in `orders.cancel_reason`, never in the event or a log.
- **AC-5**: Status card on the order page. A card "حالة الطلب" at the top of the side column shows the status badge. When `next` exists, it shows one primary yellow button labelled with the next status (for example "جاهز"). Beside it, an outline "خيارات أخرى" menu lists each `forward` status as "انقل إلى <status>" and the `back` status as "رجوع إلى <status>". Under them sits the "إلغاء الطلب" button (AC-4). `OrderStatusCard` is a client component that renders the badge itself (from its `status` prop) with `tabIndex={-1}` and a ref. While an action runs, every control in the card is disabled; the action call and any `router.refresh()` run inside one `startTransition`, so the pending state lasts until the new status is on screen. On success the action's `revalidatePath` refreshes the page and focus then moves to the badge. On `stale` a `role="alert"` message says "تغيّرت حالة الطلب من مكان آخر. حدّثنا الصفحة لتظهر الحالة الحالية." and the card calls `router.refresh()`. Any message clears when the `status` prop changes. On `not_allowed`, `not_found`, `invalid`, or `forbidden` it says "تعذّر حفظ الحالة. حدّث الصفحة وحاول مرة أخرى.". A `delivered` order shows the badge and "اكتمل الطلب في <delivered_at>". A `cancelled` order shows the badge, "أُلغي في <cancelled_at> بواسطة <المتجر | العميل>", and the reason as "السبب: <cancel_reason>" when there is one. Neither final state shows any control. The header badge next to "طلب <number>" shows the status (replacing today's "جديد" flag badge, see AC-14).
- **AC-6**: History. Under the customer card, a "سجل الطلب" list (`<ol>`) shows the order's `created`, `status_changed`, and `cancelled` events, oldest first by `created_at, id`, each with its time through `formatDateTime`: `created` reads "استلمنا الطلب", `status_changed` reads "<المتجر> نقل الطلب إلى <to_status>", and `cancelled` reads "أُلغي الطلب بواسطة <المتجر | العميل>". The actor label is المتجر for `admin` and العميل for every other `actor_kind` (`guest`, `customer`, `electrician`, `system`), the same rule as AC-5 and AC-8. A `status_changed` or `cancelled` event with a null `to_status` is skipped. Other event types (later features) are not shown yet.
- **AC-7**: Contact the customer. The header has a green small `whatsapp` button "مراسلة العميل" opening `whatsappUrl(order.phoneE164, adminContactMessage(...))` with `target="_blank"` and `rel="noopener"`. The text is `AdminOrders.contactMessage`: "مرحباً {name}، معك S.K.F للإنارة بخصوص طلبك رقم {number}. حالة الطلب الآن: {status}." where `name` is the saved `customer_name` passed through `tidyText` (line breaks and direction marks removed), `number` the plain order number (no direction marks), and `status` the AC-1 label. It carries no prices and no address. Nothing is sent automatically.
- **AC-8**: List columns and markers. `/admin/orders` shows, in order: رقم الطلب, العميل, الهاتف, النوع (عميل or كهربائي, AC-11), الاستلام, الحالة (the AC-1 badge), الإجمالي, التاريخ. An unseen order (AC-14) shows a 10px yellow dot with a 1px ink border before its number, plus visually hidden text "لم يُفتح". An order with `status = 'cancelled'` and `cancelled_by` other than `admin` also shows a `new` variant badge "ألغاه العميل" in the status cell. The note under the table reads "الطلبات التي لم تفتحها بعد مميّزة بنقطة صفراء.". There is no payment column (feature 24 adds it). The order link keeps `prefetch={false}`.
- **AC-9**: Status and unseen chips. Above the table, a single choice chip row: الكل, then the six statuses in path order (جديد, قيد التجهيز, جاهز, قيد التوصيل, تم التسليم, ملغي). Each chip is a link that sets or clears `status`. Beside it, a separate toggle chip "لم تُفتح" sets `unseen=1`, showing only unseen orders (AC-14). It combines with every other filter.
- **AC-10**: Date filter. A chip row: كل الأيام, اليوم, آخر ٧ أيام, هذا الشهر (`range` = none, `today`, `7d`, `month`), plus a "من" and a "إلى" date field with a "تطبيق" button (`from`, `to` as `YYYY-MM-DD`). Days are shop days in `Asia/Hebron`. Today is today's shop date, 7 days is today and the six days before, and this month is from the 1st of the shop month to today. A custom range includes both end days: `placed_at >= start(from)` and `< start(to + 1 day)`. Only `from` means from that day on, and only `to` means up to the end of that day. A `from` after `to` is swapped. A date counts only when it matches `^\d{4}-\d{2}-\d{2}$` and is a real calendar day (it survives a round trip through a UTC `Date`, so `2026-02-30` and `2026-13-01` are ignored). When the URL holds both `range` and a valid `from` or `to`, the custom dates win, and `orderFiltersToParams` writes only one of the two (custom dates, or the preset). A preset resolves to from and to keys (today gives from = to = today). When a range is set, a line under the filters reads, through `formatDate`, "من <from> إلى <to>" with both ends, "من <from>" with only a start, and "حتى <to>" with only an end.
- **AC-11**: Type and pickup filters. A select "النوع" with الكل, عميل, كهربائي (`type` = none, `customer`, `electrician`). كهربائي means `placed_by_role = 'electrician'`. عميل means every other order, guests included (`placed_by_role` null, `customer`, or `admin`). A select "الاستلام" with الكل, توصيل, استلام من المعرض (`method` = none, `delivery`, `pickup`). The النوع column uses the same rule.
- **AC-12**: Filters in the URL. Every filter lives in the URL search params (`status`, `unseen`, `range`, `from`, `to`, `type`, `method`, `page`), parsed by a pure `parseOrderFilters(params, today)`. Unknown or broken values are ignored, never an error. Every link (the status, unseen, and preset chips, paging, clear) is built with `routes.admin.ordersWith(filters, page)`; a preset chip drops `from` and `to`. The النوع and الاستلام selects and the من and إلى fields sit in one plain GET `<form action={routes.admin.orders}>` with hidden inputs carrying the current `status` and `unseen`, submitted by its one "تطبيق" button (no client code, nothing submits on change). The form uses the same param names `parseOrderFilters` reads and never sends `page`. Filters combine with AND. Changing any filter returns to page 1. Previous and next keep the filters. A page past the last one (no rows and `page > 1`) redirects to `routes.admin.ordersWith(filters, 1)`. The order stays newest first (`placed_at desc, order_number desc`), 50 a page. When filters match nothing on page 1, an empty card says "لا توجد طلبات تطابق هذه الفلاتر." with an outline "مسح الفلاتر" link to `routes.admin.orders`. With no orders at all, today's empty card stays. A "مسح الفلاتر" link also shows beside the filters whenever one is set.
- **AC-13**: Search. A search field "بحث" (placeholder "رقم الطلب أو رقم الهاتف") with a "بحث" button posts to the Server Action `searchAdminOrders({ text })`, which runs `requireAdmin()` first. A pure `classifyOrderSearch(text, year)` runs `tidyText` and `toWesternDigits` first, then decides in this order. Text passing `isOrderNumber` (exactly `YY-NNNNN` or longer with an ASCII hyphen, no spaces) is that number. Otherwise one to seven digits only is the short form of this year's series, padded to five digits (`42` gives `26-00042`, `123456` gives `26-123456`, `1234567` gives `26-1234567`, the year from `shopYear(now)`). Otherwise text `normalizePhone` accepts is a phone (eight digits or more; a local number without its leading 0 is nine digits, so it never collides with the short form). Everything else is invalid. The action maps the result: `number` and found gives `ok({ kind: "open", number })`, `number` and missing gives `fail("no_order")`, `phone` gives `ok({ kind: "rows", rows })`, `invalid` gives `fail("invalid")`. A number that exists returns `{ kind: "open", number }` and the browser goes to `routes.admin.order(number)`. A number that does not exist shows "لا يوجد طلب بهذا الرقم." under the field. A phone returns `{ kind: "rows", rows }`: every order with that `customer_phone_e164`, newest first, at most 50, across all orders whatever the filters. They show in place of the list with the heading "نتائج البحث عن هذا الرقم" and an outline "مسح البحث" button that brings the filtered list back. No match says "لا توجد طلبات لهذا الرقم.". Invalid text says "اكتب رقم طلب أو رقم هاتف صحيحاً.". The search text never goes into the URL, a log, or browser storage. The action logs `{ event: "admin_order_search", kind }` only.
- **AC-14**: Unseen. An order is unseen while it has an `order_events` row with `seen_at is null` and type `created` or `cancelled`. A new order (its `created` event) and a cancellation by a customer, guest, or electrician (feature 17 writes that event with `seen_at` null) make it unseen. Your own status moves and cancellations never do, since they are written seen (AC-3, AC-4). Opening `/admin/orders/[number]` marks every unseen event of that order seen (as today). A customer cancellation after you opened the order makes it unseen again. One exception, accepted: a customer cancellation that arrives while that order's page is open is marked seen by the next refresh (AC-16) and so is shown on the page, not flagged. The header no longer shows a "جديد" flag badge; the dot (AC-8), the count (AC-15), and the chip (AC-9) carry the flag.
- **AC-15**: Sidebar count. The الطلبات link in `AdminSide` shows a `count` variant `Badge` with the number of unseen orders (distinct `order_id`, AC-14) through `formatNumber`, shown as "+٩٩" above 99, and nothing when 0. The link's accessible name becomes "الطلبات، <N> لم تُفتح" when N is above 0. The dashboard layout reads the count with `countUnseenOrders()` on every request, wrapped in `withTimeLimit(read, 1500)` (`src/server/db/time-limit.ts`). On `timeout` or `failed` it renders no badge and logs `{ event: "unseen_count_failed", error }` only, so a slow database never takes down the dashboard. The admin guard itself is never wrapped.
- **AC-16**: Live refresh. A client `AutoRefresh` in the dashboard layout runs a `setInterval` every 60 seconds plus a `visibilitychange` handler. `lastAt` starts at mount time and is reset by every refresh it makes. A tick calls `router.refresh()` when `document.visibilityState` is `visible` and `now - lastAt >= 60 000`. Becoming visible again does the same check at once. It skips a tick while the user is busy: focus is in an `input`, `textarea`, or `select` anywhere on the page (the filter bar and search included), or a `[role="dialog"]` or `[role="alertdialog"]` is open; the next tick checks again. It also calls `router.refresh()` once when the pathname changes from an order page (`/admin/orders/<number>`) to any other dashboard page, and resets `lastAt`, so the layout's count (AC-15) and the list's dot reflect the order you just opened instead of waiting a minute. The pure `shouldRefresh({ lastAt, now, visible, busy })` holds the timer rule. New orders, the dot, the count, and the status of an open order page update without a reload. Phone search results (client state) stay as they are until searched again or cleared.
- **AC-17**: Access and logs. Every dashboard read (`listAdminOrders`, `getAdminOrder`, `countUnseenOrders`) runs `requireAdminPage()` and every action runs `requireAdmin()` (role `admin`, `aal2`, session checked with Supabase Auth) before anything is read or written. A signed out visitor or a non admin gets the sign in redirect for pages and `forbidden` for actions, and nothing is written. No log line holds a customer name, phone, address, notes, cancel reason, or search text.
- **AC-18**: Database check. A new check `orders_delivered_check`, `(status = 'delivered') = (delivered_at is not null)`, rejects a delivered order without `delivered_at` and a `delivered_at` on any other status. It lands in one additive migration from `pnpm db:generate`.
- **AC-19**: Playwright flows pass on a phone sized RTL screen (390) and a computer sized one (1280), signed in as admin with `aal2`. A pickup order goes new, preparing, ready, delivered with the primary button, and a delivery order also passes قيد التوصيل. A skip (new to ready from the menu) and one step back (ready to preparing) work. Cancelling with a reason shows the reason and no controls. A second tab moving the same order first gives the stale message. The history lists each move. The contact link holds the AC-7 text. The status, unseen, date preset, custom range, type, and method filters each narrow the list and survive a reload and the back button. A number search opens the order, a short number search too, an unknown number shows its message, and a phone search shows that phone's orders with no phone in the URL. A new order placed in another context shows its dot and the sidebar count within about 60 seconds without a reload, and opening it then returning to the list (by link, not reload) clears both at once. A page past the last redirects to page 1. A custom range with only a start shows "من <from>". An order cancelled by its customer (event inserted with the database helper) shows the dot and "ألغاه العميل". A `page.on("console")` spy sees no name, phone, address, or reason. The list, the filtered empty state, the order page (open and final), and the cancel dialog pass the axe check.

## Decision

**Chosen option**: Option 1: Thicken the server rendered pages, with URL filters and Server Actions.

Keep spec 0004's two server rendered routes and their queries. Add a pure status rules module, two guarded Server Actions for moves and cancels, a POST search action, URL based filters, and a small client refresher. One additive check migration.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`, server components and Server Actions) · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`, the orders table shared by the server list and the client search results) · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`, ToggleGroup, Select, AlertDialog, DropdownMenu on Base UI) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`, the guarded update and the check) · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`)

## Feature design

**Data model sketch**: no new table or column. One new check on `orders` (AC-18). Reads and writes spec 0002 as built:

| Table | Key | Read | Written by this feature |
|---|---|---|---|
| `orders` | `id` PK, `order_number` unique | every column the list and page show, `placed_by_role`, `status`, `placed_at`, `customer_phone_e164`, `delivered_at`, `cancelled_*` | `status`, `delivered_at` (AC-3); `status`, `cancelled_at`, `cancelled_by = 'admin'`, `cancel_reason` (AC-4); `updated_at` through the existing timestamps helper |
| `order_lines` | `id` PK, `order_id` FK `orders` (N:1) | as today | nothing |
| `order_events` | `id` PK, `order_id` FK `orders` (N:1), `actor_user_id` FK `profiles` | `type`, `actor_kind`, `to_status`, `seen_at`, `created_at` | inserts `status_changed` and `cancelled` rows written seen; `seen_at` on open (as today) |

Existing indexes cover every filter: `orders_status_idx`, `orders_placed_at_idx`, `orders_customer_phone_e164_idx`, the `order_number` unique index, `order_events_order_id_idx`, and the partial `order_events_unseen_idx`. `placed_by_role` has no index; at this shop's volume a scan of the date and status narrowed rows is fine.

**State transitions** (AC-2):

```
pickup:    new → preparing → ready → delivered
delivery:  new → preparing → ready → out_for_delivery → delivered
any non final status → cancelled
forward: any later step on the path · back: the previous step on the path · delivered, cancelled: final
confirmed: never written; treated as new
```

**API surface**:

| Surface | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `orderMoves`, `isAllowedMove`, `ORDER_STATUSES_SHOWN` (`src/features/orders/status.ts`, pure) | functions | `fulfilment`, `status` (`from`, `to`) | `{ next, forward, back, canCancel }`; boolean | none | none |
| `parseOrderFilters`, `orderFiltersToParams` (`src/features/orders/admin-filters.ts`, pure) | functions | URL search params, `today` date key | `OrderFilters` `{ status?, unseen, range?, from?, to?, type?, method?, page }` plus the resolved `[start, end)` shop days | none | none (bad values ignored) |
| `classifyOrderSearch` (`src/features/orders/admin-search.ts`, pure) | function | `text`, `year` | `{ kind: "number", number } \| { kind: "phone", e164 } \| { kind: "invalid" }` | none | none |
| `adminContactMessage` (`src/features/orders/admin-contact-message.ts`, pure) | function | `{ name, number, statusLabel }`, translator | the AC-7 text | none | none |
| `shouldRefresh` (`src/features/orders/auto-refresh.ts`, pure) | function | `{ lastAt, now, visible, busy }` | boolean | none | none |
| `listAdminOrders(filters)` (`admin-queries.ts`, changed) | query | `OrderFilters` | `{ rows: AdminOrderRow[], hasNext }`; row gains `status`, `placedByRole`, `isUnseen` (renamed from `isNew`, now `created` or `cancelled`), `cancelledByCustomer` | `requireAdminPage(routes.admin.ordersWith(filters, page))` | redirect to sign in |
| `getAdminOrder(number)` (changed) | query | `orderNumber` | `AdminOrder` plus `status`, `deliveredAt`, `cancelledAt`, `cancelledBy`, `cancelReason`, `events: { id, type, actorKind, toStatus, at }[]`; `wasNew` is removed (the header no longer shows a flag); marks seen after reading | `requireAdminPage` | `null` (not found) |
| `countUnseenOrders()` (new, `admin-queries.ts`) | query | none | number | `requireAdminPage` | redirect |
| `changeOrderStatus` (new, `src/features/orders/server/admin-actions.ts`, `"use server"`) | Server Action | `{ orderId: uuid, from: status, to: status }` | `Result<{ status }, "forbidden" \| "invalid" \| "not_found" \| "stale" \| "not_allowed">` | `requireAdmin()` | as listed |
| `cancelOrderByAdmin` (new, same file) | Server Action | `{ orderId: uuid, from: status, reason?: string ≤ 300 }` | `Result<{ status: "cancelled" }, same errors>` | `requireAdmin()` | as listed |
| `searchAdminOrders` (new, same file) | Server Action | `{ text: string ≤ 40 }` | `Result<{ kind: "open", number } \| { kind: "rows", rows: AdminOrderRow[] }, "forbidden" \| "invalid" \| "no_order">` | `requireAdmin()` | as listed |
| `OrdersTable` (`src/features/orders/components/orders-table.tsx`) | shared component (no server imports, `useTranslations`) | `rows` | the AC-8 table | none | none |
| `OrderFiltersBar`, `OrderSearch` (client), `OrderStatusCard` (client), `CancelOrderDialog` (client), `OrderHistory`, `AutoRefresh` (client) | components | as above | AC-5, AC-6, AC-9 to AC-13, AC-16 | none | none |
| `routes.admin.ordersWith(filters, page)` (`src/lib/routes.ts`) | route builder | `OrderFilters`, page | `/admin/orders?…` | none | none |
| `shopDateKey(date)`, `shopDayStart(key)`, `addDaysToKey(key, n)` (`src/lib/format.ts`) | functions | a `Date` or a `YYYY-MM-DD` key | the shop date key; the UTC instant of that day's 00:00 in `Asia/Hebron` (summer time aware); a shifted key | none | throws on a malformed key (a bug, the parser checks first) |

`AdminSide` gains an optional `unseenOrders?: number` prop, passed by the dashboard layout. The gallery passes none.

Status updates go through the transaction handle from `getDb()`. The `for update` read plus the `where status = from` update make a second tab's stale move a `stale` result, never a silent overwrite. A double tap gives `stale` on the second call, and the card disables its controls while pending, so it is not seen in practice.

**Strings** (`src/i18n/messages/ar.json`, `AdminOrders` namespace unless noted; existing keys keep their text unless listed):
- `status.new` جديد, `status.confirmed` تم التأكيد, `status.preparing` قيد التجهيز, `status.ready` جاهز, `status.out_for_delivery` قيد التوصيل, `status.delivered` تم التسليم, `status.cancelled` ملغي.
- List: `type` النوع, `typeCustomer` عميل, `typeElectrician` كهربائي, `statusColumn` الحالة, `unseen` لم يُفتح, `unseenChip` لم تُفتح, `cancelledByCustomer` ألغاه العميل, `newNote` becomes "الطلبات التي لم تفتحها بعد مميّزة بنقطة صفراء.", `all` الكل, `filtersLabel` تصفية الطلبات, `rangeAll` كل الأيام, `rangeToday` اليوم, `range7d` آخر ٧ أيام, `rangeMonth` هذا الشهر, `from` من, `to` إلى, `apply` تطبيق, `rangeLine` "من {from} إلى {to}", `clearFilters` مسح الفلاتر, `filteredEmpty` "لا توجد طلبات تطابق هذه الفلاتر.", `search` بحث, `searchPlaceholder` "رقم الطلب أو رقم الهاتف", `searchResults` "نتائج البحث عن هذا الرقم", `clearSearch` مسح البحث, `noOrderNumber` "لا يوجد طلب بهذا الرقم.", `noPhoneOrders` "لا توجد طلبات لهذا الرقم.", `searchInvalid` "اكتب رقم طلب أو رقم هاتف صحيحاً.".
- Order page: `statusCard` حالة الطلب, `moreMoves` خيارات أخرى, `moveTo` "انقل إلى {status}", `moveBack` "رجوع إلى {status}", `cancel` إلغاء الطلب, `cancelTitle` "إلغاء الطلب {number}؟", `cancelReason` "سبب الإلغاء (اختياري)", `cancelConfirm` تأكيد الإلغاء, `cancelKeep` تراجع, `deliveredLine` "اكتمل الطلب في {at}", `cancelledLine` "أُلغي في {at} بواسطة {actor}", `reasonLine` "السبب: {reason}", `actorShop` المتجر, `actorCustomer` العميل, `stale` "تغيّرت حالة الطلب من مكان آخر. حدّثنا الصفحة لتظهر الحالة الحالية.", `saveFailed` "تعذّر حفظ الحالة. حدّث الصفحة وحاول مرة أخرى.", `history` سجل الطلب, `eventCreated` استلمنا الطلب, `eventMoved` "{actor} نقل الطلب إلى {status}", `eventCancelled` "أُلغي الطلب بواسطة {actor}", `contact` مراسلة العميل, `contactMessage` "مرحباً {name}، معك S.K.F للإنارة بخصوص طلبك رقم {number}. حالة الطلب الآن: {status}.".
- `rangeFrom` "من {from}", `rangeUntil` "حتى {to}".
- `AdminShell.ordersUnseen` "الطلبات، {count} لم تُفتح".
- The `new` key ("جديد") is no longer used as a flag and is removed.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| List | rows, order, page | `orders` filtered by `OrderFilters`, `placed_at desc, order_number desc`, `pageWindow(page, 50)` |
| List | type label | `orders.placed_by_role` (`electrician` gives كهربائي, anything else عميل) |
| List | status badge | `orders.status` through AC-1 |
| List | dot | exists unseen `created` or `cancelled` event (AC-14) |
| List | "ألغاه العميل" | `orders.status = 'cancelled'` and `orders.cancelled_by <> 'admin'` |
| Date filter | today, month start | `shopDateKey(new Date())` on the request; month start is that key's year and month with day `01` |
| Date filter | instants for SQL | `shopDayStart(from)` and `shopDayStart(addDaysToKey(to, 1))` |
| Status card | allowed controls | `orderMoves(orders.fulfilment, orders.status)` |
| Status card | delivered or cancelled line | `orders.delivered_at`; `orders.cancelled_at`, `cancelled_by`, `cancel_reason` |
| Change status | `orderId`, `from`, `to` | the page's `order.id` and `order.status`, and the button's status (inputs) |
| Change status | `delivered_at` | `now()` in the transaction, only when `to = 'delivered'` |
| Change status, cancel | `actor_user_id` | `requireAdmin()` result `userId` |
| Change status, cancel | event `seen_at` | `now()` in the transaction |
| Cancel | `cancelled_at`, `cancelled_by`, `cancel_reason` | `now()`; the literal `'admin'`; the tidied reason input or `null` |
| History | lines, times, actor | `order_events.type`, `to_status`, `actor_kind`, `created_at` |
| Contact | phone | `orders.customer_phone_e164` |
| Contact | name, number, status | `orders.customer_name`, `orders.order_number`, AC-1 label of `orders.status` |
| Search | short form year | `shopYear(new Date())` on the server |
| Search | phone matches | `normalizePhone(text)` against `orders.customer_phone_e164` |
| Sidebar | count | `countUnseenOrders()`: `count(distinct order_id)` of unseen `created` or `cancelled` events |
| Live refresh | interval, busy | the constant 60 000 ms; `document.activeElement` and an open dialog in the DOM |

**Key invariants**:
- An order's status only changes through `changeOrderStatus` or `cancelOrderByAdmin` here (and feature 17's customer cancel), each in one transaction with exactly one event row.
- An update applies only when the stored status equals the status the page showed (`where status = from`).
- `delivered_at` is set exactly when the status is `delivered` (database check, AC-18); `cancelled_at` exactly when `cancelled` (existing check).
- Delivered and cancelled are final. No action moves an order out of them.
- Your own writes never raise the unseen flag; only events from someone else do.
- A customer phone or other personal detail never appears in a URL, a log, or browser storage from this feature.

**Security model**: the dashboard is for the one `admin` role at `aal2`. The layout guard stays, and each query and action checks again (AC-17), with `requireAdmin()` verifying the session with Supabase Auth before any write. All data goes through Drizzle, and RLS keeps the tables closed to `anon` and `authenticated`. The phone search body travels by POST, so Cloudflare request logs (observability is on) record only `/admin/orders` and the action id. The WhatsApp link holds the customer's phone in the `wa.me` URL; it opens in the admin's own browser and is never logged by the app.

**Configuration required**: none. Live refresh relies on Hyperdrive caching being off, already on the production runbook (`docs/runbooks/supabase-production.md`).

**Critical test scenarios**:
- `orderMoves`: every status on both paths gives the right `next`, `forward`, `back`, `canCancel`; `new` has no back; `delivered` and `cancelled` give nothing; pickup never offers `out_for_delivery`; `confirmed` behaves like `new`; `isAllowedMove` refuses `cancelled` as `to`, two steps back, and any move from a final state (unit), verifies **AC-1**, **AC-2**
- `changeOrderStatus`: a valid move updates the row and writes one seen `status_changed` event with from, to, actor; `delivered` sets `delivered_at`; a wrong `from` gives `stale` and writes nothing; an illegal move gives `not_allowed`; an unknown id gives `not_found`; a non admin gives `forbidden` and writes nothing (database test with the auth helpers mocked at the edge), verifies **AC-3**, **AC-17**
- `cancelOrderByAdmin`: sets the three columns, keeps a blank reason as `null`, writes one seen `cancelled` event with `data = {}`; refuses a delivered order (database test), verifies **AC-4**
- `orders_delivered_check`: rejects delivered without `delivered_at` and `delivered_at` on `ready` (database test, added to `schema.db.test.ts`), verifies **AC-18**
- `parseOrderFilters` and `orderFiltersToParams`: each valid value, every bad value ignored (including `2026-02-30`, `2026-13-01`, `status=confirmed`), `from > to` swapped, custom dates beat a preset and only one is written back, `page` reset rules; the resolved instants for today, 7 days, month, and a range that crosses the summer time change (unit), verifies **AC-9**, **AC-10**, **AC-11**, **AC-12**
- `shopDateKey`, `shopDayStart`, `addDaysToKey`: midnight on a summer and a winter date, the change days, month and year ends (unit, in `format.test.ts`), verifies **AC-10**
- `readAdminOrders` with filters: each filter alone and combined, `unseen` counting `created` and `cancelled` only, the type rule for null and `admin` roles, paging with filters (database test), verifies **AC-8**, **AC-9**, **AC-11**, **AC-12**, **AC-14**
- `classifyOrderSearch`: full number, short form `42`, `123456`, and `1234567`, Arabic digits, `599123456` (nine digits, a phone), `0599 123 456` and `+972…` as phones, a seven digit and an eight digit edge, text and empty as invalid (unit), verifies **AC-13**
- `searchAdminOrders`: open for an existing number, `no_order` for a missing one, rows for a phone across all orders, `forbidden` for a non admin; logs hold only the kind (database test with a console spy), verifies **AC-13**, **AC-17**
- `countUnseenOrders` and `markOrderSeen`: one count per order with several unseen events; your own events never counted; a customer cancel after open counts again (database test); the layout renders no badge when the read times out (unit over the wrapper), verifies **AC-14**, **AC-15**
- `readAdminOrders`: the جديد chip includes a `confirmed` row (database test), verifies **AC-1**, **AC-9**
- `adminContactMessage`: the exact AC-7 text for each status, no direction marks in the number (unit), verifies **AC-7**
- `shouldRefresh`: not visible, busy, under 60 seconds, and due (unit), verifies **AC-16**
- Full flows and axe as AC-19 on 390 and 1280, verifies **AC-5**, **AC-6**, **AC-8** to **AC-17**, **AC-19**

## Build plan

Tracer Bullet: spec 0004 already runs the list and page end to end, so each step pushes one more capability through every layer (database, pure rules, action, page, test) before the next.

1. [x] **One status move end to end.** `status.ts` (`orderMoves`, `isAllowedMove`, labels map) with Vitest; the `orders_delivered_check` in the schema plus `pnpm db:generate` and the schema test; `changeStatusSchema`; `changeOrderStatus` with its database test; `getAdminOrder` returns status and dates; `OrderStatusCard` with the primary button, the other moves menu, pending, stale and failure messages; the status badge in the header; the status column in the list; the status strings. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-18**
2. [x] **Cancel.** `cancelOrderByAdmin` with its database test; `CancelOrderDialog`; the final state lines for delivered and cancelled. Satisfies **AC-4**, **AC-5**
3. [x] **History and contact.** Events in `getAdminOrder`; `OrderHistory`; pure `adminContactMessage` with Vitest; the "مراسلة العميل" button. Satisfies **AC-6**, **AC-7**
4. [x] **Unseen flags everywhere.** `isUnseen` over `created` and `cancelled`; the dot with hidden text and the "ألغاه العميل" badge; the header flag badge removed; `countUnseenOrders` with its database test; the `AdminSide` count and accessible name; `shouldRefresh` with Vitest and `AutoRefresh` in the layout (timer, visibility, busy skip, refresh on leaving an order page); `countUnseenOrders` behind `withTimeLimit`. Satisfies **AC-8**, **AC-14**, **AC-15**, **AC-16**
5. [x] **Filters in the URL.** `shopDateKey`, `shopDayStart`, `addDaysToKey` in `format.ts` with tests; `parseOrderFilters`, `orderFiltersToParams`, `routes.admin.ordersWith` with Vitest; filtered `readAdminOrders` with its database test; `OrderFiltersBar` (status chips, unseen chip, date chips and fields, type and method selects, clear link); the type column; the filtered empty state; paging with filters. Satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**
6. [x] **Search by POST.** `classifyOrderSearch` with Vitest; `searchAdminOrders` with its database test and log spy; the shared `OrdersTable`; `OrderSearch` with results and clear. Satisfies **AC-13**, **AC-17**
7. [x] **Phone and computer flows.** Playwright on 390 and 1280 per AC-19, a database helper that inserts a customer `cancelled` event, the second tab stale check, the 60 second refresh (with the interval shortened through a test only hook or `page.clock`), the console spy, and axe on each screen. Satisfies **AC-19**, and checks **AC-5** to **AC-17** end to end

## Consequences

**Positive**:
- Every status the customer will see on the order page (feature 16) comes from one pure rule set, tested once, so features 16 and 17 reuse `orderMoves` and the labels instead of copying them.
- Two tabs, or you and a customer at the same moment, can never overwrite each other silently; the loser gets a clear message.
- Filtered views are plain links, so a view like "today's deliveries" can be bookmarked, and back and reload keep it.
- No phone number reaches Cloudflare's logs through search.

**Negative / tradeoffs**:
- A phone search is not in the URL, so a reload or the back button drops it; you search again.
- A short number like `42` always means this year's series. An order from last year needs its full `25-00042`.
- The 60 second refresh adds one count query and one page render a minute per open dashboard tab, and a new order can take up to a minute to show.
- On an open order page, the refresh marks any new event on that order seen (you are looking at it, so it is shown, but you do not get a separate alert).
- One step back follows the path, not the history: a skip from new to ready, undone, lands on preparing, not new. You then step back once more.
- The native date fields show the browser's own date format, not the shop's Arabic format; the chosen range is repeated underneath through `formatDate`.

**Neutral**:
- `confirmed` stays in the enum unused; removing an enum value is not an additive migration, so it stays.
- The dashboard home (`admin-home.md`) is not built; `/admin` still opens the orders.

## Follow-up

- [ ] Feature 16 (order page): show the status with `AdminOrders.status` labels (or a storefront copy of them) and reuse `orderMoves` for nothing more than display.
- [ ] Feature 17 (customer cancel): write the `cancelled` event with `seen_at` null and `actor_kind` of the customer, so AC-14 flags it; decide the customer's own cut off.
- [ ] Feature 24 (payments): add the الدفع column and a payment filter to this list.
- [ ] Feature 33 (return requests): count `return_requested` events in `isUnseen` and `countUnseenOrders`.
- [x] Dashboard home (`docs/design/pages/admin-home.md`) enrolled as scope feature 35.
- [x] Deferred on the scope, each needs a decision: edit customer details on an order; a printable order slip; private owner notes (the `note` event type exists); a sound or browser notification for new orders.
- [ ] Update `docs/design/pages/admin-orders.md` and `admin-order-details.md` with the six statuses (O-3 plus قيد التوصيل), the next step buttons, the history, the unseen chip, and the date filter (design source of truth).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
