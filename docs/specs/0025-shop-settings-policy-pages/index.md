# 0025. Shop settings and policy pages

**Date**: 2026-11-06
**Status**: Proposed

## Summary

You run the shop's contact details, delivery zones, and the three policy pages from `/admin/settings`, with no code change or deploy. The WhatsApp number moves from a build variable into `shop_settings`, and the old variable stays as a fallback, so a WhatsApp link never disappears. Every page already renders fresh on each request (spec 0001), so a saved change shows up on the next page load with no cache work. Policies are Arabic Markdown (a light text format: `## heading`, `- list`) rendered safely with `react-markdown`, seeded with starter drafts you then edit. Checkout gets a short line linking the terms and the return policy.

## Requirements

New code lives in `src/features/settings/` (`server/` imports `server-only`) and `src/features/policies/`. Every dashboard action calls `requireAdmin()` first and `getVerifiedUser()` before writing. Every string goes in `ar.json` (dashboard words in a new `AdminSettings` namespace, storefront words in `Policies`), every price through `formatPrice`, every date through `formatDate`, every link through `routes`. Text input is tidied with the spec 0005 helpers and parsed by one shared Zod schema on the client and the server.

**User stories**:
- As the owner, I want to change the WhatsApp number, phone, and address myself so that customers always reach the right number.
- As the owner, I want to edit, add, and pause delivery zones and their fees so that checkout and Home always show what I charge today.
- As the owner, I want to write my privacy, terms, and return policies in Arabic so that customers know the rules before they order.
- As a customer, I want to read the policies from the footer, the menu, and checkout so that I know what I am agreeing to.

**Acceptance criteria**:
- **AC-1**: `/admin/settings` (owner only, `noindex`) shows the h1 "إعدادات المتجر" and three cards in this order: "بيانات التواصل", "رسوم التوصيل", "صفحات السياسات". Contact and each zone save on their own; a successful contact save shows "تم حفظ الإعدادات." beside its button.
- **AC-2**: The contact card edits `رقم واتساب` (required), `رقم الهاتف` and `العنوان` (both optional; an empty field saves as null). The WhatsApp field accepts `+970 599 123 456`, dashes, spaces, brackets, and Arabic digits, and saves digits only. Checks run in this order:
  1. Empty gives "أدخل رقم واتساب.".
  2. The value is stripped to digits.
  3. A leading `0` gives "أضف رمز الدولة في البداية، مثل 970.".
  4. Anything that is not 8 to 15 digits starting with 1 to 9 gives "أدخل رقم واتساب مع رمز الدولة، مثل 970599123456.".

  The phone field follows the same strip (7 to 15 digits, stored as typed after tidying), else "أدخل رقم هاتف صحيحاً.". The WhatsApp and phone inputs are `dir="ltr"` with `inputMode="tel"`. The WhatsApp field shows the number in use now: the saved one, else the env fallback.
- **AC-3**: After a WhatsApp number save, the next load of any storefront page uses it in every `wa.me` link, including:
  - the floating button, the menu, and the help links
  - Home, the categories index, category, search, product, and cart pages
  - the order page and the confirmation W5 link
  - the electrician quick order and draft screens
  - the policy page card
- **AC-4**: When `shop_settings.whatsapp_number` is null, or the settings read fails or takes over 1.5 seconds, every link uses `NEXT_PUBLIC_WHATSAPP_NUMBER` and the page still renders. The client error page (`src/app/[locale]/error.tsx`) always uses the env number.
- **AC-5**: The zones card lists every zone (active and paused) by `sort`, then name. Each row has:
  - "اسم المنطقة" (1 to 40 chars, unique)
  - "الاسم المختصر" (1 to 12 chars, hint "يظهر في شريط الرئيسية، مثل: الضفة")
  - "الرسوم (₪)", an LTR numeric input showing `fee / 100`
  - an "مفعّلة" switch
  - a "حفظ" button, which shows "تم الحفظ." on success

  A fee must be a whole number of shekels from 0 to 500. Arabic digits are accepted; empty, decimals, or out of range give "أدخل رسوماً بالشيكل من 0 إلى 500، بدون كسور.". A name already used (the database unique error, code 23505) gives "يوجد منطقة بهذا الاسم.". The database refuses any fee outside 0 to 50000 agorot or not a multiple of 100.
