# 0010. Search and filters

**Date**: 2026-10-25
**Status**: In Progress

## Summary

Customers get a real `/search` page that finds products by name, product code, or option code. It forgives Arabic spelling differences, and it puts an exact code at the top. Category pages and search results also get the designed filters screen (price, size, colour, and an "available only" switch). The filters live in the page address, so a filtered list can be shared on WhatsApp. Search runs inside Postgres on a stored, folded copy of each product's text (two small columns the app keeps fresh when it saves a product), so there is no new service to run.

## Requirements

**User stories**:

- As a customer, I want to type a product name the way I spell it, with or without hamza or diacritics, and find the product, so I don't have to guess the shop's spelling.
- As an electrician or a returning customer, I want to type or paste a product or option code and see that exact product first, so reordering is quick.
- As a customer on a phone, I want to narrow a category or my search results by price, size, and colour, so I see only what fits my room and budget.
- As a customer, I want to send a filtered list to someone on WhatsApp, and have it open the same way for them.
- As a customer, I want a helpful message and a WhatsApp way to ask when nothing matches, so I'm never stuck.

All storefront reads live under `src/features/catalog/server/` and import `server-only`. The pure rules (query folding, words, relevance tier, filter parsing and serializing, size keys, choice order) live beside them in `src/features/catalog/` with Vitest tests. Every string goes in `ar.json` (new `Search` and `Filters` namespaces), every number and price through `src/lib/format.ts` and `src/lib/money.ts`, every link through `routes`. Logs name the event and what failed, never the query text or filter values.

**Acceptance criteria**:

