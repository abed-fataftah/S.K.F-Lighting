# 0026. Search engine visibility: rationale

The decision record behind [index.md](index.md). `/develop` builds from the index; this file explains why.

## Context

The shop is an Arabic only storefront on Cloudflare Workers (spec 0001), where every page renders on each request and no incremental cache is configured. Most customers reach products through links shared on WhatsApp and Facebook, and through Google searches that name a product type and a town. Scope feature 28 asks that each public page have its own Arabic title, description, and share image, that a sitemap list every product, and that private pages stay hidden.

Part of this already exists, built feature by feature. Product pages (spec 0009) carry a title, a description cut from the product text, a bare canonical, and `Product` plus `BreadcrumbList` JSON-LD. Category pages (specs 0008 and 0010) carry a canonical and breadcrumbs, and mark filtered or paged lists `noindex, follow`. Search, cart, checkout, orders, account, auth, and the dashboard all carry `noindex`. What is missing is everything that is not one page's own concern: there is no `robots.txt`, no `sitemap.xml`, no `metadataBase`, and no Open Graph or Twitter tags anywhere, so a shared link shows no preview. Home and the policy pages have no canonical, and the policy pages have no description of their own. Nothing tells search engines about the shop as a local business.

Two forces shape the gaps. First, the app also runs at `workers.dev` addresses for preview builds, and those copies serve the same content; if they are indexed, they compete with the real domain. Second, product photos are stored as WebP up to 2,000 pixels on their long edge. Chat apps drop previews whose image is too heavy, so the share image must be a resized copy, not the original. Generated preview cards are common elsewhere, but the usual renderer (Satori, behind `next/og`) handles Arabic letter joining and right to left text poorly, so text drawn into an image is a real risk here.

Left undone, the shop launches (feature 30) with link previews that show nothing, a crawler that must discover products by following links, and preview builds open to indexing.

## Options considered

### Option 1: Fix in place with plain route handlers and one share helper

Keep the per page `generateMetadata` that exists and complete it through one pure `shareMetadata()` helper. Serve `robots.txt` and `sitemap.xml` from plain `route.ts` handlers whose bodies come from pure builders, compare the request host to `NEXT_PUBLIC_SITE_URL` to decide indexing, and build the sitemap live on each fetch. Share images come from the Supabase transform the site already uses for photos.

**Pros**:
- Reuses everything already built and tested (`listedProduct`, `productJsonLd`, `serializeJsonLd`, `routes`, the image transform).
- The handlers can read the host and set their own headers, which the host check and the cache both need.
- The builders are pure text functions, so they are unit tested without mocks, as the project rules ask.
- No new service, no new env var, no schema change.

**Cons**:
- Hand written XML and text, where Next's metadata files would type check the shape.
- Each sitemap fetch reads the database, with no cache in front of it.

### Option 2: Next's `robots.ts` and `sitemap.ts` metadata files

Use the file conventions Next provides, which return typed objects that Next serializes.

**Pros**:
- Typed output, less code, and the shape every Next tutorial shows.

**Cons**:
- Reading the host makes them dynamic, and they cannot set their own headers (`Cache-Control`, `X-Robots-Tag`).
- The host check would then live partly in the metadata file and partly in `next.config.ts` headers, two places for one rule.

### Option 3: An env flag for indexing, plus generated share cards

Add `SEO_INDEXING=on` on the production Worker only, and draw each product's preview with `next/og` (photo, Arabic name, price, logo).

**Pros**:
- The flag makes the intent explicit in config.
- Designed cards look richer than a plain photo.

**Cons**:
- A forgotten flag at go live hides the real site from search engines silently, the worst failure this feature can have.
- Arabic text in Satori needs a bundled Arabic font and shaping workarounds, adds a WebAssembly bundle to the Worker, and costs CPU on every first share; a wrong render is visible to every customer.

### Option 4: A hosted SEO or sitemap service

Point a third party crawler or SEO plugin at the site to generate the sitemap and tags.

**Pros**:
- Nothing to build for the sitemap.

**Cons**:
- It learns pages by crawling, so it lags behind the database and can list hidden products.
- A new account, a new cost, and a new place for the owner to look, for a site with a few thousand pages.

## Rationale

Option 1 wins because most of the work is already done in this codebase, and the missing parts are small and pure. The sitemap must agree exactly with which pages open, and the only way to guarantee that is to build it from the same `listedProduct` and `categoryShown` SQL fragments the pages use; that rules out Option 4. The engineer first chose a sitemap fresh within an hour, and the draft kept it in the Workers Cache API for that hour. The cross check pointed out that crawlers fetch a sitemap only a few times a day and the reads are indexed, so the cache bought almost nothing for its extra branch (no `caches` in `next dev`, `waitUntil` through OpenNext). The engineer agreed: the sitemap is built live, which is fresher than asked and simpler (measure before you cache). The handlers still need to own their headers for the host check, which favours plain route handlers over Option 2.

The host check is chosen over an env flag (Option 3) because of the failure mode, not the happy path. A flag that must be set on exactly one Worker is the kind of step that gets missed at go live, and its failure is silent: the real shop stays out of Google. Comparing the request host to `NEXT_PUBLIC_SITE_URL`, which the production Worker must already set correctly for order links and password resets, has no extra step to forget. Preview hosts also get `X-Robots-Tag` on every response, because a `Disallow` in robots alone does not stop a page linked from elsewhere from being listed.

For share images, the first product photo through the existing Supabase transform gives every product a real, small preview with no new code path, and `resize=contain` never crops a chandelier. Generated cards would look better but put Arabic text through a renderer that shapes it poorly; that risk is not worth taking for a preview. The shop image carries only the logo, no text, for the same reason. The `Store` block on home is cheap, built from settings the owner already keeps, and names Hebron, which matches how local customers search.

One design detail carries real risk and is written as an invariant: Next merges metadata shallowly, so a page that sets `openGraph` drops the layout's site name, locale, and image unless it repeats them. Routing every page through `shareMetadata()` removes that class of bug.