- **AC-6**: "إضافة منطقة" adds a zone (same fields, active) at the end of the list. At 10 zones the button is disabled with "الحد الأقصى 10 مناطق.", and the action refuses with `zone_limit`. The switch pauses or resumes a zone straight away: it shows a pending state, and if the save fails it flips back and shows "تعذّر الحفظ. حاول مرة أخرى." in a `role="alert"` line. A paused zone disappears from checkout and from the Home fee line on the next load. With every zone paused the card shows "التوصيل متوقف: كل المناطق غير مفعّلة، والاستلام من المعرض فقط متاح." and checkout offers pickup only (spec 0004). Zones are never deleted.
- **AC-7**: A fee change shows on the next checkout and Home load. A checkout opened before the change and sent after it is refused with the fresh zones and total (the existing spec 0004 `expectedTotal` check, unchanged). A checkout whose chosen zone was paused meanwhile is refused with the existing `zone_invalid` result and the fresh zones. Orders already placed keep their stored `delivery_fee` and `delivery_zone_name`.
- **AC-8**: `/policies/privacy`, `/policies/terms`, and `/policies/returns` each show, in order: the h1 from `pages.title`, a tab row (three links, the current one with `aria-current="page"`, inside `nav aria-label="السياسات"`), a card with "آخر تحديث: {date}" from `pages.updated_at` in the shop time zone and the rendered body, then a card "لديك سؤال؟" with the green button "تواصل معنا عبر واتساب" (`Shell.menuWhatsapp`). The button opens WhatsApp with the new message `Policies.whatsappMessage`, "مرحباً، عندي سؤال عن سياسات المتجر.". Any other slug, or a missing row, is a 404. A failed read throws to the existing `src/app/[locale]/error.tsx`. The pages are indexable, with the title `{pages.title} | S.K.F Lighting`.
- **AC-9**: The body is parsed as CommonMark plus `remark-breaks` (a single Enter makes a line break; no GFM, so no tables and no bare autolinks). It renders only `h2`, `h3`, `p`, `ul`, `ol`, `li`, `strong`, `em`, `a`, `br`, `hr`:
  - `#` and `##` render as `h2` (one h1 per page), and `###` to `######` as `h3`.
  - Quotes and code are unwrapped to their text, and images are not rendered.
  - Raw HTML shows as plain text.
  - Only `https:`, `mailto:`, `tel:`, and same site paths survive as links; `javascript:` and others are dropped.
- **AC-10**: The policies card lists the three pages with their title, "آخر تحديث: {date}", and a "تعديل" link to `routes.admin.policy(slug)`. The editor (`noindex`, owner only) has:
  - "العنوان" (1 to 80 chars, "اكتب عنوان الصفحة.")
  - "النص", a tall RTL textarea (1 to 20,000 chars, "اكتب نص الصفحة."), with the hint "للتنسيق: ## عنوان فرعي، - بند في قائمة، **نص عريض**."
  - a "معاينة" / "تعديل" toggle, which loads the preview with `next/dynamic` and renders through the same `PolicyBody` as the live page
  - "حفظ الصفحة", which shows "تم حفظ الصفحة." on success
  - "عرض الصفحة", which opens the live page in a new tab

  Closing or reloading the tab with unsaved changes asks the browser's `beforeunload` confirmation. In app link clicks are not intercepted.
- **AC-11**: A policy save sends the `version` it loaded. If the page was saved since then, the save is refused with "عُدّلت هذه الصفحة من مكان آخر بعد أن فتحتها. انسخ نصك، ثم أعد تحميل الصفحة." and the typed text stays in the form. A successful save returns the new `version`, so a second save from the same form works.
- **AC-12**: Under the checkout send button, after the existing note, a line reads "بإرسال طلبك فإنك توافق على {terms} و{returns}." with "الشروط والأحكام" and "سياسة الإرجاع" linked to `routes.terms` and `routes.returns`. Both open in a new tab (so the typed form is kept). Each link ends with a visually hidden span "(تفتح في نافذة جديدة)" (not an `aria-label`, so the visible text stays part of the name).
- **AC-13**: The footer and menu policy links (spec 0003) reach the three pages, and each page renders on a 390px RTL screen with no sideways scroll.
- **AC-14**: After the migration, the three pages exist with Arabic starter drafts. The returns draft says a return is asked for within 7 days of delivery, items must be unused and in their original box, and the customer sends the order number on WhatsApp.
- **AC-15**: Every settings action refuses a caller who is not an `aal2` admin with `forbidden` and changes nothing; `/admin/settings` and its policy editors redirect such a visitor like the other dashboard pages.

## Decision