- **AC-1**: Search page address. `/search` is a public storefront page (`src/app/[locale]/search/page.tsx`) that reads `q` (first value when repeated) and the filter params (AC-8). With no `q`, or a `q` shorter than 2 characters after folding (AC-2), it shows the **prompt**: `h1` "البحث", the hint "اكتب اسم المنتج أو الكود", the note "اكتب حرفين على الأقل" when a too short `q` was given, and the help card (W2). No product read runs. On the prompt only, the header search field is focused on load (results never autofocus, so the phone keyboard does not cover them). The bottom bar tab بحث is active (already true in `activeTab`). On `/search` the header search field shows the current `q`: the field becomes a small client part of the header that reads `useSearchParams().get("q")` when the path is `/search`, wrapped in `Suspense` with the empty field as its fallback, so the layout stays a server component.
- **AC-2**: Query rules. The raw `q` is cut to its first 100 characters (by code point) and tidied (spec 0005 `tidyText`, single line). That text is what the page shows and what links carry. The **folded query** is `normalizeForSearch(q)`. A search runs only when the folded query has at least 2 characters (the whole query, not each word; a short word such as `1` inside a longer query is allowed and accepted). Its **words** are the folded query split on spaces, duplicates removed, at most the first 8 kept. `normalizeForSearch` gains two folds, Persian `ی` (U+06CC) into `ي` and Persian `ک` (U+06A9) into `ك`, placed with the other letter folds. It stays idempotent, and the spec 0005 tests gain these two cases.
- **AC-3**: What matches. A result is a **listed** product (spec 0008 AC-10: `active`, any availability, in a shown category) whose `search_text` contains **every** word as a substring, in any order. Each word is passed to SQL as a `like` pattern with `%`, `_`, and `\` escaped (`escape '\'`), never concatenated into SQL. `hidden` and `archived` products and products in a category that is not shown never match. `normalizeForSearch("إنارةُ")` matches a product named "انارة". A product whose option code is `L-102-GD` is found by `L-102-GD`, `l-102`, or `102` (all substrings of its folded `search_text`). `L 102` is two words, so it matches any product whose text contains both `l` and `102`.
- **AC-4**: Result order. Results sort by tier, then in stock first (`listedInStock`, spec 0008), then `created_at desc`, then `id desc`. The tiers are computed against the **code query**, the folded query uppercased (`foldedQuery.toUpperCase()`, so a pasted code with full width or presentation characters folds the same way as `search_text`; stored codes are already `upper(btrim)` by their check constraints): tier 0 when `products.code` or the `code` of any option of the product with `archived_at is null` equals the code query; tier 1 when either starts with it; tier 2 when `search_text` starts with the whole folded query (the name comes first in `search_text`, AC-7); tier 3 otherwise. Typing an exact product code puts that product first.
- **AC-5**: Results page. Per design `pages/search.md`: `h1` "نتائج البحث"; a muted line "M نتيجة للبحث عن «q»" inside a `role="status"` region; a row with the filter button (AC-11) and a removable query chip labelled with `q`, whose × is a link to `/search` (the prompt) with `aria-label` "إزالة البحث <q>"; the applied filter chips row (AC-13) when filters are active; the product grid with the shared product card (spec 0008 AC-12, unchanged); "تم عرض N من M نتيجة" and "عرض المزيد"; the help card (W2). Paging works like spec 0008 AC-11: 24 per step, `?page=N` clamped before the limit is built, cards `id="p-<position>"`, "عرض المزيد" links to page N+1 with `#p-<N × 24 + 1>` and keeps `q` and every filter, and focus moves to that card's name link.
- **AC-6**: Search states. No results: the empty card with the title "لا توجد نتائج لـ «q»", the line "جرّب كلمة أخرى أو الكود، أو اسألنا عبر واتساب.", a yellow "مسح التصفية" button (a link to the same search without filters) only when filters are active, and the green "اسألنا عبر واتساب" button (W2). The filter button and query chip stay. A failed or slow read (3 seconds, `withTimeLimit`) shows the page error card from spec 0008 AC-13 ("تعذّر تحميل المنتجات", retry, "اطلب عبر واتساب"); the toolbar and applied row are hidden, and the log says `{"event":"search_read_failed"}` with no query. Loading (`loading.tsx`) shows the title area and six skeleton cards in `role="status"` with the hidden text "جارٍ تحميل النتائج".
- **AC-7**: Stored search keys. `products.search_text` (text, not null, default `''`) holds `buildSearchText`: the folded name, the folded product code, and the folded codes of the product's options with `archived_at is null` (in `sort` order), joined by single spaces, with empty parts left out. Today no path writes option codes (spec 0006: `product_variants.code` stays null; only the dev seed sets them), so in production `search_text` is name plus product code until a later feature fills option codes; that feature must write them inside a transaction that calls `refreshSearchKeys`. Database tests that need option codes insert them directly, then call `refreshSearchKeys`. `product_variants.size_key` (text, null) holds `sizeKey(size_label)`: `normalizeForSearch(size_label)` with every space removed, or null when `size_label` is null or folds to empty. One helper, `refreshSearchKeys(tx, productId)` in `server/search-keys.ts`, reads the product's name, code, and options inside the caller's transaction, and writes both columns. It runs as the last step inside `saveProductInDb`'s transaction (so the editor save and the spreadsheet import both refresh), in `scripts/seed-dev.ts`, and in the database test helper in `src/server/db/testing.ts`. Archiving and restoring a product, and photo changes, don't call it (they change none of the inputs; archived options already drop out of `buildSearchText` on the next save, and every read filters `archived_at`). `pnpm db:backfill-search` (`scripts/backfill-search.ts`) recomputes both columns for every product in batches of 200, writing only rows whose value differs, and prints how many it changed. It is idempotent. The CI deploy job runs it right after `pnpm run deploy` on `main` (after the deploy, not between migrate and deploy, so no old code can save a product unrefreshed after the backfill ran), and you run it locally after `pnpm db:migrate`. Until it runs, the new columns are `''` and null, so search finds nothing new for a few seconds after a first deploy; accepted.
- **AC-8**: Filters in the address. Params: `size` (repeated, each a size key), `colour` (repeated, each a colour `name` exactly as stored), `min` and `max` (whole shekels), `available=1`, plus `q` on search and `page`. `parseListFilters(searchParams)` is pure and never throws. It runs `tidyText` and `toWesternDigits` on each value; it drops empty values and duplicates, and keeps at most 20 sizes and 20 colours; it reads `min` and `max` as whole numbers from 1 to 999999 (anything else is dropped, so `min=0`, `min=abc`, and `min=12.5` all drop); it swaps `min` and `max` when `min > max`; it treats any `available` value other than `1` as off. The pure parse is followed by one server step, `resolveFilters(parsed, choices)`, which keeps only the sizes whose key and the colours whose name are among the list's choices (AC-10) and maps each kept colour name to its `colours.id`; everything else is dropped, so an old shared link always opens to a useful list. The page and the count route (AC-12) both run parse then resolve, and the SQL only ever sees resolved values. "A filter is active" always means the **resolved** filters have at least one size, colour, `min`, `max`, or `available` (an address whose every filter was dropped is an unfiltered list); `available=1` alone is an active filter with its own chip. `serializeListFilters` writes them back in a fixed order (`q`, `size`, `colour`, `min`, `max`, `available`, `page`), with page 1 and empty values left out. Every filtered link is built through `routes` from that one serializer. Parsing then serializing is stable (a round trip gives the same address).
- **AC-9**: Filter meaning. With any of `size`, `colour`, `min`, `max`, or `available` active, a product matches only when **one single option** of it satisfies all of them together: its `size_key` is one of the chosen sizes (when sizes are chosen), its `colour_id` is one of the chosen colours (when colours are chosen), its `price` is at least `min × 100` and at most `max × 100` agorot (inclusive, when given), and it is **live** (`archived_at is null`), or **sellable** (the spec 0008 one sellable rule, product and option both available) when `available=1`. Several choices inside one filter mean either one; different filters must all hold. With no filter active, the list is exactly as today (spec 0008 AC-10 for categories, AC-3 for search). The order doesn't change with filters (category: in stock first, then newest; search: AC-4). The card still shows the product's own list price and adds its card variant (spec 0008 AC-12), even when that is not the option that matched.
- **AC-10**: Filter choices. The filters screen offers the choices found in the **unfiltered list** it belongs to (the category page's listed products, or the search's matches), over options with `archived_at is null`, and they don't narrow as other filters are picked. **Sizes**: one chip per distinct `size_key`, labelled with the most common `size_label` among those options (a tie goes to the label that sorts first), ordered by the key's leading number (regex `^\d+(\.\d+)?` on the key, read as a decimal), keys with no leading number after all numbered ones, then by key as text. Examples: `2.5سم` before `60سم` before `60x40` (both 60, then text) before `120سم` before `صغير` before `كبير`. **Colours**: one chip per colour used, ordered by `colours.sort`, then `name`, each with an 18px dot filled with `hex`, or an outlined dot when `hex` is null. **Price**: the "من" and "إلى" placeholders are the list's lowest live price rounded down and highest rounded up, in whole shekels. A card with no choices (no sizes, or no colours) is hidden. A list with no products shows no filter button.
- **AC-11**: Filters screen. The filter button (outline, 44 high, `ListFilter` icon, "تصفية", with a yellow badge showing how many applied chips there are when any are active) opens a full screen dialog (shadcn Dialog on Base UI) with trapped focus and page scroll locked. Inside: a black top bar with the close button first in tab order and `h1` "تصفية المنتجات"; the السعر card with two text fields "من" and "إلى" (`inputMode="numeric"`, labelled, Arabic digits accepted); the الحجم and اللون cards of toggle chips with `aria-pressed`; a switch "المتوفر فقط"; and the bottom bar with "مسح الكل" (clears every choice and applies) and the yellow apply button "عرض N منتج" (search: "عرض N نتيجة"). The screen is a `GET` form to the current list address (hidden `q` on search). Its submit handler builds the filters from the form state, calls `router.push` with `serializeListFilters` (no `page`; empty price fields and unpressed chips are left out), closes the dialog, and returns focus to the filter button. Without JavaScript the native `GET` submit still applies them (the parser accepts the raw form fields). Closing without applying keeps the address unchanged. Sub category chips, "عرض المزيد", and every applied chip × keep the other filters in their links. After a chip × (a new page load), focus goes to the filter button.
- **AC-12**: Live count. While the screen is open, each change asks `GET /api/catalog/count` with the list's scope (`main` and `sub` slugs, or `q`) and the current choices, debounced 250 ms, aborting the request before it. The response is `{ "count": number }` with `Cache-Control: no-store`, and N updates in the button and in an `aria-live="polite"` status region that is rewritten only when N changes. Scope rules: `main` (with optional `sub`) or `q`, never both and never neither, and `sub` without `main`, give 400; `main`/`sub` resolve through the cached catalog tree exactly as the category page does (shown categories only; unknown or not shown gives 404); a `q` under 2 folded characters returns `{ "count": 0 }`. The tree read, the choices read, and the count all run inside one 1.5 second time limit (503 when over). On any failure (network, 400, 404, 429, 503), the button reads "عرض النتائج" and applying still works. The handler runs the same parse, `resolveFilters`, and list query builder as the pages, so the count always equals the M the page then shows; when every filter is dropped it returns the unfiltered count.
- **AC-13**: Category pages with filters. `/c/<main>` and `/c/<main>/<sub>` (spec 0008 AC-9) gain the toolbar (the filter button at the start, the count `M منتج` at the end in `role="status"`) and, when filters are active, the applied chips row: one removable chip per size (its label), per colour (its name), one for price ("من ₪X إلى ₪Y", or "من ₪X", or "حتى ₪Y"), and one for "المتوفر فقط". Each chip's × links to the address without that filter, with an `aria-label` naming it ("إزالة التصفية: <chip>"). After the chips comes the link "مسح الكل". M is the filtered count from SQL, and paging, the "تم عرض N من M منتج" line, and load more use it. When filters match nothing: the empty card "لا توجد منتجات مطابقة", the line "جرّب تغيير السعر أو اللون، أو امسح التصفية لرؤية كل المنتجات.", the yellow "مسح التصفية" link, and the green WhatsApp button (W2). The breadcrumb, `h1`, subline, and sub chips stay. A category with no listed products keeps spec 0008's empty state and shows no toolbar.
- **AC-14**: Search engines. `/search` (every form) has the title `نتائج البحث | S.K.F lighting`, `robots: noindex, follow`, and no canonical. A category page with any filter active carries `noindex, follow` and a canonical to the unfiltered category's page 1. An unfiltered category page keeps spec 0008 AC-16 exactly.
- **AC-15**: Count endpoint limit. `/api/catalog/count` is limited to 60 calls per 60 seconds per IP, through a new Workers rate limit binding `CATALOG_COUNT_RATE_LIMITER`, keyed like spec 0004 (`cf-connecting-ip`, else `local`). Over the limit it returns 429 with no read. A missing or throwing binding fails open, logging `{"event":"catalog_count_rate_unchecked"}` once per process outside production. Shoppers sharing one carrier IP share the limit; a 429 only turns the button label into "عرض النتائج", which is accepted. In `src/proxy.ts`, `api` joins the paths kept outside locale routing, and `/api/catalog/` paths also skip `refreshSession` (a public read needs no session, and the refresh adds a Supabase round trip to every count). The search and category pages are not rate limited (same as today's category pages).
- **AC-16**: Tests. Vitest beside the source for: `buildSearchText`, `sizeKey`, the two new folds, words and the folded query (length, cap, duplicates), `likePattern` escaping, the relevance tier function, `parseListFilters` and `serializeListFilters` (bad values, swap, caps, round trip), size choice label and order, applied chip list and badge count, and the count route's param handling and fail open limiter. Database tests: save and import refresh both columns (rename, size relabel, and an option code inserted directly then archived); a query containing `%`, `_`, and `\` matches only literally; the backfill changes only stale rows and is idempotent; search matches every word, ignores hidden, archived, and not shown products, and orders tiers 0 to 3; filters use one single option (60 cm in black plus gold in 80 cm does not match "60 cm and gold"), `available=1` excludes unsellable options, and price bounds are inclusive in agorot; the count equals the page's M for the same params. One Playwright flow on a phone sized RTL screen: search by an Arabic name typed with different hamza, search by an exact code (first card), load more on search, the prompt and the too short note, no results; on a category, open filters, see the live count change, apply size and colour, copy the address into a new page and see the same list, remove one chip, clear all; a filtered list with no match shows its empty state; axe passes on `/search` (prompt and results), a filtered category page, and the open filters screen.

## Decision

**Chosen option**: Option 1: Postgres substring search on stored, app folded columns, with filters as address params read by the same query builder

Search and filters run as plain SQL over two derived columns (`products.search_text`, `product_variants.size_key`) that the app writes with the already tested `normalizeForSearch` inside every product save. The pages stay server rendered, the filters screen is a small client dialog over a `GET` form, and one route handler serves the live count.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) for the migration, the `like` matching, and the option `exists` queries · `vercel-react-best-practices` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-best-practices/`) for server rendering with a small client dialog and the route handler · `vercel-composition-patterns` (`vercel-labs/agent-skills`, `.agents/skills/vercel-composition-patterns/`) for one list toolbar and filters screen shared by category and search · `shadcn` (`shadcn-ui/ui`, `.agents/skills/shadcn/`) for the full screen dialog, toggle chips, and switch · `wrangler` (`cloudflare/skills`, `.agents/skills/wrangler/`) for the new rate limit binding and `pnpm cf-typegen` · `playwright-cli` (`microsoft/playwright-cli`, `.agents/skills/playwright-cli/`) for AC-16

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

### Data model sketch

One migration (`drizzle/0006_search_filters.sql`, generated by `pnpm db:generate`) adds two columns. There are no new tables, no index, and no extension.

| Table | New column | Type | Null | Default | Holds |
|---|---|---|---|---|---|
| `products` | `search_text` | `text` | not null | `''` | `buildSearchText(name, code, live option codes)` (AC-7) |
| `product_variants` | `size_key` | `text` | null | none | `sizeKey(size_label)` (AC-7) |

Relationships are unchanged: product 1:N options (cascade), option N:1 colour (restrict), product N:1 category (restrict). Both columns are derived. They are written only by `refreshSearchKeys` and the backfill, never by a form. RLS stays on, with no grants (unchanged).

Columns read: `products` (`id`, `name`, `code`, `status`, `is_available`, `category_id`, `created_at`, `search_text`), `product_variants` (`product_id`, `code`, `size_label`, `size_key`, `colour_id`, `price`, `is_available`, `archived_at`), `colours` (`id`, `name`, `hex`, `sort`), and `categories` with its parent (the shown rule).

### State transitions

None. Search keys follow the product, refreshed on each save; the filter state is the address.

### Modules

| File | Kind | Holds |
|---|---|---|
| `src/lib/arabic.ts` | pure (changed) | `normalizeForSearch` gains the `ی` and `ک` folds (AC-2) |
| `src/features/catalog/search-text.ts` | pure | `buildSearchText`, `sizeKey`, `foldedQuery`, `queryWords`, `codeQuery`, `likePattern`, `searchTier` (the code twin used by tests to check the SQL tiers) |
| `src/features/catalog/list-filters.ts` | pure | `ListFilters` type, `parseListFilters`, `resolveFilters`, `serializeListFilters`, `appliedChips`, `withoutChip`, `sizeChoices` (label and order), `priceBounds` |
| `src/lib/routes.ts` | pure (changed) | `routes.searchPage(q, filters, page)`, `routes.searchMore(q, filters, page, position)`; `categoryPage` and `categoryMore` take an optional `filters`, all through `serializeListFilters` |
| `src/features/catalog/server/search-keys.ts` | server | `refreshSearchKeys(tx, productId)` |
| `src/features/catalog/server/list-query.ts` | server | `listWhere(scope, filters)` and `listOrder(scope)`, where `scope` is `{ kind: "category", categoryIds }` or `{ kind: "search", words, folded, code }`; the one place filters become SQL |
| `src/features/catalog/server/queries.ts` | server (changed) | `readCategoryProducts` and a new `readListTotal` use `listWhere`; `readSearchPage`, `readFilterChoices` |
| `src/app/[locale]/search/page.tsx`, `loading.tsx` | page | AC-1, AC-5, AC-6, AC-14 |
| `src/app/api/catalog/count/route.ts` | route handler | AC-12, AC-15 |
| `src/features/catalog/components/list-toolbar.tsx`, `filters-screen.tsx`, `applied-chips.tsx` | UI | shared by category and search |
| `scripts/backfill-search.ts` | script | `pnpm db:backfill-search` (AC-7) |

### API surface

| Name | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/search` | page (GET) | `q?`, `size[]?`, `colour[]?`, `min?`, `max?`, `available?`, `page?` | prompt, or results with M, N, cards, choices | public | read failure or timeout → error card |
| `/c/<main>[/<sub>]` (changed) | page (GET) | as today plus the filter params | as today plus toolbar, applied chips, filtered M, choices | public | unknown or hidden → 404 (spec 0008 AC-8) |
| `/api/catalog/count` | route handler (GET) | `main?` + `sub?` (slugs) or `q?`, plus the filter params | `200 { count }`, `Cache-Control: no-store` | public, rate limited | `400` neither or both scopes given, or `sub` without `main` · `404` category unknown or not shown · `429` over limit · `503` reads over 1.5 s |
| `resolveFilters` | pure | parsed filters, the list's choices | the filters with unknown sizes and colours dropped, colour ids attached | none | none (never throws) |
| `readSearchPage` | query | folded query, words, code query, `ListFilters`, page | `{ total, page, products: CardProduct[] }` | server only | timeout → caller shows error |
| `readFilterChoices` | query | `scope` | `{ sizes: { key, label }[], colours: { name, hex }[], price: { min, max } \| null }` | server only | as the page |
| `readListTotal` | query | `scope`, `ListFilters` | `number` | server only | as the caller |
| `refreshSearchKeys` | server helper | `tx`, `productId` | none (writes two columns) | runs inside admin save and import | throws on a bug only (rolls back the save) |

