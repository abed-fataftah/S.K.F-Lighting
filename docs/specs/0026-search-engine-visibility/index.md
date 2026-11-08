# 0026. Search engine visibility

**Date**: 2026-11-06
**Status**: In Progress

## Summary

Search engines and chat apps learn about the shop from three things this spec adds or completes: a `robots.txt` (the file that tells crawlers what they may read), a `sitemap.xml` (the list of every public page), and share tags (Open Graph, the tags WhatsApp and Facebook read to draw a link preview). Product, category, and breadcrumb tags already exist from specs 0008, 0009, and 0010. This spec fills the gaps: a share image and preview on every public page, a home title that names Hebron, a Store block for local search, policy page descriptions, and a host check so `workers.dev` preview builds never get indexed. There is no database change and no new env var.

## Requirements

New code lives in `src/features/seo/`. Pure builders sit at the top of the folder and are unit tested without mocks. The one database read sits in `src/features/seo/server/` and imports `server-only`. Every string goes in `ar.json` (a new `Seo` namespace), every link through `routes`, every absolute address from `parsePublicEnv().siteUrl`. The existing helpers stay where they are and are reused: `serializeJsonLd` and `breadcrumbJsonLd` in `src/features/catalog/seo.ts`, `productJsonLd` and `metaDescription` in `src/features/catalog/product-seo.ts`, `mediaObjectUrl` in `src/lib/media-url.ts`, and the `listedProduct` and `categoryShown` rules in `src/features/catalog/server/storefront-sql.ts`.

**Words used below.** The *production host* is the host part of `NEXT_PUBLIC_SITE_URL` (for example `skf.example`). An *indexable page* is one of: home `/`, the categories list `/c`, an unfiltered category or subcategory page 1, a product page `/p/<slug>` with no `?v`, and a policy page `/policies/<slug>`. The *shop image* is `public/brand/share.png`.

**User stories**:
- As a customer searching Google for lighting in Hebron, I want to find the shop and its products in Arabic so that I can buy from it.
- As a customer sharing a product on WhatsApp or Facebook, I want the link to show the product's photo, name, and a short description so that the person I send it to knows what it is.
- As the owner, I want new products to reach search engines without me doing anything, and my dashboard, orders, and preview builds to stay out of search results.

**Acceptance criteria**:
- **AC-1**: On the production host, `GET /robots.txt` answers 200, `text/plain; charset=utf-8`, with exactly these lines (the address built from `siteUrl`):
  ```
  User-agent: *
  Allow: /
  Disallow: /admin
  Disallow: /auth
  Disallow: /api
  Disallow: /design-system
  Sitemap: https://<production host>/sitemap.xml
  ```
  The `noindex` pages (account, cart, checkout, orders, search) are not disallowed, so crawlers can still read their `noindex` tag.
- **AC-2**: On any other host (a `workers.dev` preview, a branch preview):
  - `GET /robots.txt` answers 200 with only `User-agent: *` and `Disallow: /`.
  - `GET /sitemap.xml` answers 404.
  - Every response that passes through `src/proxy.ts` carries `X-Robots-Tag: noindex, nofollow`, on every return path. The two route handlers set the same header themselves, since the proxy matcher skips paths with a dot.

  On the production host, no response carries `X-Robots-Tag`. Hosts are compared after lowercasing and dropping a trailing dot and a default port (`:443`, `:80`). `www.<domain>` counts as not production (Cloudflare redirects it to the bare domain anyway). Localhost counts as production when `NEXT_PUBLIC_SITE_URL` points at it (dev and e2e). A preview deployed to a custom domain while carrying the production `NEXT_PUBLIC_SITE_URL` would be indexable; previews must keep their own `NEXT_PUBLIC_SITE_URL`.
