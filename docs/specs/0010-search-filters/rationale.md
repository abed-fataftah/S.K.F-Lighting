# 0010. Search and filters: rationale

## Context

The shop's header already has a search field that submits `GET /search?q=`, and the bottom bar has a بحث tab, but there is no page behind them. Category pages (spec 0008) list products with paging, but customers can't narrow them. Scope feature 11 asks for search by product name or code, and filters by price, size, and colour. A product code must find the exact product, Arabic names must match however they are spelled, filters must combine and show in the page address so a filtered list can be shared, and no results must show a helpful empty state.

The forces. Customers are on phones, in Arabic, and type the same word many ways (with or without hamza, `ة` or `ه`, diacritics, Arabic or Western digits, sometimes from a Persian keyboard). Spec 0005 already built and tested `normalizeForSearch`, the one folding rule, in TypeScript. Electricians reorder by codes copied from boxes or WhatsApp, and option codes (one per size and colour pair) are printed too. The catalog is expected to stay under 2,000 products in its first year. Spec 0001 chose Postgres search before any separate search engine. Sizes are free text per option, so the same size can be spelled several ways across products, while colours come from one shared table. The shop runs on Cloudflare Workers with Postgres through Hyperdrive and no read cache, and every page is rendered per request.

The design exists for the phone: `pages/search.md` and the filters screen in `pages/category.md`, including a live "عرض N منتج" count on the apply button. Filtered lists must not become a pile of near duplicate pages for search engines.

Not deciding leaves the header search pointing at a missing page, and leaves category lists with no way to narrow beyond the sub chips.

## Options considered

### Option 1: Postgres substring search on stored, app folded columns

Add `products.search_text` and `product_variants.size_key`, written by the app with `normalizeForSearch` inside the product save transaction (and once by a backfill). Search is `search_text like '%word%'` for every word, with a four tier `case` for ordering. Filters are an `exists` over one option. Pages stay server rendered. A small route handler serves the live count.

**Pros**:
- One folding implementation, the tested TypeScript one; the database just compares folded text.
- Plain SQL with no extension or index; a scan of 2,000 short strings is a few milliseconds.
- Size grouping becomes a column the database can filter and group by directly.

**Cons**:
- Two stored derived columns that a careless future write path could leave stale (mitigated by one helper in the save transaction and a backfill on every deploy).
- A one time backfill, and a CI step to keep it running.

### Option 2: A SQL twin of the folding, kept by triggers

Write a Postgres function that copies `normalizeForSearch` (NFKC, mark removal, letter folds, digits), and triggers on `products` and `product_variants` that keep the two columns fresh on any write, with a parity test running both versions over the same cases (the pattern the shop already uses for the sellable rule).

**Pros**:
- The columns can never go stale, even after a direct edit in the Supabase dashboard.
- No backfill script in CI; the migration fills the columns itself.

**Cons**:
- Two implementations of tricky Unicode rules (NFKC presentation forms, mark ranges, the U+FC5E case) that must stay identical; a mismatch silently loses matches.
- Triggers across two tables (an option code change must rewrite the product's text) are hidden logic the rest of the codebase doesn't use for data.

### Option 3: Fold at query time, no stored columns

Fold the query in TypeScript and fold the product text in SQL on every search with the same SQL twin as Option 2, with no migration.

**Pros**:
- No schema change and nothing to keep fresh.

**Cons**:
- Still needs the SQL twin of the folding, with all of Option 2's parity risk.
- Every search and every count call folds every product's text again; the size filter would fold every size label on every request.

### Option 4: Postgres full text search (`tsvector` with the Arabic configuration)

Store a `tsvector` of name and codes, and match with `websearch_to_tsquery('arabic', q)` and `ts_rank`.

**Pros**:
- Built in stemming and ranking, and a GIN index from the start.

**Cons**:
- The Arabic stemmer folds differently from `normalizeForSearch`, so the shop would have two meanings of "the same word".
- Weak at partial codes and short tokens (`L-1`, `60`), which are exactly what electricians type.
- More moving parts (configuration, ranking weights) than a 2,000 product catalog needs.

## Rationale

The deciding force is that the shop already owns one carefully tested Arabic folding rule in TypeScript, and every other option either duplicates it in SQL (2 and 3) or replaces it with a different one (4). Arabic folding has sharp edges (spec 0005 needed a special case for a single presentation form), and two copies drifting apart fails silently: a customer just doesn't find the product. Writing the folded text from TypeScript keeps one rule. The staleness risk it brings is real but narrow: names, codes, and size labels change only through `saveProductInDb` (the editor and the import both go through it), so one call at the end of that transaction covers every path that exists today. Running the backfill on every deploy repairs anything that slips past it.

Substring matching over a stored column fits the scale and the queries. Under 2,000 products, a sequential scan is cheaper to run and reason about than an index, and `like '%word%'` handles partial codes and short words that full text search handles badly. The four tiers give the one ordering that matters most: an exact code first, then codes starting with it, then names starting with the query. Typo tolerance (trigram similarity) was considered and left out, because on short Arabic words it adds noise and tuning, and the folding already absorbs the common spelling variants. If the catalog grows, a `pg_trgm` GIN index speeds the same `like` queries without changing them.

For filters, matching all chosen values against one single option (not across options) prevents showing a pair the shop can't sell, at the cost of one `exists` subquery. Keeping the state only in the address (no client store) makes sharing, back and forward, and old links work for free. That is also why unknown values are dropped rather than rejected. The live count goes through a GET route handler instead of a Server Action because Server Actions run one at a time over POST, while a count wants parallel, abortable reads. It shares the page's parser and query builder, so the number on the button can't disagree with the page. The handler is the one new public endpoint that a script could hammer, so it gets the same Workers rate limit binding pattern as order placement (spec 0004), failing open so a broken limiter never blocks shopping.
