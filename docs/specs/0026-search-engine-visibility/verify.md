# Verify: search engine visibility · spec 0026 · updated 2026-11-06
_Steps derived from spec 0026 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Run these on `pnpm preview` built with `NEXT_PUBLIC_SITE_URL=http://localhost:8787`, so `localhost:8787` is the production host. For the preview host steps, call the same build through another host name (for example `127.0.0.1:8787`), which counts as not production.

## UI / manual
- [ ] Open a listed product with two photos → `og:title` is the bare name, `og:url` equals the canonical, `og:image` is the first photo's `/render/image/…?width=1200&height=630&resize=contain&quality=80` address, `og:image:alt` is its alt, `og:site_name` "S.K.F للإنارة", `og:locale` `ar_AR`, `og:type` `website`, `twitter:card` `summary_large_image`, `twitter:image` equal to `og:image` → AC-5, AC-6
- [ ] Give that product's first photo a width of 2000 and a height of 3000 → `og:image:width` 420, `og:image:height` 630; set the width to null → both tags gone → AC-6
- [ ] Clear the first photo's alt → `og:image:alt` reads "<name>، صورة ١" → AC-6
- [ ] A product with no photo → `og:image` is `<site>/brand/share.png`, alt "شعار S.K.F للإنارة" → AC-6
- [ ] Open the product with `?v=<a variant id>` → canonical and `og:url` are the bare `/p/<slug>`; `og:image` stays the first photo even when the variant shows another → AC-14, AC-6
- [ ] Open a main category with a photo → `og:image` is its photo through the transform, `og:image:alt` the category name; open one of its subs → the main's photo with the sub's name as alt → AC-7
- [ ] A main with no photo → the shop image → AC-7
- [ ] A filtered category (`?sort=…`) and page 2 → `noindex, follow`, filtered keeps the unfiltered canonical, both keep the layout's shop image and no `og:url` → AC-12, AC-5
- [ ] Home → `<title>` is `Seo.homeTitle`, description `Seo.homeDescription`, canonical `<site>/`, share image the shop image → AC-8
- [ ] Home's page source holds exactly one `Store` JSON-LD block with the saved shop name, the trimmed address after `contactLine`, "+" and the WhatsApp number in use, `addressLocality` "الخليل", `addressCountry` "PS", `logo` `<site>/brand/logo.png`, `image` `<site>/brand/share.png` → AC-9
- [ ] Clear the saved WhatsApp number in settings → the block's telephone becomes "+" and `NEXT_PUBLIC_WHATSAPP_NUMBER`; blank the address → `streetAddress` disappears → AC-9
- [ ] Stop the database (or make the contact read fail) and open home → the reduced block renders with name "S.K.F للإنارة", the env number, and only the town and country → AC-9
- [ ] `/c` → title unchanged, canonical `<site>/c`, `og:title` "الأقسام", shop image → AC-11
- [ ] `/policies/returns` with a body holding headings, a list, bold text, and a link → description is plain words with the link text kept, at most 155 code points, canonical `<site>/policies/returns`, shop image → AC-10
- [ ] Save an empty policy body → description falls back to `Metadata.description`; `/policies/unknown` → 404 → AC-10
- [ ] `/cart`, `/checkout`, `/orders/track`, `/account/sign-in`, `/search?q=ثريا`, `/admin/login` → each carries a `noindex` robots meta; `/p/<missing slug>` → 404 with no canonical and no `og:url` → AC-12
- [ ] Share one product link through the Facebook sharing debugger or a WhatsApp chat against a tunnel → the preview shows the photo, the name, and the description → AC-5, AC-6

