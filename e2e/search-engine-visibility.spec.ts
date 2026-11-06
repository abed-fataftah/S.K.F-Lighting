import { expect as baseExpect, test, type APIRequestContext, type Page } from "@playwright/test";
import ar from "../src/i18n/messages/ar.json";
import { adminAccounts, loadLocalEnv } from "./admin-auth";
import { usePhoneWidth } from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-14 (spec 0026). On a phone sized right to left screen: a product, its
// categories, home, `/c`, and a policy page carry the full share tag set; `?v` keeps the bare
// address; a sub page shares its main's photo; home carries one Store block; the private pages say
// noindex; robots and the sitemap answer for the host this build treats as production, and a
// product hidden by the owner leaves the sitemap on the next fetch. The preview host case is
// covered by the unit tests of the proxy and the two handlers (a browser cannot set Host).

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

loadLocalEnv();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const configuredSite = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const tag = Date.now().toString(36);
const CODE = `SEO-E2E-${tag.toUpperCase()}`;
const MAIN = { name: `إنارة المشاركة ${tag}`, slug: `seo-main-${tag}` };
const SUB = { name: `ثريات المشاركة ${tag}`, slug: `seo-sub-${tag}` };
const HIDDEN = { name: `قسم مخفي ${tag}`, slug: `seo-hidden-${tag}` };
const MAIN_PHOTO = `categories/seo-${tag}.webp`;
const SHOWN = { name: `ثريا المشاركة ${tag}`, slug: `seo-shown-${tag}` };
const SOLD_OUT = { name: `ثريا نفدت ${tag}`, slug: `seo-out-${tag}` };
const TO_HIDE = { name: `أباجورة ستختفي ${tag}`, slug: `seo-hide-${tag}` };
const IN_HIDDEN = { name: `منتج في قسم مخفي ${tag}`, slug: `seo-in-hidden-${tag}` };

let shownId: string;
let variantId: string;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the search engine flow runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    const [main] = await sql<{ id: string }[]>`
      insert into categories (name, slug, image_key) values (${MAIN.name}, ${MAIN.slug}, ${MAIN_PHOTO})
      returning id`;
    const [sub] = await sql<{ id: string }[]>`
      insert into categories (name, slug, parent_id) values (${SUB.name}, ${SUB.slug}, ${main.id})
      returning id`;
    const [hidden] = await sql<{ id: string }[]>`
      insert into categories (name, slug, is_visible) values (${HIDDEN.name}, ${HIDDEN.slug}, false)
      returning id`;
    const product = async (
      p: { name: string; slug: string },
      categoryId: string,
      code: string,
      available = true,
    ) => {
      const [row] = await sql<{ id: string }[]>`
        insert into products (category_id, code, name, slug, description, is_available)
        values (${categoryId}, ${code}, ${p.name}, ${p.slug}, ${"ثريا للاختبار من الكريستال."}, ${available})
        returning id`;
      const [variant] = await sql<{ id: string }[]>`
        insert into product_variants (product_id, price, is_default)
        values (${row.id}, ${25_000}, true) returning id`;
      return { id: row.id, variantId: variant.id };
    };
    const shown = await product(SHOWN, sub.id, `${CODE}-1`);
    shownId = shown.id;
    variantId = shown.variantId;
    await sql`
      insert into product_media (product_id, kind, storage_key, width, height, alt, sort)
      values (${shownId}, 'image', ${`products/${shownId}/seo-0.webp`}, 2000, 3000, ${"ثريا ذهبية"}, 0),
             (${shownId}, 'image', ${`products/${shownId}/seo-1.webp`}, 800, 800, null, 1)`;
    await product(SOLD_OUT, sub.id, `${CODE}-2`, false);
    await product(TO_HIDE, main.id, `${CODE}-3`);
    await product(IN_HIDDEN, hidden.id, `${CODE}-4`);
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}%`}`;
    await sql`delete from categories where slug = ${SUB.slug}`;
    await sql`delete from categories where slug in (${MAIN.slug}, ${HIDDEN.slug})`;
  } finally {
    await sql.end();
  }
});

const productPath = (slug: string) => `/p/${encodeURIComponent(slug)}`;
const meta = (page: Page, attr: "name" | "property", key: string) =>
  page.locator(`head meta[${attr}="${key}"]`).first().getAttribute("content");