Read order for a category page or a search: (1) the head (spec 0008 `readCategoryHead` from the catalog tree, or the folded query for search); (2) `readFilterChoices(scope)`, then `resolveFilters`; (3) the total: the tree count when no filter is active on a category, else `readListTotal(scope, resolved)`; when filters are active, the head's `total` and `page` are replaced by this total and `clampPage` against it, before any limit is built; (4) the cards with `limit page × 24`. Steps 2 to 4 depend on each other and run in sequence, inside the page's existing 3 second time limit. The choices are read on every view (not lazily on dialog open) because the applied chips need the size labels; at this catalog size that is a conscious extra read.

### Value sourcing

| Action | Value produced / displayed | Source |
|---|---|---|
| `refreshSearchKeys` | `search_text` | `buildSearchText(products.name, products.code, codes of options with archived_at is null in sort order)` |
| `refreshSearchKeys` | `size_key` per option | `sizeKey(product_variants.size_label)` |
| backfill | changed row count | rows whose recomputed value differs from the stored one |
| `/search` | shown query text | `searchParams.q` first value, cut to 100 code points, `tidyText` |
| `/search` | folded query, words | `normalizeForSearch` of the shown query; words split on spaces, deduped, first 8 |
| `/search` | code query | `foldedQuery.toUpperCase()` |
| `/search` | prompt vs results | folded query length ≥ 2 |
| `/search` | tier | SQL `case` on the code query vs `products.code` and live option `code`, then `search_text like folded%` (AC-4) |
| `/search`, category | M | `readListTotal(scope, filters)` (category without filters: the tree count, as today) |
| `/search`, category | N | `min(page × 24, M)`, `page` from `parsePage` clamped to `max(1, ceil(M / 24))` |
| filters | parsed filters | `parseListFilters(searchParams)` (AC-8) |
| filters | known colours | `colours.name` of colours used by the list's live options (`readFilterChoices`) |
| filters | known sizes, their labels and order | distinct `size_key` over the list's live options; label is the most common `size_label`; order by the first number in the key, then the key |
| filters | price placeholders | `floor(min(price) / 100)` and `ceil(max(price) / 100)` over the list's live options |
| filters | option match | `exists` one option of the product with `size_key`, `colour_id`, `price`, and live or sellable all true together (AC-9) |
| filters | resolved filters, colour ids for SQL | `resolveFilters(parsed, choices)`: sizes and colour names kept only when among the list's choices, colour names mapped to the `colours.id` the choices read returned |
| filters | "a filter is active" | the resolved filters (AC-8), never the raw address |
| applied chips | chip text | size label from the choices, colour name, price through `src/lib/money.ts`, "المتوفر فقط" from `ar.json` |
| filter button | badge number | `appliedChips(filters).length` |
| filters screen | live N | `/api/catalog/count` response, else the "عرض النتائج" label |
| count route | scope | `main`/`sub` resolved through the cached catalog tree (shown categories only), or `q` folded as on the page; both or neither, or `sub` alone, is 400 |
| count route | rate key | `cf-connecting-ip` header, else `"local"` |
| card | everything on it | unchanged (spec 0008 AC-12) |
| metadata | robots, canonical | AC-14; canonical from `NEXT_PUBLIC_SITE_URL` + `routes.categoryPage(main, sub)` |

