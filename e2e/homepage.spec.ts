import { expect as baseExpect, test, type Page } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-2, AC-8 to AC-11, AC-16 (spec 0011); AC-1, AC-2, AC-9, AC-11, AC-12 (spec 0030);
// AC-2, AC-11 (spec 0031). On a phone sized right to left screen: the owner adds two banners (one
// linked to a category), reorders them, unticks one and saves, picks two featured products, unticks
// a main, and gives a main a photo and a line; a customer sees the picks as the hero coverflow with
// the banner under it, follows its link, and sees the ticked mains as category cards (the photo and
// line on the card, the unticked one absent); the two picks swap on every move, one pick shows
// alone, no picks show the newest products, and no sellable product shows the fallback card; three,
// two, and one category still render as cards. Axe runs on Home (both heroes) and on the editor.
// Home is shared by every flow, so this one runs in its own project after the others
// (playwright.config.ts) and puts Home back as it found it.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

const tag = Date.now().toString(36);
const MAINS = [1, 2, 3, 4].map((n) => `قسم ${tag} ${n}`);
const CODE = `HP-E2E-${tag.toUpperCase()}`;
const FEATURED = [1, 2].map((n) => `ثريا مختارة ${tag} ${n}`);
const LINKED = `عرض الثريات ${tag}`;
const PLAIN = `عرض الأباجورات ${tag}`;
const LINE = `سطر ${tag}`;

// The mains ticked for Home before the flow; the category card steps untick them in the editor.
let homeMainIds: readonly string[] = [];
// The products hidden to show the fallback hero; put back at the end.
let hiddenProductIds: readonly string[] = [];