async function shareTags(page: Page) {
  return {
    title: await page.title(),
    description: await meta(page, "name", "description"),
    canonical: await page.locator('head link[rel="canonical"]').getAttribute("href"),
    ogTitle: await meta(page, "property", "og:title"),
    ogDescription: await meta(page, "property", "og:description"),
    ogUrl: await meta(page, "property", "og:url"),
    ogImage: await meta(page, "property", "og:image"),
    ogImageAlt: await meta(page, "property", "og:image:alt"),
    ogSiteName: await meta(page, "property", "og:site_name"),
    ogLocale: await meta(page, "property", "og:locale"),
    ogType: await meta(page, "property", "og:type"),
    twitterCard: await meta(page, "name", "twitter:card"),
    twitterImage: await meta(page, "name", "twitter:image"),
  };
}

/** The tags every indexable page has, whatever its own values (AC-5). */
function expectFullSet(tags: Awaited<ReturnType<typeof shareTags>>) {
  expect(tags.description).toBeTruthy();
  expect(tags.canonical).toMatch(/^https?:\/\//);
  expect(tags.ogUrl).toBe(tags.canonical);
  expect(tags.ogDescription).toBe(tags.description);
  expect(tags.ogImage).toMatch(/^https?:\/\//);
  expect(tags.ogImageAlt).toBeTruthy();
  expect(tags.ogSiteName).toBe(ar.Metadata.title);
  expect(tags.ogLocale).toBe("ar_AR");
  expect(tags.ogType).toBe("website");
  expect(tags.twitterCard).toBe("summary_large_image");
  expect(tags.twitterImage).toBe(tags.ogImage);
}

const shareImage = (key: string) =>
  `${supabaseUrl}/storage/v1/render/image/public/product-media/${key}?width=1200&height=630&resize=contain&quality=80`;

test("a product shares its first photo, name, and bare address, also with ?v", async ({ page }) => {
  await page.goto(productPath(SHOWN.slug));
  const tags = await shareTags(page);

  expectFullSet(tags);
  expect(tags.title).toBe(`${SHOWN.name} | S.K.F للإنارة`);
  expect(tags.ogTitle).toBe(SHOWN.name);
  expect(tags.canonical).toBe(`${configuredSite}${productPath(SHOWN.slug)}`);
  expect(tags.ogImage).toBe(shareImage(`products/${shownId}/seo-0.webp`));
  expect(tags.ogImageAlt).toBe("ثريا ذهبية");
  expect(await meta(page, "property", "og:image:width")).toBe("420");
  expect(await meta(page, "property", "og:image:height")).toBe("630");

  await page.goto(`${productPath(SHOWN.slug)}?v=${variantId}`);
  const withVariant = await shareTags(page);
  expect(withVariant.canonical).toBe(tags.canonical);
  expect(withVariant.ogUrl).toBe(tags.canonical);
});

test("a main shares its photo and a sub shares its main's", async ({ page }) => {
  await page.goto(`/c/${MAIN.slug}`);
  const main = await shareTags(page);
  expectFullSet(main);
  expect(main.ogTitle).toBe(MAIN.name);
  expect(main.ogImage).toBe(shareImage(MAIN_PHOTO));
  expect(main.ogImageAlt).toBe(MAIN.name);

  await page.goto(`/c/${MAIN.slug}/${SUB.slug}`);
  const sub = await shareTags(page);
  expectFullSet(sub);
  expect(sub.ogTitle).toBe(SUB.name);
  expect(sub.ogImage).toBe(shareImage(MAIN_PHOTO));
  expect(sub.ogImageAlt).toBe(SUB.name);
});

test("home names the town, shares the shop image, and carries one Store block", async ({
  page,
}) => {
  await page.goto("/");
  const tags = await shareTags(page);

  expectFullSet(tags);
  expect(tags.title).toBe(ar.Seo.homeTitle);
  expect(tags.description).toBe(ar.Seo.homeDescription);
  expect(tags.canonical).toBe(`${configuredSite}/`);
  expect(tags.ogImage).toBe(`${configuredSite}/brand/share.png`);
  expect(tags.ogImageAlt).toBe(ar.Seo.shopImageAlt);

  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent ?? "null")));
  const stores = blocks.filter((block) => block?.["@type"] === "Store");
  expect(stores).toHaveLength(1);
  expect(stores[0]).toMatchObject({
    url: `${configuredSite}/`,
    logo: `${configuredSite}/brand/logo.png`,
    image: `${configuredSite}/brand/share.png`,
    telephone: expect.stringMatching(/^\+\d{8,15}$/),
    address: { addressLocality: ar.Seo.town, addressCountry: "PS" },
  });

  const image = await page.request.get(`/brand/share.png`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("the categories list and a policy page carry the full set with the shop image", async ({
  page,
}) => {
  await page.goto("/c");
  const list = await shareTags(page);
  expectFullSet(list);
  expect(list.ogTitle).toBe(ar.Categories.title);
  expect(list.ogImage).toBe(`${configuredSite}/brand/share.png`);

  await page.goto("/policies/returns");
  const policy = await shareTags(page);
  expectFullSet(policy);
  expect(policy.canonical).toBe(`${configuredSite}/policies/returns`);
  expect(policy.ogImage).toBe(`${configuredSite}/brand/share.png`);
  // Plain words: no Markdown marks left in the description (AC-10).
  expect(policy.description).not.toMatch(/[#*_`[\]]/);
  expect(Array.from(policy.description ?? "").length).toBeLessThanOrEqual(155);
});

test("private and transient pages say noindex, and a missing page has no address of its own", async ({
  page,
}) => {
  for (const path of [
    "/cart",
    "/checkout",
    "/orders/track",
    "/account/sign-in",
    "/search?q=ثريا",
    "/admin/login",
  ]) {
    await page.goto(path);
    await expect(page.locator('head meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/,
    );
  }

  const missing = await page.goto(productPath(`seo-missing-${tag}`));
  expect(missing?.status()).toBe(404);
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('head meta[property="og:url"]')).toHaveCount(0);
});

async function sitemap(request: APIRequestContext) {
  const response = await request.get("/sitemap.xml");
  return { response, xml: await response.text() };
}

test("robots and the sitemap answer for this host, and a hidden product leaves the sitemap", async ({
  page,
  baseURL,
}) => {
  const production = new URL(configuredSite).host === new URL(baseURL!).host;
  const robots = await page.request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toBe("text/plain; charset=utf-8");

  if (!production) {
    // This build carries another site address, so this host is a preview (AC-2).
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(robots.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect((await page.request.get("/sitemap.xml")).status()).toBe(404);
    return;
  }

  expect(await robots.text()).toBe(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /auth",
      "Disallow: /api",
      "Disallow: /design-system",
      `Sitemap: ${configuredSite}/sitemap.xml`,
      "",
    ].join("\n"),
  );
  expect(robots.headers()["x-robots-tag"]).toBeUndefined();

  const before = await sitemap(page.request);
  expect(before.response.status()).toBe(200);
  expect(before.response.headers()["content-type"]).toBe("application/xml; charset=utf-8");
  expect(before.response.headers()["cache-control"]).toBe("public, max-age=3600");
  const loc = (path: string) => `<loc>${configuredSite}${path}</loc>`;
  expect(before.xml).toContain(loc("/"));
  expect(before.xml).toContain(loc("/c"));
  expect(before.xml).toContain(loc(`/c/${MAIN.slug}`));
  expect(before.xml).toContain(loc(`/c/${MAIN.slug}/${SUB.slug}`));
  expect(before.xml).toMatch(
    new RegExp(`${loc(productPath(SHOWN.slug))}<lastmod>\\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z</lastmod>`),
  );
  // Out of stock stays listed; a hidden category and its product never appear (AC-3).
  expect(before.xml).toContain(loc(productPath(SOLD_OUT.slug)));
  expect(before.xml).toContain(loc(productPath(TO_HIDE.slug)));
  expect(before.xml).not.toContain(HIDDEN.slug);
  expect(before.xml).not.toContain(IN_HIDDEN.slug);
  for (const path of ["/admin", "/cart", "/checkout", "/orders", "/account", "/search"]) {
    expect(before.xml).not.toContain(`${configuredSite}${path}<`);
    expect(before.xml).not.toContain(`${configuredSite}${path}/`);
  }

  const sql = localSql();
  try {
    await sql`update products set status = 'hidden' where slug = ${TO_HIDE.slug}`;
  } finally {
    await sql.end();
  }
  const after = await sitemap(page.request);
  expect(after.xml).not.toContain(loc(productPath(TO_HIDE.slug)));
  expect(after.xml).toContain(loc(productPath(SHOWN.slug)));
});