### Key invariants

- `search_text` and `size_key` always equal what `buildSearchText` and `sizeKey` give for the current row. They are written in the same transaction as any change to a name, a code, or an option's code or size label. The backfill proves it by changing 0 rows on a second run.
- Search and filters never show a product the category list would hide: every read starts from `listedProduct` (spec 0008).
- The count endpoint and the page use the same `parseListFilters`, `resolveFilters`, and `listWhere`, so N on the button equals M on the page.
- All filters on a product are checked against one option, never across options.
- User text reaches SQL only as bound parameters; `like` patterns are escaped.
- An address the parser cannot read never errors: it just drops the bad parts.

### Security model

Everything here is a public read of what the storefront already shows; no personal data is involved. The browser never queries the database. The page reads and the count handler run Drizzle on the server through `getDb()`. The only writes are `refreshSearchKeys`, which runs inside the owner only save and import (already behind `requireAdmin()` and `getVerifiedUser()`), and the backfill script (run by CI or locally with the direct connection). The count endpoint is rate limited per IP (AC-15). Query text and filter values are never logged, since a shopper might type a phone number into search. RLS stays on every table with no grants to `anon` or `authenticated`.

### Configuration required

- `CATALOG_COUNT_RATE_LIMITER`: a new `ratelimits` entry in `wrangler.jsonc` (`namespace_id` `"1011"`, `simple: { limit: 60, period: 60 }`), then `pnpm cf-typegen`. No new env vars or secrets.
- `package.json`: `"db:backfill-search": "tsx --conditions=react-server scripts/backfill-search.ts"`; `.github/workflows/ci.yml` deploy job: a step `pnpm db:backfill-search` right after `pnpm run deploy`, with the same database secret as `pnpm db:migrate`.
- Preview and E2E: the binding exists under `pnpm preview` (as `ORDER_RATE_LIMITER` does), so the 429 path is exercised with `E2E_TARGET=preview`; the fail open path by unit tests.

