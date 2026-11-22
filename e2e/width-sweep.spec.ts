import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { fillCart, sellableVariant } from "./accounts";
import { adminAccounts } from "./admin-auth";
import { expectNoAxeViolations, expectNoSidewaysScroll, expectTouchTargets } from "./a11y";
import { seededChandelier } from "./categories";
import { localSql } from "./local-db";
import { ownIpHeaders } from "./own-ip";

// covers: scope feature 39 (the widths spec 0029 left open). Runs only on the `small-phone`
// (320 by 568), `landscape` (844 by 390, a phone held sideways), and `monitor` (2560 by 1440)
// projects: every storefront page keeps its targets, passes axe, and never scrolls sideways; a
// sideways phone keeps the header, the bottom bar, the float, and every sheet usable; a large
// monitor keeps the content centred at 1280 with the shell backgrounds across the whole screen.

const accounts = adminAccounts();

const isMonitor = (testInfo: TestInfo) => testInfo.project.name === "monitor";
const isLandscape = (testInfo: TestInfo) => testInfo.project.name === "landscape";

const box = async (target: Locator) => (await target.boundingBox())!;
const overlaps = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const bottomBar = (page: Page) => page.getByRole("navigation", { name: "التنقل الرئيسي" });
const fab = (page: Page) => page.getByRole("link", { name: "واتساب", exact: true });
const menuButton = (page: Page) => page.getByRole("button", { name: "القائمة" });

/** The seeded pages the sweep visits, with one line in the cart for the cart and checkout. */
async function pages(page: Page, baseURL: string) {
  const sql = localSql();
  try {
    const seeded = await seededChandelier(sql);
    await fillCart(page, baseURL, await sellableVariant(sql));
    return [
      "/",
      "/c",
      `/c/${encodeURIComponent(seeded.category)}`,
      `/p/${encodeURIComponent(seeded.product)}`,
      `/search?q=${encodeURIComponent("ثريا")}`,
      "/cart",
      "/checkout",
      "/orders/track",
      "/account/sign-in",
      "/account/reset-password",
      "/policies/terms",
      "/p/no-such-product-width-sweep",
      "/no-such-page-width-sweep",
    ] as const;
  } finally {
    await sql.end();
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.skip(
    !["small-phone", "landscape", "monitor"].includes(testInfo.project.name),
    "the width sweep projects only",
  );
  // Checkout and lookups count per IP; this flow keeps an allowance of its own.
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
});

/** The shell at this width: the content box on a monitor, the fixed parts on a sideways phone. */
async function expectShell(page: Page, testInfo: TestInfo) {
  const { width, height } = page.viewportSize()!;
  const screen = await page.evaluate(() => document.documentElement.clientWidth);

  if (isMonitor(testInfo)) {
    // The header and footer backgrounds run edge to edge; their words, and the page, sit in the
    // centred 1280 box with 32px at its sides (spec 0029 AC-3), with no bottom bar (AC-6).
    const header = await box(page.locator("header").first());
    const footer = await box(page.locator("footer"));
    expect(header.x).toBe(0);
    expect(Math.round(header.width)).toBe(screen);
    expect(Math.round(footer.width)).toBe(screen);
    await expect(bottomBar(page)).toBeHidden();
    const frame = await box(page.locator("main > div").last());
    expect(Math.round(frame.width)).toBeLessThanOrEqual(1280);
    expect(Math.abs(frame.x + frame.width / 2 - screen / 2)).toBeLessThan(1);
    const logo = await box(page.locator("header").first().getByRole("link").first());
    // Right to left: the start edge is the right one.
    expect(Math.round((screen + 1280) / 2 - (logo.x + logo.width))).toBe(32);
    const float = await box(fab(page));
    expect(Math.round(float.x)).toBe(24);
    expect(Math.round(height - (float.y + float.height))).toBe(24);
    return;
  }

  // A phone: the header at the top, the bar along the bottom edge, the float above it, and some
  // page between them even at 390 tall.
  await expect(menuButton(page)).toBeVisible();
  const header = await box(page.locator("header").first());
  expect(Math.round(header.width)).toBe(isLandscape(testInfo) ? screen : Math.min(width, 480));
  const bar = await box(bottomBar(page));
  expect(Math.round(bar.y + bar.height)).toBe(height);
  expect(Math.round(bar.width)).toBe(Math.min(screen, isLandscape(testInfo) ? screen : 480));
  for (const tab of await bottomBar(page).getByRole("link").all()) {
    const tabBox = await box(tab);
    expect(tabBox.height).toBeGreaterThanOrEqual(44);
    expect(tabBox.width).toBeGreaterThanOrEqual(44);
  }
  const float = await box(fab(page));
  expect(float.y + float.height).toBeLessThanOrEqual(height);
  expect(float.y + float.height).toBeLessThanOrEqual(bar.y);
  expect(overlaps(float, bar)).toBe(false);
  expect(float.x).toBeGreaterThanOrEqual(0);
  expect(bar.y - (header.y + header.height)).toBeGreaterThanOrEqual(120);
}