**Chosen option**: Settings in the existing tables, read fresh per request; policies as Markdown in a new `pages` table rendered by `react-markdown` in a Server Component.

The owner edits `shop_settings`, `delivery_zones`, and `pages` from a settings hub plus one editor page per policy. The storefront reads them per request through `getDb()`, with the env WhatsApp number as the fallback.

**Implementation skills**: `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for a server rendered policy body and a small client preview · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the input, textarea, switch, and toggle · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the migration, the check, and RLS · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for the phone sized e2e flows

## Rationale

Reasoning and options considered: see [rationale.md](rationale.md).

## Feature design

**Design source**: the boards `docs/design/pages/admin-settings.md` and `docs/design/pages/policies.md` (card style, titles, and the copy they give), changed by this spec where they differ:
- The settings board's single page with three 100px textareas becomes a hub plus `/admin/settings/policies/[slug]`.
- The two fixed fee fields become a zone list you can add to and pause.
- Each card saves on its own instead of one header save.
- The email field and the owner profile card are left out.

Copy not on a board is quoted in the ACs above.

**Data model sketch** (one migration, added only):

| Table | Change | Columns and rules |
|---|---|---|
| `pages` | new, `.enableRLS()`, no grants | `id` uuid PK default random · `slug` text not null unique, `check (slug in ('privacy','terms','returns'))` · `title` text not null · `body` text not null (Arabic Markdown) · `version` integer not null default 0, bumped by 1 in every save's `UPDATE` (the stale check, like `home_version` in spec 0011) · `created_at`, `updated_at` (`timestamps()` from `columns.ts`; `updated_at` is for display only) |
| `pages` rows | inserted by the same migration | three rows with starter drafts (below) |
| `delivery_zones` | add `delivery_zones_fee_range_check` | `check (fee between 0 and 50000 and fee % 100 = 0)`; the seeded 2000 and 7000 pass |
| `shop_settings` | no schema change | `whatsapp_number`, `contact_phone`, `address` become editable; `email`, `shop_name`, `home_version` untouched |

Schema file: `pages` goes in `src/server/db/schema/content.ts` (spec 0002 lists it there). Title and body length limits live in Zod only.

**Starter drafts** (Arabic, short, written by `/develop` into the migration; you review and edit them before launch):
- `privacy`, title "سياسة الخصوصية": what is collected (name, phone, address, order details, and an account email when you sign up); why (to prepare, deliver, and follow up orders, and to contact you on WhatsApp); it is not sold, and it is shared only to deliver your order; how to ask for a change or deletion (WhatsApp).
- `terms`, title "الشروط والأحكام": prices are in shekels and may change, and the price at sending is the one that counts; an order is confirmed when the shop contacts you; payment is cash or cheque at delivery or pickup; delivery fees depend on the zone shown at checkout; you can cancel before delivery from the order page.
- `returns`, title "سياسة الإرجاع": ask within 7 days of delivery; items unused and in their original box; send the order number on WhatsApp; the shop checks the item, then agrees a refund or exchange with you.

**State transitions**: a zone is `active ⇄ paused` (`is_active`), never deleted. Nothing else has states.

**API surface** (Server Actions in `src/features/settings/server/actions.ts`, each returns `{ ok: true, data } | { ok: false, error }`):

| Action | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|
| `saveShopContact` | `whatsappNumber` (req), `contactPhone` (opt), `address` (opt) | saved values | `requireAdmin()` + `getVerifiedUser()` | `forbidden`, field errors (`whatsapp_required`, `whatsapp_country_code`, `whatsapp_invalid`, `phone_invalid`, text errors) |
| `saveZone` | `id`, `name`, `shortName`, `feeShekels` | zone | same | `forbidden`, `not_found`, `name_taken`, `fee_invalid`, text errors |
| `addZone` | `name`, `shortName`, `feeShekels` | zone (active, `sort` = `coalesce(max(sort), 0) + 1`) | same | `forbidden`, `zone_limit` (10 zones), `name_taken`, `fee_invalid`, text errors |
| `setZoneActive` | `id`, `isActive` | zone | same | `forbidden`, `not_found` |
| `savePolicyPage` | `slug`, `title`, `body`, `version` (int, as loaded) | `version`, `updatedAt` | same | `forbidden`, `not_found`, `stale`, text errors |

Each action calls `revalidatePath` for `routes.admin.settings` (and `routes.admin.policy(slug)` for `savePolicyPage`), following the other dashboard actions, to clear the browser router cache. The live policy page renders per request, so it needs none.

`saveShopContact` updates `where id = 1` and leaves `home_version` alone. `name_taken` comes from catching the unique violation (code 23505) on `delivery_zones.name`; Zod cannot see other rows. `addZone` reads the count and inserts in one transaction.

Reads:
- `getShopContact()` (`src/features/shell/server/shop-contact.ts`) also selects `whatsapp_number`, in the same single cached read with the same 1.5 second limit. `ShopContact` gains `whatsappNumber: string | null`, and `noContact` gains `whatsappNumber: null`. `contactLine` ignores the new field, so the footer is unchanged.
- A new `getWhatsappNumber()` returns `(await getShopContact()).whatsappNumber ?? parsePublicEnv().whatsappNumber`. A failed or slow read gives `noContact`, so it falls back to env.
- `getPolicyPage(slug)` reads one `pages` row.
- `getSettingsPage()` reads contact, all zones, and the three pages' slug, title, and `updated_at` for the hub.

Routes (in `src/lib/routes.ts`): `routes.admin.settings` and `routes.privacy`, `routes.terms`, `routes.returns` already exist, and the sidebar already links settings (`src/features/shell/nav.ts`). Add:
- `routes.admin.policy(slug)` → `/admin/settings/policies/${slug}`
- a `policySlugs` tuple (`privacy`, `terms`, `returns`) and `routes.policy(slug)`, which returns the existing strings. The tab row and the hub use `routes.policy(slug)`; the footer, menu, and checkout keep their named routes.

Pages:
- `src/app/[locale]/policies/[slug]/page.tsx`
- `src/app/admin/(dashboard)/settings/page.tsx`
- `src/app/admin/(dashboard)/settings/policies/[slug]/page.tsx`

**Markdown rendering**: one `PolicyBody` component in `src/features/policies/components/policy-body.tsx` (no `server-only`, so the editor preview can import it) wraps `react-markdown`:
- `remarkPlugins: [remarkBreaks]`, and no `rehype-raw` and no GFM
- `allowedElements` set to the AC-9 list, with `unwrapDisallowed`
- `components` maps `h1`/`h2` to the styled `h2`, and `h3` to `h6` to `h3`
- a `urlTransform` keeps only `https:`, `mailto:`, `tel:`, and paths starting with `/`

The `urlTransform` and component map are defined inside that module, never passed as props, since a function cannot cross from a Server to a Client Component. The live page renders it in a Server Component (no JS shipped). The editor preview loads it with `next/dynamic` (admin bundle only). Styling uses the tokens in `tokens.css`: h2 16/800, paragraph 14 with line height 1.8 (policy board). After the first build, check the Worker bundle size (`react-markdown` and its unified parser add roughly 100 KB).

**WhatsApp number wiring**: replace every server side `parsePublicEnv().whatsappNumber` with `await getWhatsappNumber()`, and pass it down as the prop the client parts already take. Today those reads are in:
- `src/app/[locale]/layout.tsx`
- `(home)/page.tsx`
- `c/(index)/page.tsx`
- `cart/page.tsx`
- `checkout/done/[number]/page.tsx`
- `orders/[number]/page.tsx`
- `p/[slug]/page.tsx`
- `src/features/catalog/components/category-page.tsx` (both places)
- `src/features/catalog/components/search-page.tsx` (both places)

Run `grep "parsePublicEnv()"` at build time to catch any added since, and give any quick order or draft screen that builds a `wa.me` link the number as a prop from its server page. `parsePublicEnv()` keeps its build time check and stays the only WhatsApp source in `error.tsx` and the design gallery. Its `siteUrl` reads (for example `accounts/server/actions.ts`) are unchanged.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| storefront `wa.me` links | WhatsApp number | `shop_settings.whatsapp_number`, else `NEXT_PUBLIC_WHATSAPP_NUMBER` (also on null, failed, or slow read) |
| `error.tsx` | WhatsApp number | `NEXT_PUBLIC_WHATSAPP_NUMBER` only (a client boundary cannot read the database) |
| contact card | number shown in the field | `shop_settings.whatsapp_number` ?? env value |
| `saveShopContact` | stored WhatsApp digits | input, through `toWesternDigits`, with spaces, `+`, `-`, `(`, `)` removed, then the AC-2 check order and `/^[1-9]\d{7,14}$/` |
| `saveShopContact` | stored phone | input, tidied (`tidyText`, Arabic digits made Western), only digits, spaces, `+`, `-`, `(`, `)`, and 7 to 15 digits once stripped; stored tidied; empty → null |
| `saveShopContact` | stored address | input, `addressText` (spec 0005, its own length rule) made optional, empty → null |
| zone name, short name | stored text | input, `tidiedText` (spec 0005), 1 to 40 and 1 to 12 chars |
| zone fee (input value) | shekels | `delivery_zones.fee / 100` |
| zone fee (stored) | agorot | input `feeShekels`, through `toWesternDigits`, a whole number 0 to 500, × 100 |
| zone fee (shown) | `₪20` | `delivery_zones.fee` through `formatPrice` |
| `addZone` | `sort` | `coalesce(max(sort), 0) + 1` over all zones; ties are ordered by `name` |
| `addZone` | limit | `count(*)` of `delivery_zones`, refused at 10 |
| Home fee line | zone short names and fees | active `delivery_zones` (spec 0011, unchanged) |
| checkout zone list and fee | zones | `readActiveZones()` (spec 0004, unchanged) |
| policy page | title, body | `pages.title`, `pages.body` |
| policy page and hub | "آخر تحديث" date | `pages.updated_at` through `formatDate` (`Asia/Hebron`); seeded pages show the migration date until first saved |
| policy page | WhatsApp button label, message | `Shell.menuWhatsapp`; new `Policies.whatsappMessage` |
| policy page `<title>` | text | `{pages.title} \| S.K.F Lighting` |
| editor | loaded version | `pages.version`, read with the row |
| `savePolicyPage` | stale or not | `UPDATE pages SET ..., version = version + 1 WHERE slug = $slug AND version = $version RETURNING version, updated_at`; 0 rows with an existing slug → `stale` |
| checkout line | link targets | `routes.terms`, `routes.returns` |

**Key invariants**:
- The WhatsApp link target is never empty: database value, else the env value, which the build already requires.
- `pages` holds exactly the three slugs (check plus unique). Title and body are never empty after a save.
- A zone fee is always 0 to 50000 agorot in whole shekels (database check plus Zod).
- A zone row is never deleted (orders reference it). Pausing never changes a placed order.
- A policy save never overwrites an edit it did not load: `version` matches or nothing is written (AC-11).
- At most 10 delivery zones.
- Contact and zone saves are last write wins (short values, easy to spot).

**Security model**: only the owner (role `admin` at `aal2`) reads `/admin/settings` and its editors and calls the five actions; each runs `requireAdmin()` and then `getVerifiedUser()` before writing. The storefront reads are public shop data through Drizzle on the server; the browser never queries the database. RLS stays on, including the new `pages` table, with no grants to `anon` or `authenticated` (`pnpm db:check-rls`). There's no customer data here; the shop's own phone and address are public by design. Policy text is owner written but still rendered through the AC-9 allow list, so a pasted script or `javascript:` link can't run on the storefront. The actions sit behind the admin session, so they need no extra rate limit. Logs name the failure, never the values.

**Configuration required**: no new variables. `NEXT_PUBLIC_WHATSAPP_NUMBER` stays required and becomes the fallback. Update its description in spec 0001's settings table and `.env.example`. New dependency: `react-markdown`, at the current major.

**Critical test scenarios**:
- Unit: the WhatsApp normalizer (empty, `+970 599-123-456`, Arabic digits, leading `0`, 7 and 16 digits, in the AC-2 order), the fee parser (empty, 0, 500, 501, 12.5, `٢٠`), and the phone rule. `PolicyBody` drops raw HTML, an image, and a `javascript:` link, maps `#` to `h2` and `####` to `h3`, and turns a single newline into `br`. `readShopContact` with a read that times out gives `whatsappNumber: null`, so `getWhatsappNumber` falls back to env. These verify **AC-2**, **AC-4**, **AC-5**, **AC-9**.
- Database: the fee check refuses 50100 and 2050; the slug check refuses `about`; the three seeded pages exist, and the returns body mentions 7 days; `savePolicyPage` with an old `version` returns `stale` and changes nothing; `addZone` refuses the 11th zone; a duplicate name gives `name_taken`. These verify **AC-5**, **AC-6**, **AC-11**, **AC-14**.
- Happy path e2e (390px RTL): change the WhatsApp number, open Home and a product page, and every `wa.me` link has the new digits; change the West Bank fee to ₪25 and checkout shows ₪25. This verifies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-7**.
- Failure case: a fee changed while a checkout is open, then the send is refused with the fresh total, and the placed order keeps its old fee. This verifies **AC-7**.
- Fallback e2e: with `whatsapp_number` null, the links use the env number. The timeout case is covered by the unit test above. This verifies **AC-4**.
- Pause all zones, and checkout shows pickup only while Home shows no fee line. This verifies **AC-6**.
- Edit a policy, preview, save, and the live page shows the new text and today's date; a second tab's save is refused as stale. This verifies **AC-8**, **AC-10**, **AC-11**.
- Checkout line links open the terms and returns pages in a new tab. This verifies **AC-12**, **AC-13**.
- Auth: a signed in customer calling `saveZone` gets `forbidden`, and a visitor to `/admin/settings` is redirected. This verifies **AC-15**.