### Critical test scenarios

- Happy path search: a product "إنارة حديقة" with option code `GL-7-BK` is found by "انارة", by "حديقه انارة", and first by `gl-7-bk`, verifies **AC-2**, **AC-3**, **AC-4**, **AC-5**
- Happy path filters: on a category, choosing 60 cm and gold with "المتوفر فقط" shows only products with a sellable 60 cm gold option, the button's N equals the page's M, and the copied address opens the same list, verifies **AC-8**, **AC-9**, **AC-11**, **AC-12**, **AC-13**
- Stale keys: renaming a product, adding an option code, and an import update all change `search_text` in the same transaction; the backfill then changes 0 rows, verifies **AC-7**
- Failure: a shared link with an unknown colour, `min=abc`, and `max` below `min` opens a working list with the colour dropped and the prices swapped; a count call during a slow read gives 503 and the button falls back to "عرض النتائج", verifies **AC-8**, **AC-12**
- Abuse: the 61st count call in a minute from one IP gets 429; a missing limiter fails open, verifies **AC-15**
- Hidden: a product in a hidden category, a `hidden` product, and an archived option's code are never found, verifies **AC-3**

## Build plan

Tracer Bullet: the first task carries one real search from the migration, through a product save, to a results card on `/search`. The later tasks thicken ordering, states, and then the filters, which are shared by both list kinds.