test("keeps every storefront page in one piece at this width", async ({
  page,
  baseURL,
}, testInfo) => {
  test.setTimeout(300_000);
  const paths = await pages(page, baseURL!);
  for (const path of paths) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
      await expectNoSidewaysScroll(page);
      await expectTouchTargets(page);
      await expectNoAxeViolations(page);
      await expectShell(page, testInfo);
      // At the end of the page no footer link sits under the float or the bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expectNoSidewaysScroll(page);
      const float = await box(fab(page));
      const bar = isMonitor(testInfo) ? null : await box(bottomBar(page));
      for (const link of await page.locator("footer").getByRole("link").all()) {
        const linkBox = await box(link);
        expect(overlaps(linkBox, float)).toBe(false);
        if (bar) expect(overlaps(linkBox, bar)).toBe(false);
      }
    });
  }
});

test.describe("a phone held sideways", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isLandscape(testInfo), "landscape only");
  });

  test("scrolls the menu sheet inside itself down to its last link", async ({ page }) => {
    await page.goto("/");
    await menuButton(page).click();
    const menu = page.getByRole("dialog", { name: "القائمة" });
    await expect(menu).toBeVisible();
    const { height } = page.viewportSize()!;
    const menuBox = await box(menu);
    expect(Math.round(menuBox.height)).toBe(height);
    expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const last = menu.getByRole("link", { name: "تواصل معنا عبر واتساب" });
    await last.scrollIntoViewIfNeeded();
    const lastBox = await box(last);
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(height + 1);
    await expect(last).toBeInViewport();
    await expectNoSidewaysScroll(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("keeps the filters screen's buttons on screen and its fields scrolling", async ({
    page,
  }) => {
    const sql = localSql();
    try {
      const { category } = await seededChandelier(sql);
      await page.goto(`/c/${encodeURIComponent(category)}`);
    } finally {
      await sql.end();
    }
    await page.getByTestId("filters-button").click({ timeout: 15_000 });
    const screen = page.getByTestId("filters-screen");
    await expect(screen).toBeVisible();
    const { height } = page.viewportSize()!;
    // "عرض N منتج", or "عرض النتائج" before the count is known.
    const apply = screen.getByRole("button", { name: /^عرض/ });
    await expect(apply).toBeInViewport();
    const applyBox = await box(apply);
    expect(applyBox.y + applyBox.height).toBeLessThanOrEqual(height + 1);
    await expect(screen.getByRole("heading", { level: 1 })).toBeInViewport();
    await expectNoAxeViolations(page);
  });

  test("keeps the add to cart button reachable on a product page", async ({ page }) => {
    const sql = localSql();
    try {
      const { product } = await seededChandelier(sql);
      await page.goto(`/p/${encodeURIComponent(product)}`);
    } finally {
      await sql.end();
    }
    const add = page.getByTestId("add-to-cart");
    await add.scrollIntoViewIfNeeded();
    await expect(add).toBeInViewport({ timeout: 15_000 });
    const addBox = await box(add);
    const bar = await box(bottomBar(page));
    const float = await box(fab(page));
    expect(overlaps(addBox, bar)).toBe(false);
    expect(overlaps(addBox, float)).toBe(false);
  });
});

test.describe("a small phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "small-phone", "320 wide only");
  });

  test("fits the hero's centre card and the search box inside the screen", async ({ page }) => {
    await page.goto("/");
    const { width } = page.viewportSize()!;
    const search = await box(page.getByRole("search"));
    expect(search.x).toBeGreaterThanOrEqual(0);
    expect(search.x + search.width).toBeLessThanOrEqual(width);
    const products = page.getByTestId("home-products");
    if (await products.count()) {
      const centre = await box(products.getByRole("group").first());
      expect(centre.x).toBeGreaterThanOrEqual(0);
      expect(centre.x + centre.width).toBeLessThanOrEqual(width);
    }
    await expectNoSidewaysScroll(page);
  });

  test("stacks the hero buttons and wraps the card's WhatsApp square under its add button", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Below 360 (the `narrow` variant) the pairs that fit side by side at 390 wrap.
    await page.goto("/");
    const hero = page.getByTestId("home-hero");
    // Home streams behind loading.tsx: wait for the hero to leave React's hidden container.
    await expect(hero).toBeVisible({ timeout: 15_000 });
    const buttons = hero.locator("a[href*='wa.me'], a[href^='#']");
    if ((await buttons.count()) === 2) {
      const [first, second] = await Promise.all([box(buttons.nth(0)), box(buttons.nth(1))]);
      expect(second.y).toBeGreaterThan(first.y + first.height - 1);
      expect(Math.round(first.width)).toBe(Math.round(second.width));
    }

    const sql = localSql();
    try {
      const { category } = await seededChandelier(sql);
      await page.goto(`/c/${encodeURIComponent(category)}`);
    } finally {
      await sql.end();
    }
    const card = page.getByTestId("product-card").first();
    const add = card.getByTestId("card-add-to-cart");
    await expect(add).toBeVisible({ timeout: 15_000 });
    const addBox = await box(add);
    const whatsapp = await box(card.locator("a[href*='wa.me']"));
    expect(whatsapp.y).toBeGreaterThan(addBox.y + addBox.height - 1);
    // The button's words fit inside it, and nothing sticks out of the card.
    expect(await add.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const cardBox = await box(card);
    expect(addBox.x).toBeGreaterThanOrEqual(cardBox.x);
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
    await expectTouchTargets(page);
  });
});
