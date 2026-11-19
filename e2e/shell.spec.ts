import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import {
  expectFocusOutline,
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { adminAccounts } from "./admin-auth";
import { localSql } from "./local-db";

// covers: AC-11 to AC-17, AC-20 (spec 0003): the storefront shell on the real home page.
// covers: AC-1, AC-3 to AC-8, AC-22 (spec 0029): the same shell at 820 (tablet) and 1280 (desktop).
// Runs at 390x844 (phone), 820x1180 (tablet), and 1280x800 (desktop).

test.beforeEach(async ({ page }, testInfo) => {
  await usePhoneWidth(page, testInfo);
  await page.goto("/");
});

const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function box(locator: Locator) {
  const result = await locator.boundingBox();
  if (!result) throw new Error("element has no box");
  return result;
}

/** True at lg and wider: the one row header, no menu button, no bottom bar. */
const isDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop";
const isPhone = (testInfo: TestInfo) => testInfo.project.name === "phone";

const bottomBar = (page: Page) => page.getByRole("navigation", { name: "التنقل الرئيسي" });
const fab = (page: Page) => page.getByRole("link", { name: "واتساب", exact: true });

test.describe("storefront shell", () => {
  test("passes axe, keeps targets at 44, and never scrolls sideways", async ({ page }) => {
    await expectNoAxeViolations(page);
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  });

  test("puts the page in one centered column at most 480 wide below md", async ({
    page,
  }, testInfo) => {
    test.skip(!isPhone(testInfo), "below md only");
    const main = await box(page.locator("main#main"));
    const width = page.viewportSize()!.width;
    expect(main.width).toBeLessThanOrEqual(480);
    expect(Math.abs(main.x + main.width / 2 - width / 2)).toBeLessThan(1);
  });

  // covers: AC-3 (spec 0029)
  test("spans the header and footer across the screen from md, content in the box", async ({
    page,
  }, testInfo) => {
    test.skip(isPhone(testInfo), "from md only");
    const width = page.viewportSize()!.width;
    const header = await box(page.locator("header").first());
    const footer = await box(page.locator("footer"));
    expect(header.x).toBe(0);
    expect(header.width).toBe(width);
    expect(footer.width).toBe(width);
    // The footer's inner row: inside the 1280 box, centred, with --page-pad at the sides.
    const pad = isDesktop(testInfo) ? 32 : 24;
    const links = await box(page.getByRole("navigation", { name: "روابط السياسات" }));
    expect(links.x).toBeGreaterThanOrEqual((width - Math.min(width, 1280)) / 2 + pad - 1);
  });

  // covers: AC-5, AC-11, AC-20
  test("starts with the skip link, then the menu button with an orange outline", async ({
    page,
  }, testInfo) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "تخطي إلى المحتوى" });
    await expect(skip).toBeFocused();

    await page.keyboard.press("Tab");
    // From lg the menu button is hidden and the logo link comes first (spec 0029 AC-4).
    await expectFocusOutline(
      isDesktop(testInfo)
        ? page.locator("header").getByRole("link", { name: "S.K.F lighting" })
        : page.getByRole("button", { name: "القائمة" }),
      "brand",
    );

    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("outlines the search box, not the field inside it, on keyboard focus", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "ابحث في المتجر" });
    await search.focus();
    const box = page.locator("label", { has: search });
    await expect(box).toHaveCSS("outline-style", "solid");
    await expect(box).toHaveCSS("outline-color", "rgb(247, 147, 30)");
  });

  // covers: AC-12
  test("shows the header with the logo link home, the cart, and the info strip on /", async ({
    page,
  }) => {
    const header = page.locator("header").first();
    await expect(header.getByRole("link", { name: "S.K.F lighting" })).toHaveAttribute("href", "/");
    // One cart link shows at a time (spec 0029 AC-4).
    const cart = header.getByRole("link", { name: "السلة", exact: true });
    await expect(cart).toHaveCount(1);
    await expect(cart).toHaveAttribute("href", "/cart");
    await expect(page.getByText("التوصيل إلى الضفة ₪20 · الداخل ₪70")).toBeVisible();
    // One search landmark at every width.
    await expect(page.getByRole("search")).toHaveCount(1);
  });

  test("submits the search as GET /search?q=", async ({ page }) => {
    const search = page.getByRole("searchbox", { name: "ابحث في المتجر" });
    await search.fill("ثريا ذهبية");
    await search.press("Enter");
    await page.waitForURL(/\/search\?/);
    const url = new URL(page.url());
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe("ثريا ذهبية");
  });

  test("allows an empty search, which goes to /search", async ({ page }) => {
    await page.getByRole("button", { name: "بحث", exact: true }).click();
    await page.waitForURL(/\/search/);
    expect(new URL(page.url()).pathname).toBe("/search");
  });

  // covers: AC-13
  test("opens the menu with the tab links, the policies, and WhatsApp, and returns focus", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), "no menu button from lg (spec 0029 AC-4)");
    const menu = page.getByRole("button", { name: "القائمة" });
    await menu.click();
    const sheet = page.getByRole("dialog", { name: "القائمة" });
    await expect(sheet.getByRole("button", { name: "إغلاق" })).toBeFocused();

    // The shop's categories in navigation sit between the tabs and the policies (spec 0008
    // AC-14); which ones depends on the data, so the fixed links are checked around them.
    const links = sheet.getByRole("link");
    const categories = sheet.getByTestId("menu-categories").getByRole("link");
    const texts = await links.allTextContents();
    const categoryTexts = await categories.allTextContents();
    expect(texts.filter((text) => !categoryTexts.includes(text))).toEqual([
      "الرئيسية",
      "الأقسام",
      "السلة",
      "بحث",
      "حسابي",
      "سياسة الخصوصية",
      "الشروط والأحكام",
      "سياسة الإرجاع",
      "تواصل معنا عبر واتساب",
    ]);
    expect(texts.slice(5, 5 + categoryTexts.length)).toEqual(categoryTexts);
    const whatsapp = new URL((await links.last().getAttribute("href"))!);
    expect(whatsapp.searchParams.get("text")).toBe("مرحبًا S.K.F، لديّ استفسار.");

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(menu).toBeFocused();
  });

  // covers: AC-16
  test("marks الرئيسية as the current tab on /", async ({ page }, testInfo) => {
    test.skip(isDesktop(testInfo), "no bottom bar from lg (spec 0029 AC-6)");
    const bar = bottomBar(page);
    await expect(bar.getByRole("link")).toHaveText([
      "الرئيسية",
      "الأقسام",
      "السلة",
      "بحث",
      "حسابي",
    ]);
    await expect(bar.getByRole("link", { name: "الرئيسية" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.locator("[aria-current]")).toHaveCount(1);
    await expect(bar.getByRole("link", { name: "حسابي" })).toHaveAttribute(
      "href",
      "/account/orders",
    );
  });

  // covers: AC-17
  test("opens WhatsApp from the float with W1 and the configured number", async ({ page }) => {
    await expect(fab(page)).toHaveAttribute("target", "_blank");
    await expect(fab(page)).toHaveAttribute("rel", "noopener");
    const href = new URL((await fab(page).getAttribute("href"))!);
    expect(href.origin + href.pathname).toBe("https://wa.me/970500000000");
    expect(href.searchParams.get("text")).toBe("مرحبًا S.K.F، لديّ استفسار.");
  });

  // covers: AC-7 (spec 0029)
  test("keeps the float 24px from the screen's end edge from md", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo), "from md only");
    const float = await box(fab(page));
    const { height } = page.viewportSize()!;
    // Right to left: the end edge is the left one.
    expect(Math.round(float.x)).toBe(24);
    const bottom = height - (float.y + float.height);
    expect(Math.round(bottom)).toBe(isDesktop(testInfo) ? 24 : 84);
  });

  // covers: AC-11
  test("keeps every footer link clear of the float and the bar at the end of the page", async ({
    page,
  }, testInfo) => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const float = await box(fab(page));
    const bar = isDesktop(testInfo) ? null : await box(bottomBar(page));
    // "تتبّع طلبك" (spec 0015 AC-15) and the three policy links; from lg also the shop column
    // and the WhatsApp button (spec 0029 AC-8).
    await expect(
      page.getByRole("navigation", { name: "روابط السياسات" }).getByRole("link"),
    ).toHaveCount(4);
    const footerLinks = page.locator("footer").getByRole("link");
    for (const link of await footerLinks.all()) {
      const linkBox = await box(link);
      expect(linkBox.height).toBeGreaterThanOrEqual(44);
      expect(overlaps(linkBox, float)).toBe(false);
      if (bar) expect(overlaps(linkBox, bar)).toBe(false);
    }
  });

  test("scrolls a focused field clear of the bottom bar", async ({ page }, testInfo) => {
    await expect(page.locator("html")).toHaveCSS(
      "scroll-padding-bottom",
      isDesktop(testInfo) ? "0px" : "64px",
    );
  });
});