1. **Thin thread: stored keys to a first result.** The migration adding `search_text` and `size_key`; the `ی` and `ک` folds; `search-text.ts` with tests; `refreshSearchKeys` called at the end of `saveProductInDb` (editor and import), in `seed-dev.ts`, and in the test helper; `scripts/backfill-search.ts`, the `db:backfill-search` script, and the CI step after deploy; `/search` with the prompt and a plain every word match over listed products, newest first, showing the shared card. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-7**
2. **Search done properly.** The tier order, the code query, `likePattern` escaping, the count line, the query chip, paging with load more and focus, no results, error and loading states, the header field holding `q`, and the search metadata. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-14** (search part)
3. **Filters in the address.** `list-filters.ts` with tests; the `routes` builders; `list-query.ts` (`listWhere`, `listOrder`) used by the category read, `readListTotal`, and the search read; the toolbar with the count, the applied chips and "مسح الكل", sub chips and load more keeping filters; the filtered empty state; filtered category metadata. The filter button can link to a plain fallback until task 4. Satisfies **AC-8**, **AC-9**, **AC-13**, **AC-14** (category part)
4. **Filters screen.** `readFilterChoices` and the size choice rules; the full screen dialog with price fields, size and colour toggle chips, the available switch, clear all and apply as a `GET` form, and focus return; used on category and search. Satisfies **AC-10**, **AC-11**
5. **Live count.** `api` outside locale routing and `/api/catalog/` skipping the session refresh in `src/proxy.ts`; the `CATALOG_COUNT_RATE_LIMITER` binding and `cf-typegen`; `/api/catalog/count` with shared parsing, the 1.5 second time limit, and the fail open limiter; the debounced, aborting client fetch with the fallback label. Satisfies **AC-12**, **AC-15**
6. **Finish.** The database tests that are left, the full phone flow, axe on the four screens, and `E2E_TARGET=preview` for the limiter. Satisfies **AC-16**