## Build plan

Tracer Bullet: the WhatsApp number goes end to end first (dashboard save → database → every storefront link), then zones, then policies.

1. Migration: the `pages` table with its check, unique slug, and `version`, the three seeded drafts, and the zone fee check (first confirm no zone row in production breaks it; only the two seeds should exist). Add `pages` to `content.ts` and the schema test, and run `pnpm db:check-rls`. Satisfies **AC-5**, **AC-14**.
2. Thin thread: add `routes.admin.policy`/`routes.policy`, the `/admin/settings` hub with only the contact card, the shared Zod schema and normalizer, and `saveShopContact`. Extend `getShopContact()` with `whatsapp_number`, add `getWhatsappNumber()`, and replace the storefront `parsePublicEnv().whatsappNumber` reads. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-15**.
3. Zones card: `saveZone`, `addZone`, `setZoneActive`, the rows with switch, the add form, and the all paused note. Satisfies **AC-5**, **AC-6**, **AC-7**.
4. Public policy pages: add `react-markdown`, then build `PolicyBody`, `getPolicyPage`, and `/policies/[slug]` with the tabs, the date, the WhatsApp card, metadata, and a 404 for other slugs. Satisfies **AC-8**, **AC-9**, **AC-13**.
5. Policy editing: the hub's policies card, the editor page with preview, the unsaved warning, and `savePolicyPage` with the stale check. Satisfies **AC-10**, **AC-11**.
6. Checkout line under the send button, with the new tab links. Satisfies **AC-12**.
7. Tests: unit tests beside each pure function, database tests for the checks and the stale save, and Playwright flows on a 390px RTL screen for the scenarios above. Satisfies **AC-1** to **AC-15**.