// covers: AC-4 to AC-8 (spec 0029)
test.describe("desktop shell", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isDesktop(testInfo), "lg and wider only");
  });

  test("puts logo, search, account, and cart in one row, in that reading order", async ({
    page,
  }) => {
    const header = page.locator("header").first();
    const logo = await box(header.getByRole("link", { name: "S.K.F lighting" }));
    const search = await box(page.getByRole("search"));
    const account = header.getByRole("link", { name: "حسابي" });
    const cart = await box(header.getByRole("link", { name: "السلة", exact: true }));
    await expect(account).toHaveAttribute("href", "/account/orders");
    const accountBox = await box(account);
    // Right to left: each next item sits further left, all on one row.
    expect(logo.x).toBeGreaterThan(search.x);
    expect(search.x).toBeGreaterThan(accountBox.x);
    expect(accountBox.x).toBeGreaterThan(cart.x);
    for (const item of [search, accountBox, cart]) {
      expect(Math.abs(item.y + item.height / 2 - (logo.y + logo.height / 2))).toBeLessThan(2);
    }
    expect(search.width).toBeLessThanOrEqual(640);
    await expect(header).toHaveCSS("position", "static");

    // Tab order follows it (spec 0029 AC-21).
    await header.getByRole("link", { name: "S.K.F lighting" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("searchbox", { name: "ابحث في المتجر" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(account).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(header.getByRole("link", { name: "السلة", exact: true })).toBeFocused();
  });

  test("hides the menu button and the bottom bar, and keeps no room for the bar", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "القائمة" })).toBeHidden();
    await expect(bottomBar(page)).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const footer = await box(page.locator("footer"));
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(Math.round(footer.y + footer.height + (await page.evaluate(() => window.scrollY)))).toBe(
      scrollHeight,
    );
  });

  test("lays the footer out in three columns: brand, shop, and help, then the copyright", async ({
    page,
  }) => {
    const footer = page.locator("footer");
    const logo = await box(footer.getByRole("img", { name: "S.K.F lighting" }));
    const help = await box(page.getByRole("navigation", { name: "روابط السياسات" }));
    // Right to left: the brand column at the start (right), help at the end (left).
    expect(logo.x).toBeGreaterThan(help.x + help.width - 1);
    await expect(footer.getByTestId("footer-whatsapp")).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\//,
    );
    const shop = footer.getByRole("navigation", { name: "المتجر" });
    if (await shop.count()) {
      const shopBox = await box(shop);
      expect(shopBox.x).toBeGreaterThan(help.x + help.width - 1);
      expect(shopBox.x + shopBox.width).toBeLessThan(logo.x);
      await expect(shop.getByRole("link").last()).toHaveAttribute("href", "/c");
    }
    const copyright = footer.getByTestId("footer-copyright");
    await expect(copyright).toContainText("جميع الحقوق محفوظة");
    expect((await box(copyright)).y).toBeGreaterThan(help.y + help.height);
  });

  test("lists the navigation categories in the bar and marks the current one", async ({ page }) => {
    const bar = page.getByRole("navigation", { name: "الأقسام" });
    test.skip((await bar.count()) === 0, "needs main categories in navigation (pnpm db:seed)");
    // The fixed "جميع المنتجات" link opens the row; the categories follow in the list.
    await expect(bar.getByTestId("category-bar-all").getByRole("link")).toHaveAttribute(
      "href",
      "/c",
    );
    // The fixed "استشارة إنارة" link closes the row and opens WhatsApp with the advice message.
    const consult = bar
      .getByTestId("category-bar-consult")
      .getByRole("link", { name: "استشارة إنارة" });
    await expect(consult).toHaveAttribute("target", "_blank");
    expect(new URL((await consult.getAttribute("href"))!).searchParams.get("text")).toBe(
      "مرحبًا، أرغب في استشارة لاختيار الإنارة المناسبة.",
    );
    const first = bar.getByRole("list").getByRole("link").first();
    const name = (await first.textContent())!.trim();
    const href = (await first.getAttribute("href"))!;
    expect(href).toMatch(/^\/c\//);
    await expect(bar.locator("[aria-current]")).toHaveCount(0);

    await first.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(bar.getByRole("link", { name, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.locator("[aria-current]")).toHaveCount(1);
  });

  test("opens المزيد by keyboard, ends it with جميع المنتجات, and closes it with Escape", async ({
    page,
  }) => {
    // Before it fits the row, the bar shows المزيد with every category.
    await expect(page.getByTestId("category-bar")).toHaveAttribute("data-fitted", "");
    const more = page.getByTestId("category-bar-more");
    test.skip((await more.count()) === 0, "needs more categories than fit in the bar");
    await more.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").last()).toHaveText("جميع المنتجات");
    await expect(menu.getByRole("menuitem").last()).toHaveAttribute("href", "/c");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
  });
});

// covers: AC-5, AC-22 (spec 0029): at 1024, with ten more mains than the seed has, the bar keeps
// the links that fit and moves the rest, in order, into المزيد.
test.describe("category bar at 1024", () => {
  const tag = Date.now().toString(36);
  const CODE = `BAR-E2E-${tag.toUpperCase()}`;
  const MAINS = 10;
  const ready = (testInfo: TestInfo) => isDesktop(testInfo) && !!adminAccounts();

  test.beforeAll(async ({}, testInfo) => {
    if (!ready(testInfo)) return;
    const sql = localSql();
    try {
      for (let i = 0; i < MAINS; i += 1) {
        // Last in the order and off Home, so the other flows see the seed first as before.
        const [main] = await sql<{ id: string }[]>`
          insert into categories (name, slug, sort, show_on_home)
          values (${`قسم الشريط ${i + 1} ${tag}`}, ${`bar-e2e-${tag}-${i}`}, ${1000 + i}, false)
          returning id`;
        const [product] = await sql<{ id: string }[]>`
          insert into products (category_id, code, name, slug, created_at)
          values (${main.id}, ${`${CODE}-${i}`}, ${`منتج الشريط ${tag} ${i}`},
                  ${`bar-e2e-${tag}-p${i}`}, now() - interval '10 years')
          returning id`;
        await sql`
          insert into product_variants (product_id, price, is_default)
          values (${product.id}, ${10_000}, true)`;
      }
    } finally {
      await sql.end();
    }
  });

  test.afterAll(async ({}, testInfo) => {
    if (!ready(testInfo)) return;
    const sql = localSql();
    try {
      await sql`delete from products where code like ${`${CODE}%`}`;
      await sql`delete from categories where slug like ${`bar-e2e-${tag}-%`}`;
    } finally {
      await sql.end();
    }
  });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!ready(testInfo), "desktop, with the local Supabase and the dev seed");
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("category-bar")).toHaveAttribute("data-fitted", "");
  });

  const bar = (page: Page) => page.getByRole("navigation", { name: "الأقسام" });

  test("keeps the links that fit in the row and lists the rest in المزيد, in order", async ({
    page,
  }) => {
    const names = (await bar(page).locator("li").allTextContents()).map((name) => name.trim());
    expect(names.length).toBeGreaterThanOrEqual(MAINS);
    const more = page.getByTestId("category-bar-more");
    await expect(more).toBeVisible();

    const links = bar(page).getByRole("list").getByRole("link");
    const shown = await links.count();
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(names.length);
    expect((await links.allTextContents()).map((name) => name.trim())).toEqual(
      names.slice(0, shown),
    );
    // The last link in the row ends before the button: nothing is clipped or covered.
    const last = await box(links.last());
    const button = await box(more);
    expect(last.x).toBeGreaterThanOrEqual(button.x + button.width);

    await more.focus();
    await page.keyboard.press("Space");
    const items = page.getByRole("menu").getByRole("menuitem");
    expect((await items.allTextContents()).map((name) => name.trim())).toEqual([
      ...names.slice(shown),
      "جميع المنتجات",
    ]);
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
  });

  test("fits more links into a wider window", async ({ page }) => {
    const links = bar(page).getByRole("list").getByRole("link");
    const narrow = await links.count();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => links.count()).toBeGreaterThan(narrow);
  });
});

// covers: AC-6 (spec 0029): the tablet keeps the phone header and bottom bar.
test.describe("tablet shell", () => {
  test("shows the menu button, the bottom bar, and no category bar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "tablet", "tablet only");
    await expect(page.getByRole("button", { name: "القائمة" })).toBeVisible();
    await expect(bottomBar(page)).toBeVisible();
    await expect(page.getByRole("navigation", { name: "الأقسام" })).toBeHidden();
  });
});

// covers: AC-13, AC-21
test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the menu without sliding", async ({ page }, testInfo) => {
    test.skip(isDesktop(testInfo), "no menu button from lg (spec 0029 AC-4)");
    await page.getByRole("button", { name: "القائمة" }).click();
    await expect(page.getByRole("dialog", { name: "القائمة" })).toHaveCSS(
      "transition-duration",
      "0s",
    );
  });
});