- **AC-3**: On the production host, `GET /sitemap.xml` answers 200, `application/xml; charset=utf-8`, as one standard `urlset` with one `<url>` per page:
  - home `/` (no `lastmod`)
  - the categories list `/c` (no `lastmod`)
  - every category and subcategory that passes `categoryShown` and holds at least one `listedProduct`, by the same rule the category page lists by: a main counts products placed on it plus those in its shown subs, never a hidden sub's; a sub counts its own (`lastmod` = the category's own `updated_at`, which does not move when its products change)
  - every product that passes `listedProduct`, in stock or not (`lastmod` = the product's `updated_at`)
  - each of the three policy pages that has a `pages` row whose slug passes `isPolicySlug` (`lastmod` = the row's `updated_at`)

  Each `<loc>` is absolute, built as `siteUrl + routes.*` (path segments are already percent encoded by `routes`), and XML escaped. Each `lastmod` is the UTC timestamp in W3C format (`2026-11-06T09:30:00.000Z`). No `priority` and no `changefreq`. Hidden or archived products, products in a hidden category, hidden categories, and filtered or paged addresses never appear.
- **AC-4**: The sitemap is built live from the database on every request, so a product the owner adds, hides, or archives shows up in (or leaves) the next fetch. The response carries `Cache-Control: public, max-age=3600` (a hint for crawlers; nothing on the Worker caches it). The three reads (products, categories, pages) run together under one `withTimeLimit` of 3 seconds; if any one fails or the limit passes, the answer is 503 with `Retry-After: 3600`, and the failure is logged with `console.error("sitemap: read failed", { error })`. The sitemap is never empty or partial because of a failed read.
- **AC-5**: Every indexable page has all of these in its `<head>`:
  - its own Arabic `<title>` and `<meta name="description">`
  - `<link rel="canonical">` with the absolute canonical address
  - `og:title`, `og:description`, and `og:url` (equal to the canonical)
  - `og:image` (absolute), `og:image:alt`, `og:site_name` = "S.K.F للإنارة", `og:locale` = `ar_AR`, `og:type` = `website`
  - `twitter:card` = `summary_large_image`

  The share title is the bare name with no "| S.K.F للإنارة" suffix (the site name already shows): the product name, the category or subcategory name, the policy title, the categories list's heading, and home's `Seo.homeTitle`. Each page passes this bare name to `shareMetadata` separately from its suffixed `<title>`. `shareMetadata` sets `twitter.images` as well as `openGraph.images`, so X shows the image too. Every page not in the indexable list still gets the site wide defaults (shop image, site name, locale, card) from the storefront layout.
- **AC-6**: A product's share image is its first photo by gallery order (the first `image` kind row of `product_media` for the product, by `sort`, ignoring the `?v` selection). It is served as `<supabaseEnv().url>/storage/v1/render/image/public/product-media/<key>?width=1200&height=630&resize=contain&quality=80`, with each key segment encoded the way `mediaObjectUrl` encodes it, a fit inside 1200 by 630 that never crops the lamp. `og:image:width` and `og:image:height` are the fitted size (best effort; the transform decides the real output) when the photo's `width` and `height` are both known and above 0, and are left out otherwise. `og:image:alt` is the photo's `alt` from `ProductPageData.photos` (which already fills a missing alt with "<name>، صورة N"). A product with no photo uses the shop image.
- **AC-7**: A main category page's share image is its `image_key` photo through the same transform. A subcategory uses its main's photo; a sub's own `image_key` is ignored on purpose, since the category actions only ever set a photo on a main. A category with no photo uses the shop image. `og:image:alt` is the category name.
- **AC-8**: Home's `<title>` is `Seo.homeTitle` ("S.K.F للإنارة في الخليل | ثريات وأباجورات ومواد كهربائية"), its description is `Seo.homeDescription` ("متجر S.K.F للإنارة في الخليل: ثريات، أباجورات، إنارة داخلية وخارجية، ومواد كهربائية. اطلب من الموقع أو عبر واتساب مع التوصيل."), and its canonical is `siteUrl + "/"`. Both lines are drafts the owner may reword in `ar.json` before launch. Home uses the shop image. Home gets its own `generateMetadata` (today it only inherits the layout's title and description).
- **AC-9**: Home carries one `Store` JSON-LD block (a schema.org type for a shop, which Google reads for local results), next to nothing else new:
  - `@type` `Store`, `name` = `shop_settings.shop_name`, `url` = `siteUrl + "/"`
  - `logo` = `siteUrl + "/brand/logo.png"`, `image` = `siteUrl + "/brand/share.png"`
  - `telephone` = `"+"` plus the WhatsApp number in use (`pickWhatsappNumber`, spec 0025 AC-4). Both the saved number and the env one are digits only with the country code first, so no further stripping is needed.
  - `address`: a `PostalAddress` with `streetAddress` = the address after `contactLine` (trimmed, empty counts as null, left out when null), `addressLocality` = `Seo.town` ("الخليل"), `addressCountry` = `PS`

  `getShopContact()` gains `shopName` (in `ShopContact`, `noContact` as null, and its select) to supply the name.

  When the contact read fails (or `shopName` is null), the block still renders with `name` = `Metadata.title`, `url`, `logo`, `image`, `telephone` from the env fallback, and `address` with the town and country only.
- **AC-10**: A policy page's description is its body with the Markdown removed (headings, list marks, emphasis, link syntax, keeping link text), whitespace collapsed, cut to 155 code points, the same cut as `metaDescription`. An empty body falls back to `Metadata.description`. Its canonical is `siteUrl + routes.policy(slug)`. It uses the shop image. An unknown slug keeps today's behaviour (`notFound()` from `loadPage`, also in metadata), and a failed read keeps going to the storefront error card.
- **AC-11**: The categories list `/c` keeps its canonical and title, and gains the share tags of AC-5 with the shop image.
- **AC-12**: Private and transient pages stay hidden. Every page under `/admin`, `/auth`, `/account`, `/cart`, `/checkout`, `/orders`, and `/search` keeps its `noindex` robots tag as today, and none of them appears in the sitemap. Filtered and paged category lists keep `noindex, follow` with the canonical rules of spec 0010 AC-14. A missing page answers 404 with no canonical and no share tags of its own.
- **AC-13**: `public/brand/share.png` is a 1200 by 630 PNG under 300 KB: `skf-logo.svg` centred at 40% of the width on the brand primary colour token from `tokens.css`, with no text (so no Arabic shaping problems in any preview). `public/brand/logo.png` is a 512 by 512 PNG of the same logo on the same colour for the Store block. Both are made by a committed one off script, `scripts/make-share-images.mjs`, using `sharp` as a dev dependency (it reads the token value from `tokens.css`, so the colour has one source), and the PNGs are committed; `og:image:alt` for the shop image is `Seo.shopImageAlt` ("شعار S.K.F للإنارة").
- **AC-14**: A product page reached with `?v=<variant>` keeps the bare canonical (spec 0009 AC-15), and its `og:url` equals that canonical, so every share of the product counts for one address.

## Decision

**Chosen option**: Option 1: Fix in place with plain route handlers and one share helper.

Complete the existing per page metadata through one pure `shareMetadata()` helper, serve `robots.txt` and `sitemap.xml` from plain route handlers built on pure text builders, guard indexing by comparing the request host to `NEXT_PUBLIC_SITE_URL`, and build the sitemap live on each fetch.

**Implementation skills**: `nextjs-on-cloudflare` (`cloudflare/skills`, `.agents/skills/nextjs-on-cloudflare/`), for route handlers under OpenNext

## Rationale

See [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change and no migration. The feature only reads existing columns:
- `products` (`slug`, `updated_at`, `status`) through `listedProduct`
- `categories` (`slug`, `parent_id`, `image_key`, `is_visible`, `updated_at`) through `categoryShown`
- `product_media` (`storage_key`, `alt`, `width`, `height`, `sort`, `kind`)
- `pages` (`slug`, `body`, `updated_at`)
- `shop_settings` (`shop_name`, `address`, `whatsapp_number`)

**State transitions**: none.

**Code layout**:
| File | What it holds |
|---|---|
| `src/features/seo/share.ts` | `shareMetadata({ title, description, canonical, image })` returns the full `openGraph` and `twitter` objects (site name, locale, type, card included); `SHOP_IMAGE`; `shareImageUrl(supabaseUrl, key)`; `fittedShareSize(width, height)` |
| `src/features/seo/indexing.ts` | `isProductionHost(host, siteUrl)`; `NOINDEX_HEADER` |
| `src/features/seo/robots.ts` | `buildRobotsTxt(siteUrl, production)` |
| `src/features/seo/sitemap.ts` | `buildSitemapXml(entries)`, with XML escaping and the `lastmod` format |
| `src/features/seo/store-jsonld.ts` | `storeJsonLd({ name, siteUrl, telephone, address, town })` |
| `src/features/seo/summary.ts` | `summarize(text)` (the 155 code point cut, moved from `productSummary`, which then calls it) and `stripMarkdown(text)` |
| `src/features/seo/server/sitemap-entries.ts` | `readSitemapEntries(db)`: the products, categories, and pages reads together (`Promise.all`), reusing `listedProduct`, `categoryShown`, and the category page's product count rule |
| `src/features/shell/contact.ts`, `src/features/shell/server/shop-contact.ts` (changed) | `ShopContact` gains `shopName` |
| `src/features/catalog/...` (changed) | `PageCategory` and `readCategoryHead`'s `head()` carry the main's `imageKey` into `CategoryHead.main`; test fixtures follow |
| `src/app/robots.txt/route.ts`, `src/app/sitemap.xml/route.ts` | the two route handlers |

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/robots.txt` | GET | request host | `text/plain` body per AC-1 or AC-2 | public | none |
| `/sitemap.xml` | GET | request host | `application/xml` `urlset` per AC-3, `Cache-Control` per AC-4 | public | 404 off the production host; 503 + `Retry-After` on a failed or slow read |
| `src/proxy.ts` (changed) | every matched request | request host | the current body becomes an inner function; a thin exported `proxy` calls it and adds `X-Robots-Tag: noindex, nofollow` off the production host to whatever it returns (the broken order redirect, the `/api/catalog/` pass, i18n redirects and rewrites, the session result) | n/a | none |
| `generateMetadata` on home (new), `/c`, category, product, policy (changed) | n/a | page data | title, description, canonical, `openGraph`, `twitter` per AC-5 to AC-11 | public | as today: an unknown product or category returns `{}`, an unknown policy calls `notFound()` |
| storefront layout `generateMetadata` (changed) | n/a | `siteUrl` | `metadataBase`, default `openGraph` and `twitter` with the shop image | public | none |

Both route handlers sit outside locale routing on their own: the proxy matcher skips any path with a dot, so next-intl never rewrites them. They are plain `route.ts` handlers, not the `robots.ts`/`sitemap.ts` metadata files, because they must read the request host and set their own `Cache-Control`.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| any | production host | `new URL(parsePublicEnv().siteUrl).host` |
| any | request host | `new URL(request.url).host` in the route handlers, `request.nextUrl.host` in the proxy, both normalized by `isProductionHost` (lowercase, no trailing dot, no default port) |
| robots | `Sitemap:` address | `siteUrl + "/sitemap.xml"` |
| sitemap | product `<loc>`, `lastmod` | `siteUrl + routes.product(products.slug)`; `products.updated_at` |
| sitemap | category `<loc>`, `lastmod` | `siteUrl + routes.category(slug)` or `routes.subcategory(main, sub)`; `categories.updated_at` |
| sitemap | which categories appear | derived: `categoryShown` and a count above 0 of `listedProduct` rows on the category itself or (for a main) in its shown subs |
| sitemap | policy `<loc>`, `lastmod` | `siteUrl + routes.policy(pages.slug)` after `isPolicySlug`; `pages.updated_at` |
| sitemap | crawler cache hint | decided here: `max-age=3600`; the Worker caches nothing (built live) |
| sitemap | read time limit | decided here: 3000 ms through `withTimeLimit`, like the categories page |
| product metadata | share image | `ProductPageData.photos[0].key` (photos only, in gallery order) through `shareImageUrl(supabaseEnv().url, key)` |
| product metadata | image size | `fittedShareSize(photo.width, photo.height)`: scale to fit 1200 by 630, never enlarged, rounded; null when either is missing or 0 or less |
| product metadata | image alt | `photos[0].alt` (already filled with "<name>، صورة N" when the row has none) |
| category metadata | share image | `CategoryHead.main.imageKey` (also for a sub page), carried through `PageCategory` and `head()` |
| policy metadata | description | `summarize(stripMarkdown(pages.body))`, else `Metadata.description` |
| home metadata | title, description, town | `Seo.homeTitle`, `Seo.homeDescription`, `Seo.town` in `ar.json` |
| home Store block | name, address | `shop_settings.shop_name` (new `shopName` field), `shop_settings.address` through `contactLine`, both from `getShopContact()` (cached per request, already read by the layout); name falls back to `Metadata.title` |
| home Store block | telephone | `"+" + pickWhatsappNumber(contact.whatsappNumber)` |
| home Store block | country | decided here: `PS` |
| every page | site name, locale, card, type | `Metadata.title`; decided here: `ar_AR`, `summary_large_image`, `website` |
| shop image | file and alt | `public/brand/share.png` made by `scripts/make-share-images.mjs` from `public/brand/skf-logo.svg` and the brand primary token in `tokens.css`; `Seo.shopImageAlt` |

**Key invariants**:
- Next merges metadata shallowly: a page that sets `openGraph` replaces the layout's whole `openGraph` object. So every page that sets share tags builds them only through `shareMetadata()`, which always includes the site name, locale, type, image, and card. A page never writes `openGraph` by hand.
- The sitemap's product and category rules are the same SQL fragments the pages use (`listedProduct`, `categoryShown`), so the sitemap never lists a page that answers 404, and never misses one that opens.
- `og:url` always equals the canonical.
- No address is hand written: every path comes from `routes`, every absolute address from `siteUrl`.
- The production host check is the only switch for indexing; there is no env flag that can be forgotten at go live.

**Security model**: everything here is public by design. The sitemap reads only listed products, shown categories, and policy rows through `getDb()`; it returns slugs and timestamps, never prices, stock counts, or anything about customers. The Store block publishes the shop's own address and WhatsApp number, which the footer already shows. No customer phone or address is read or logged. Neither route needs a rate limiter: robots is static text, and the sitemap is three indexed reads under a 3 second limit, refused on every host but production.

**Configuration required**: none new. `NEXT_PUBLIC_SITE_URL` must be the bare production domain on the production Worker (already true per spec 0001, where `www` redirects to the bare domain).

**Critical test scenarios** (Vitest beside the source, Playwright on a phone sized RTL screen):
- Happy path: a listed product with two photos shows the first photo's transform address in `og:image`, its name in `og:title`, the canonical in `og:url`, and appears in `/sitemap.xml` with its `updated_at`, verifies **AC-3**, **AC-5**, **AC-6**
- Hide a product, then fetch the sitemap: it is gone on the next fetch; a hidden category takes its products and itself out, verifies **AC-3**
- An out of stock listed product stays in the sitemap, verifies **AC-3**
- `buildRobotsTxt` for the production host and for another host gives exactly the AC-1 and AC-2 lines; `isProductionHost` treats `skf.example`, `SKF.example.`, and `skf.example:443` as production and `skf-pro.abc.workers.dev` and `www.skf.example` as not, verifies **AC-1**, **AC-2**
- The proxy adds `X-Robots-Tag` on every return path off the production host, and on none on it, verifies **AC-2**
- A failed or slow read of any one of the three sitemap reads answers 503 with `Retry-After`, verifies **AC-4**
- A main with no products of its own but one listed product in a shown sub is in the sitemap; one whose only products sit in a hidden sub is not, verifies **AC-3**
- `buildSitemapXml` escapes `&` and `<` in a `<loc>`, keeps the percent encoded Arabic slug, and formats `lastmod` in UTC, verifies **AC-3**
- `fittedShareSize(2000, 3000)` gives 420 by 630; a null width leaves the size out, verifies **AC-6**
- `stripMarkdown` on a policy body with headings, lists, bold, and a link keeps only the words and the link text; an empty body falls back, verifies **AC-10**
- Home renders one `Store` block with the saved name and trimmed address; with the contact read failing, the reduced block renders with `Metadata.title`, verifies **AC-8**, **AC-9**
- `shareMetadata` output carries `twitter.images` and the site name, locale, and type on every call, verifies **AC-5**
- A subcategory with no photo shows its main's photo; a main with no photo shows the shop image, verifies **AC-7**
- Each private path from AC-12 carries a `noindex` robots meta, and none appears in the sitemap, verifies **AC-12**
- `?v=` on a product keeps the bare canonical and `og:url`, verifies **AC-14**
- `/c` and a policy page carry the full AC-5 tag set, verifies **AC-5**, **AC-10**, **AC-11**
- The two image files have the AC-13 sizes and `share.png` is under 300 KB, verifies **AC-13**

## Build plan

Tracer Bullet: the first task proves one product travels the whole path (sitemap, robots, page tags, share preview) on workerd; the later tasks thicken each part.

1. Thin thread: `share.ts`, `robots.ts`, `sitemap.ts`, and `summary.ts` with their unit tests; `metadataBase` and the default share tags in the storefront layout; the product page's share tags; `/robots.txt` for the production host; `/sitemap.xml` listing listed products only; `scripts/make-share-images.mjs` run once and `share.png` and `logo.png` committed. Check it with `pnpm preview` and one product shared through the Facebook sharing debugger or a WhatsApp chat against a tunnel, satisfies **AC-1**, **AC-5**, **AC-6**, **AC-13**, **AC-14**
2. Preview host guard: `indexing.ts` with tests; the proxy wrapped so every return path gets `X-Robots-Tag`; robots `Disallow: /`, sitemap 404, and the header in both handlers off the production host, satisfies **AC-2**
3. Full sitemap: home, `/c`, categories by the page's product count rule, policy pages, `lastmod`; the three reads under one 3 second limit and the 503 path, satisfies **AC-3**, **AC-4**
4. Remaining pages: home's new `generateMetadata` and `store-jsonld.ts` with its reduced fallback (`ShopContact` gains `shopName`); `/c` share tags; category share image (carry the main's `imageKey` through `PageCategory` and `head()`); policy description, canonical, and share tags, satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**
5. End to end on a phone sized RTL screen: the tag set on each indexable page, the private pages' `noindex`, the sitemap contents after hiding a product, and robots on the production host (the preview host case is covered by unit tests of `proxy` and the two route handlers called with a `workers.dev` request, since a browser cannot reliably rewrite the Host header), satisfies **AC-12** and rechecks **AC-1** to **AC-14**

## Consequences

**Positive**:
- Every product link shared on WhatsApp shows the real photo and name, which is how most of this shop's customers find products.
- Search engines get a complete, always accurate list of pages, without the owner doing anything.
- Preview builds can never leak into search results, even if someone forgets a setting at go live.
- All share tags come from one helper, so a new page gets them right by calling it.

**Negative / tradeoffs**:
- Each sitemap fetch costs three database reads. Crawlers fetch it a few times a day, so this is small; if logs ever show heavy fetching, add a cache then.
- A category's `lastmod` does not move when only its products change, so crawlers learn about new products from the product entries, not the category's date.
- `resize=contain` gives a preview with the photo's own shape, so a tall chandelier shows as a narrow image in Facebook's wide frame. It never crops the product, which matters more.
- The home title and description are fixed in `ar.json`, so rewording them takes a code change and a deploy, not a dashboard edit.
- The Store block has no opening hours or map position, because the shop settings hold neither. Google shows less in local results until they are added.
- One sitemap file holds at most 50,000 addresses. The shop is far below that; past about 40,000 products it would need splitting.

**Neutral**:
- `sharp` joins the dev dependencies for the image script only; it never ships in the Worker.
- `productSummary` moves to `src/features/seo/summary.ts` as `summarize`; `product-seo.ts` calls it, and its tests follow.
- If `src/language-rules.test.ts` flags the `lastmod` formatting, add a `toIsoUtc()` helper to `src/lib/format.ts` and use it there.
- Next's own `robots.ts`/`sitemap.ts` metadata files are not used; a later reader should not add them alongside the route handlers.

## Follow-up

- [ ] Go live (feature 30): add the Search Console ownership TXT record in Cloudflare DNS, submit `https://<domain>/sitemap.xml`, and import the site into Bing Webmaster Tools from Search Console. Record these steps in the go live runbook.
- [ ] Go live (feature 30): after DNS cutover, check one product link with the Facebook sharing debugger and a WhatsApp chat, and fetch `/robots.txt` on both the domain and the `workers.dev` address.
- [ ] The owner rewords `Seo.homeTitle` and `Seo.homeDescription` in `ar.json` before launch if the drafts do not fit.
- [ ] Later, if wanted: opening hours, map position, and social page links in shop settings, so the Store block can carry them (a new spec, since it adds columns).