/** Four mains, each with a listed product (so four or more circles), and the two picks. */
async function seed() {
  const sql = localSql();
  try {
    const ticked = await sql<{ id: string }[]>`
      select id from categories where parent_id is null and show_on_home`;
    homeMainIds = ticked.map((main) => main.id);
    await sql`delete from banners`;
    await sql`delete from featured_products`;
    for (const [i, name] of MAINS.entries()) {
      const [main] = await sql<{ id: string }[]>`
        insert into categories (name, slug, sort) values (${name}, ${`hp-e2e-${tag}-${i}`}, ${-10 + i})
        returning id`;
      const names = i < FEATURED.length ? [FEATURED[i]] : [`منتج ${tag} ${i}`];
      for (const productName of names) {
        const [product] = await sql<{ id: string }[]>`
          insert into products (category_id, code, name, slug)
          values (${main.id}, ${`${CODE}-${i}`}, ${productName}, ${`hp-e2e-${tag}-p${i}`})
          returning id`;
        await sql`
          insert into product_variants (product_id, price, is_default)
          values (${product.id}, ${20_000 + i * 100}, true)`;
      }
    }
  } finally {
    await sql.end();
  }
}

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from banners`;
    await sql`delete from featured_products`;
    await sql`delete from products where code like ${`${CODE}-%`}`;
    await sql`delete from categories where slug like ${`hp-e2e-${tag}-%`}`;
    if (homeMainIds.length) {
      await sql`update categories set show_on_home = true where id in ${sql(homeMainIds)}`;
    }
    if (hiddenProductIds.length) {
      await sql`update products set status = 'active' where id in ${sql(hiddenProductIds)}`;
    }
  } finally {
    await sql.end();
  }
});

/** Replaces the picks with the products of these codes, in this order. */
async function setPicks(codes: readonly string[]) {
  const sql = localSql();
  try {
    await sql`delete from featured_products`;
    for (const [sort, code] of codes.entries()) {
      await sql`
        insert into featured_products (product_id, sort)
        select id, ${sort} from products where code = ${code}`;
    }
  } finally {
    await sql.end();
  }
}

/** A plain coloured picture made by the browser, `width` by `height`, as a file to pick. */
async function picture(page: Page, width: number, height: number) {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#1b1714";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#3a7bd5";
      context.fillRect(w / 4, h / 4, w / 2, h / 2);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    },
    [width, height] as const,
  );
  return { name: "picture.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

/** Waits until the picked picture is cropped, previewed, and in Storage. */
async function uploaded(dialog: ReturnType<Page["getByTestId"]>) {
  await expect(dialog.getByTestId("home-image-preview").locator("img")).toBeVisible();
  await expect(dialog.getByText("جارٍ الرفع")).toHaveCount(0, { timeout: 30_000 });
  await expect(dialog.getByText("تعذّر رفع الصورة")).toHaveCount(0);
}

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

async function openEditor(page: Page) {
  await page.goto("/admin/homepage");
  await expect(page.getByRole("heading", { level: 1, name: "الصفحة الرئيسية" })).toBeVisible();
  // The editor answers input once React has taken over the page.
  await expect(page.locator("[aria-busy]")).toHaveCount(0);
}

async function addBanner(page: Page, alt: string, linkTo: string | null) {
  await page.getByTestId("banner-add").click();
  const dialog = page.getByTestId("banner-dialog");
  await dialog.getByTestId("home-image-input").setInputFiles(await picture(page, 1800, 1200));
  await uploaded(dialog);
  await dialog.getByLabel("العنوان").fill(alt);
  if (linkTo) {
    await dialog.getByRole("radio", { name: "قسم" }).click();
    await dialog.getByLabel("القسم", { exact: true }).selectOption({ label: linkTo });
  }
  await dialog.getByTestId("banner-save").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("banner-row").filter({ hasText: alt })).toBeVisible();
}

async function saveEditor(page: Page) {
  await page.getByTestId("homepage-save").click();
  await expect(page.getByText("تم حفظ التغييرات.")).toBeVisible();
}

/** Ticks for Home only the named mains (every other main unticked), then saves. */
async function showOnlyMains(page: Page, names: readonly string[]) {
  await openEditor(page);
  for (const item of await page.getByTestId("homepage-mains").getByRole("listitem").all()) {
    const text = (await item.textContent()) ?? "";
    const tick = item.getByTestId("main-tick");
    if (names.some((name) => text.includes(name)) !== (await tick.isChecked())) await tick.click();
  }
  await saveEditor(page);
}

test("the owner runs Home and a customer sees it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "homepage", "runs once, after the other flows");
  test.setTimeout(300_000);
  await seed();
  await signInAdmin(page, accounts!, "/admin/homepage");
  await openEditor(page);
  await expect(page.getByText("لا توجد بانرات. تظهر بطاقة الترحيب بدلها.")).toBeVisible();

  // Two banners, the first linked to a category; a picture under 800 wide is refused (AC-10).
  await page.getByTestId("banner-add").click();
  const dialog = page.getByTestId("banner-dialog");
  await dialog.getByTestId("home-image-input").setInputFiles(await picture(page, 700, 700));
  await expect(dialog.getByText("الصورة صغيرة")).toBeVisible();
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await addBanner(page, LINKED, MAINS[0]);
  await addBanner(page, PLAIN, null);
  const rows = page.getByTestId("banner-row");
  await expect(rows.nth(0)).toContainText(`الرابط: ${MAINS[0]}`);
  await expect(rows.nth(1)).toContainText("الرابط: بدون رابط");

  // Reorder, untick the plain one, pick two products, untick the fourth main, then save (AC-8, AC-9).
  await page.getByRole("button", { name: `نقل لأعلى: ${PLAIN}` }).click();
  await expect(rows.nth(0)).toContainText(PLAIN);
  await rows.nth(0).getByRole("checkbox").click();
  const picker = page.getByLabel("إضافة منتج");
  for (const name of FEATURED) {
    await picker.fill(CODE);
    await page.getByRole("button", { name: `إضافة ${name}` }).click();
  }
  await expect(page.getByTestId("featured-row")).toHaveCount(2);
  await page.getByRole("checkbox", { name: MAINS[3] }).click();
  await saveEditor(page);
  await checkA11y(page);

  // A main's card photo and line, from the category dialog (AC-11; spec 0031 AC-2).
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: `تعديل: ${MAINS[0]}` }).click();
  const categoryDialog = page.getByTestId("category-dialog");
  await categoryDialog.getByTestId("home-image-input").setInputFiles(await picture(page, 600, 600));
  await uploaded(categoryDialog);
  await categoryDialog.getByLabel("السطر تحت الدائرة (اختياري)").fill(LINE);
  await categoryDialog.getByTestId("category-save").click();
  await expect(categoryDialog).toBeHidden();

  // The customer: the picks as the hero coverflow, the one active banner under it, its link, and
  // the category cards (spec 0011 AC-2; spec 0030 AC-1, AC-2, AC-12; spec 0031 AC-2).
  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const customer = await shopper.newPage();
  await customer.goto("/");
  const banner = customer.getByTestId("home-banners");
  await expect(banner.getByRole("img", { name: LINKED })).toBeVisible();
  await expect(banner.getByRole("img", { name: PLAIN })).toHaveCount(0);
  await expect(customer.locator("h1")).toHaveText(/الإضاءة المناسبة/);
  const hero = customer.getByTestId("home-hero");
  const heroBox = await hero.boundingBox();
  const bannerBox = await banner.boundingBox();
  expect(bannerBox!.y).toBeGreaterThanOrEqual(heroBox!.y + heroBox!.height);
  const cards = customer.getByTestId("home-category-tabs");
  for (const name of MAINS.slice(0, 3)) {
    await expect(cards.getByRole("tab", { name })).toBeAttached();
  }
  await expect(cards.getByRole("tab", { name: MAINS[3] })).toHaveCount(0);
  const photoCard = cards.getByRole("tab", { name: MAINS[0] });
  await expect(photoCard.getByText(LINE)).toBeAttached();
  await expect(photoCard.locator("img")).toHaveCount(1);
  const featured = customer.getByTestId("home-products");
  await expect(featured.locator("li")).toHaveCount(2);
  await expect(featured.getByRole("link")).toHaveCount(1);
  await expect(featured.getByRole("link")).toContainText(FEATURED[0]);
  await expect(customer.getByRole("button", { name: FEATURED[1] })).toBeVisible();
  await checkA11y(customer);

  // Two picks swap on every move: the other one's dot, then either arrow key (spec 0030 AC-9).
  await customer.getByRole("button", { name: FEATURED[1] }).click();
  await expect(featured.getByRole("link")).toContainText(FEATURED[1]);
  await customer.keyboard.press("ArrowLeft");
  await expect(featured.getByRole("link")).toContainText(FEATURED[0]);
  await customer.keyboard.press("ArrowRight");
  await expect(featured.getByRole("link")).toContainText(FEATURED[1]);

  // From md the banner sits centred at most 720 wide under the hero band, with no side card, and
  // the h1 stays the hero headline (spec 0030 AC-1, AC-12); the cards wrap (spec 0031 AC-4).
  const wide = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const tablet = await wide.newPage();
  await tablet.goto("/");
  const tabletBanner = await tablet
    .getByTestId("home-banners")
    .locator("img")
    .first()
    .boundingBox();
  expect(tabletBanner!.width).toBeLessThanOrEqual(720);
  await expect(tablet.getByTestId("home-side-card")).toHaveCount(0);
  await expect(
    tablet.getByTestId("home-category-tabs").getByRole("tab", { name: MAINS[0] }),
  ).toBeVisible();
  await tablet.setViewportSize({ width: 1280, height: 800 });
  await expect(tablet.getByTestId("home-side-card")).toHaveCount(0);
  await expect(tablet.locator("h1")).toHaveText(/الإضاءة المناسبة/);
  const desktopHero = await tablet.getByTestId("home-hero").boundingBox();
  const desktopBanner = await tablet
    .getByTestId("home-banners")
    .locator("img")
    .first()
    .boundingBox();
  expect(desktopBanner!.width).toBeLessThanOrEqual(720);
  expect(desktopBanner!.y).toBeGreaterThanOrEqual(desktopHero!.y + desktopHero!.height);
  expect(Math.round(desktopHero!.width)).toBe(
    await tablet.evaluate(() => document.documentElement.clientWidth),
  );
  await expect(tablet.getByTestId("home-products").locator("li")).toHaveCount(2);
  await checkA11y(tablet);
  await wide.close();

  await banner.getByTestId("banner-link").click();
  await expect(customer).toHaveURL(new RegExp(`/c/hp-e2e-${tag}-0$`));

  // Three, two, and one category still render as cards, the first selected (spec 0031 AC-2, AC-3).
  for (const count of [3, 2, 1]) {
    await showOnlyMains(page, MAINS.slice(0, count));
    await customer.goto("/");
    await expect(cards.getByRole("tab")).toHaveCount(count);
    await expect(cards.getByRole("tab", { name: MAINS[0] })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(customer.getByTestId("home-category-heading")).toHaveText(MAINS[0]);
  }
  await checkA11y(customer);

  // Every banner off: the hero stays, with its h1, and the banners go (spec 0030 AC-1).
  await openEditor(page);
  await page.getByTestId("banner-row").filter({ hasText: LINKED }).getByRole("checkbox").click();
  await saveEditor(page);
  await customer.goto("/");
  await expect(customer.getByRole("heading", { level: 1 })).toHaveText(/الإضاءة المناسبة/);
  await expect(customer.getByTestId("home-banners")).toHaveCount(0);
  await checkA11y(customer);

  // One pick shows alone: its link, no arrows, no dots, no live text (spec 0030 AC-9).
  await setPicks([`${CODE}-0`]);
  await customer.goto("/");
  await expect(featured.locator("li")).toHaveCount(1);
  await expect(featured.getByRole("link")).toContainText(FEATURED[0]);
  await expect(customer.getByTestId("hero-dots")).toHaveCount(0);
  await expect(hero.getByRole("button")).toHaveCount(0);
  await expect(hero.locator("[aria-live]")).toHaveCount(0);
  await checkA11y(customer);

  // No picks: the newest sellable products fill the hero, the newest centred (spec 0030 AC-2).
  await setPicks([]);
  await customer.goto("/");
  expect(await featured.locator("li").count()).toBeGreaterThanOrEqual(4);
  await expect(featured.getByRole("link")).toContainText(`منتج ${tag} 3`);

  // No sellable product at all: the fallback card with the chandelier and the same h1 (AC-11).
  const sql = localSql();
  try {
    const hidden = await sql<{ id: string }[]>`
      update products set status = 'hidden' where status = 'active' returning id`;
    hiddenProductIds = hidden.map((row) => row.id);
  } finally {
    await sql.end();
  }
  await customer.goto("/");
  await expect(customer.getByRole("heading", { level: 1 })).toHaveText(/الإضاءة المناسبة/);
  await expect(customer.getByTestId("home-products")).toHaveCount(0);
  await expect(hero.locator("svg").first()).toBeVisible();
  // The fallback card is white too, line 2 on the brand marker (spec 0032 AC-11).
  await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(customer.locator("h1 span").nth(1)).toHaveCSS(
    "background-color",
    "rgb(247, 147, 30)",
  );
  // Every solid part of the chandelier (chain, sleeves, crystals) shows on white: 1.5:1 or more.
  // The faint glow circles carry their own low opacity and are left out (spec 0032 AC-11).
  const faint = await hero
    .locator("svg")
    .first()
    .evaluate((svg) => {
      const channel = (v: number) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (colour: string) => {
        const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? []).map(Number);
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      return Array.from(svg.querySelectorAll("line, rect, path, circle"))
        .filter((part) => !part.hasAttribute("opacity"))
        .map((part) => {
          const style = getComputedStyle(part);
          const paint = style.fill !== "none" ? style.fill : style.stroke;
          return { tag: part.tagName, paint, ratio: 1.05 / (luminance(paint) + 0.05) };
        })
        .filter((part) => part.ratio < 1.5);
    });
  expect(faint).toEqual([]);
  await checkA11y(customer);
  // The same light fallback on the tablet and desktop band (spec 0032 AC-13).
  for (const width of [820, 1280]) {
    await customer.setViewportSize({ width, height: 900 });
    await customer.goto("/");
    await expect(hero.locator("svg").first()).toBeVisible();
    await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(customer.locator("h1 span").nth(1)).toHaveCSS(
      "background-color",
      "rgb(247, 147, 30)",
    );
    // A band across the whole screen like the coverflow, not a card (spec 0032 AC-5, AC-11).
    await expect(hero).toHaveCSS("border-top-left-radius", "0px");
    await expect(hero).toHaveCSS("border-bottom-width", "1px");
    await expect(hero).toHaveCSS("border-inline-start-width", "0px");
    const box = await hero.boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(width);
    await checkA11y(customer);
  }
  await shopper.close();
});