## Commands
- [ ] `curl -i http://localhost:8787/robots.txt` → 200, `text/plain; charset=utf-8`, no `X-Robots-Tag`, exactly the AC-1 lines with `Sitemap: http://localhost:8787/sitemap.xml` → AC-1
- [ ] `curl -i http://127.0.0.1:8787/robots.txt` → 200 with only `User-agent: *` and `Disallow: /`, `X-Robots-Tag: noindex, nofollow` → AC-2
- [ ] `curl -i http://127.0.0.1:8787/sitemap.xml` → 404 with `X-Robots-Tag`; `curl -I http://127.0.0.1:8787/`, `…/admin`, `…/ar` → every answer carries `X-Robots-Tag: noindex, nofollow` → AC-2
- [ ] `curl -i http://localhost:8787/sitemap.xml` → 200, `application/xml; charset=utf-8`, `Cache-Control: public, max-age=3600`; holds `/`, `/c`, each shown category with a listed product, each listed product with `lastmod` equal to its `updated_at` in UTC, each policy row; no `priority`, no `changefreq` → AC-3, AC-4
- [ ] Hide a product in the dashboard, fetch the sitemap again → it is gone; hide its category → the category and all its products are gone; an out of stock listed product stays → AC-3, AC-4
- [ ] A main whose only listed product sits in a shown sub → the main and the sub both appear; move that sub to hidden → neither appears → AC-3
- [ ] Edit a product, fetch the sitemap → its `lastmod` moves; its category's `lastmod` does not → AC-3
- [ ] Stop the database and fetch the sitemap → 503 with `Retry-After: 3600`, and the log says `sitemap: read failed` → AC-4
- [ ] `node scripts/make-share-images.mjs` → writes `public/brand/share.png` (1200 by 630, under 300 KB) and `public/brand/logo.png` (512 by 512), the logo on `--skf-ink` from `tokens.css` → AC-13
- [ ] `pnpm exec vitest run src/features/seo src/proxy.test.ts "src/app/[locale]"` → passes → AC-1 to AC-14
- [ ] `E2E_TARGET=preview NEXT_PUBLIC_SITE_URL=http://localhost:8787 pnpm exec playwright test e2e/search-engine-visibility.spec.ts --project=phone` → passes → AC-1 to AC-14

## Value sourcing
- [ ] Production host: change `NEXT_PUBLIC_SITE_URL` to another host and rebuild → `localhost:8787` turns into a preview (robots closed, sitemap 404, header on) → AC-2
- [ ] Request host normalization: `isProductionHost` treats `HOST.`, `HOST:443`, and `HOST:80` as production and `www.HOST` as not (unit test) → AC-2
- [ ] Sitemap address in robots comes from `siteUrl`, not the request host → AC-1
- [ ] Product `<loc>` uses `routes.product`: an Arabic slug appears percent encoded → AC-3
- [ ] Category `<loc>` uses `routes.category` / `routes.subcategory`, `lastmod` the category's own `updated_at` → AC-3
- [ ] Policy `<loc>` only for slugs that pass `isPolicySlug` and have a row → AC-3
- [ ] Product share image comes from `photos[0]` in gallery order: reorder the photos in the dashboard → `og:image` follows → AC-6
- [ ] Category share image comes from the main's `image_key`, also on a sub page, never the sub's own → AC-7
- [ ] Policy description comes from the saved body: edit the body → the description follows → AC-10
- [ ] Home title, description, and town come from `ar.json` `Seo` → AC-8, AC-9
- [ ] Store name comes from `shop_settings.shop_name` (rename the shop → the block follows), else `Metadata.title` → AC-9
- [ ] Store telephone comes from `pickWhatsappNumber` (saved number first, env second) → AC-9
- [ ] Site name, locale, card, and type are the same on every page → AC-5
- [ ] Shop image colour comes from `--skf-ink` in `tokens.css` (changed from AC-13's "primary", see the build note) → AC-13

## Acceptance-criteria coverage
- AC-1: robots on production (Commands 1, Value sourcing 3)
- AC-2: preview host (Commands 2 and 3, Value sourcing 1 and 2)
- AC-3: sitemap contents (Commands 4 to 7, Value sourcing 4 to 6)
- AC-4: live build, cache hint, 503 (Commands 4, 5, 8)
- AC-5: full tag set (UI 1, 8, 17; Value sourcing 13)
- AC-6: product image (UI 1 to 5, 17; Value sourcing 7)
- AC-7: category image (UI 6, 7; Value sourcing 8)
- AC-8: home title (UI 9; Value sourcing 10)
- AC-9: Store block (UI 10 to 12; Value sourcing 11, 12)
- AC-10: policy description (UI 14, 15; Value sourcing 9)
- AC-11: `/c` (UI 13)
- AC-12: private pages (UI 8, 16)
- AC-13: images (Commands 9; Value sourcing 14)
- AC-14: `?v` (UI 5)