## Consequences

**Positive**:

- One folding rule (the tested TypeScript one) drives search. Nothing needs to stay in step with a SQL copy.
- No new service, extension, or index. At under 2,000 products a full scan of one short text column takes a few milliseconds.
- Shared links carry the full list state, and old links degrade gracefully instead of breaking.
- Category and search share one toolbar, one filters screen, one parser, and one query builder.

**Negative / tradeoffs**:

- Option codes are in the design but empty in production today (spec 0006 never sets them), so search by option code starts working only when a later feature fills them.
- `search_text` and `size_key` are stored derived values. Any future code path that writes a product name, code, option code, or size label without calling `refreshSearchKeys` makes them stale. The rule lives in `saveProductInDb`, and the backfill (run after every deploy) repairs any drift, but a direct SQL edit in the Supabase dashboard stays stale until the next deploy.
- Substring matching with no ranking beyond the four tiers: a long query of common words can return many loosely related products, and a typo finds nothing (no typo tolerance by decision).
- Filtering matches one option, but the card still shows the product's lowest price and adds its card variant. A shopper filtering 100 to 200 ₪ can see "من ₪50" on a card. The product page, opened from the card, still lets them choose the matching option.
- Fixed choices can lead to a dead end (60 cm and gold with no such pair). The live count shows it before applying, and the empty state offers "مسح التصفية".
- Every filtered page and every search is a fresh, uncached server render with three to four reads.
- When the shop grows past a few thousand products, search will need a `pg_trgm` GIN index (a new migration, no code change to the matching).

**Neutral**:

- Spec 0005's open item on Persian letters is decided here (fold them).
- The design's proposed `color`, `price_min`, and `price_max` names become `colour`, `min`, and `max` (British spelling, as in the schema, and shorter links).
- Zero result searches are not recorded. Feature 29 (stats) can add that with its own retention rules.

## Follow-up

- [ ] Add a `pg_trgm` GIN index on `products.search_text` in a new migration if search reads grow past about 50 ms at the 95th percentile, or the catalog passes about 5,000 products.
- [ ] Option codes: if a later feature lets the owner or the import set `product_variants.code`, it must write them inside a transaction that calls `refreshSearchKeys`.
- [ ] Feature 29 (stats): consider recording zero result searches (folded query, count, last seen) so the owner sees what customers looked for.
- [ ] Design open item O-1 (desktop layout): the filters screen as a side column on wide screens is not designed; it uses the phone layout centred until then.
- [ ] Spec 0009's follow-up "breadcrumb back to the category with its filters" is closed as not needed: the browser's back button returns to the filtered address.