## Consequences

**Positive**:
- You change the number, fees, and policies yourself, and the change is live on the next page load.
- The WhatsApp button keeps working through a database hiccup and on the error page.
- Policies are safe to edit freely; nothing you paste can run code on the storefront.

**Negative / tradeoffs**:
- Every storefront page now does one more small column read. It's the same single row query the footer already makes per request, so the cost is a few bytes, not a new round trip.
- Two places can hold a WhatsApp number. If the database value is set, the env value still shows on the error page and whenever the settings read fails or takes over 1.5 seconds (a slow first database connection, for example). That's silent, so keep the env value equal to the dashboard number, or those customers reach an old number.
- `react-markdown` is a new dependency, and the editor preview ships it to the admin bundle.
- Contact and zone saves are last write wins; two people editing the same zone at once lose one edit.
- The starter drafts are not legal advice. You need to read and adjust them before launch.

**Neutral**:
- The boards' single page layout and fixed fee fields are replaced as listed under *Design source*.
- If Cache Components is turned on later (spec 0001), these reads need cache tags that the actions invalidate.

## Follow-up

- [ ] Enroll a small feature for the owner profile card (display name plus a circle photo on Home), parked by spec 0011 and the settings board pending approval (O-28).
- [ ] Before go live (feature 30): you read and correct the three policy drafts, set the WhatsApp number in the dashboard, and set `NEXT_PUBLIC_WHATSAPP_NUMBER` to the same number (the fallback).
- [ ] Update spec 0001's settings table row for `NEXT_PUBLIC_WHATSAPP_NUMBER` ("fallback since spec 0025") and close the spec 0003 follow-up about moving the number.
- [ ] Feature 28 (search engine visibility) adds descriptions and share images for the policy pages; this spec sets only the title.
- [ ] Electrician quick order and draft sending (features 20, 21) don't pass through `/checkout`; decide later whether they need the same policy line.
- [ ] You declined an Agent Skill search for `react-markdown` during this design; record it on the `AGENTS.md` `Declined:` line during `/sync` so it isn't offered again.
- [ ] `shop_settings.email` stays unused; the settings board shows it, and it can join the contact card later as a small change.
