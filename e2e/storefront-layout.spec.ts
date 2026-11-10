import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { buildSearchText, sizeKey } from "../src/features/catalog/search-text";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { seededChandelier } from "./categories";
import { localSql } from "./local-db";
import { ownIpHeaders } from "./own-ip";

// covers: AC-1, AC-3, AC-9 to AC-14, AC-17, AC-19 to AC-22 (spec 0029): the storefront pages that
// are converted to their tablet and desktop layouts, on all three projects: the category page with
// its filter column, search, /c, product, Home, cart, checkout, and the narrow pages.

const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  await usePhoneWidth(page, testInfo);
});

/** Grid columns per project (spec 0029 AC-9); at lg the filter column takes one. */
const columns: Readonly<Record<string, number>> = { phone: 2, tablet: 3, desktop: 3 };

const pad: Readonly<Record<string, number>> = { phone: 16, tablet: 24, desktop: 32 };

/** How many column tracks the grid has (the seed may hold fewer products than columns). */
async function columnCount(page: Page, testId: string): Promise<number> {
  return page
    .getByTestId(testId)
    .evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(" ").length);
}

async function openCategory(page: Page) {
  const sql = localSql();
  try {
    const { category } = await seededChandelier(sql);
    await page.goto(`/c/${encodeURIComponent(category)}`);
  } finally {
    await sql.end();
  }
  // The first visit compiles the route on the dev server.
  await expect(page.getByTestId("category-products")).toBeVisible({ timeout: 15_000 });
}

// A category of its own for the filter column and search: two sizes, three products, one word.
const tag = Date.now().toString(36);
const CODE = `LAYOUT-E2E-${tag.toUpperCase()}`;
const SLUG = `layout-e2e-${tag}`;
const WORD = `تخطيط${tag}`;

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    // Off Home and last in the order, so the other flows see the seed first as before.
    const [category] = await sql<{ id: string }[]>`
      insert into categories (name, slug, sort, show_on_home)
      values (${`تخطيط ${tag}`}, ${SLUG}, 2000, false) returning id`;
    const sizes = ["60 سم", "80 سم", "60 سم"] as const;
    for (const [i, size] of sizes.entries()) {
      const name = `${WORD} ${i + 1}`;
      const code = `${CODE}-${i}`;
      const [product] = await sql<{ id: string }[]>`
        insert into products (category_id, code, name, slug, search_text, created_at)
        values (${category.id}, ${code}, ${name}, ${code.toLowerCase()},
                ${buildSearchText(name, code, [])}, now() - interval '10 years')
        returning id`;
      await sql`
        insert into product_variants (product_id, size_label, size_key, price, is_default)
        values (${product.id}, ${size}, ${sizeKey(size)}, ${10_000 + i * 10_000}, true)`;
    }
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}%`}`;
    await sql`delete from categories where slug = ${SLUG}`;
  } finally {
    await sql.end();
  }
});

const isDesktop = (testInfo: TestInfo) => testInfo.project.name === "desktop";

test.describe("category page", () => {
  test("grows the grid with the screen, inside the content box", async ({ page }, testInfo) => {
    await openCategory(page);
    const project = testInfo.project.name;
    expect(await columnCount(page, "category-products")).toBe(columns[project]);

    // The page content sits in a centred box at most 1280 wide, with --page-pad at its sides.
    const width = page.viewportSize()!.width;
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    const boxWidth = project === "phone" ? Math.min(width, 480) : Math.min(width, 1280);
    const boxStart = (width + boxWidth) / 2; // right to left: the start edge is the right one
    expect(Math.round(boxStart - (heading!.x + heading!.width))).toBe(pad[project]);
  });

  test("passes axe, keeps targets at 44, and never scrolls sideways", async ({ page }) => {
    await openCategory(page);
    await expectNoAxeViolations(page);
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  });

  test("gives card photos the sizes of their new widths", async ({ page }) => {
    await openCategory(page);
    const photo = page.getByTestId("product-card").locator("img").first();
    test.skip((await photo.count()) === 0, "the seeded products have no photos");
    await expect(photo).toHaveAttribute(
      "sizes",
      "(min-width: 1024px) 300px, (min-width: 768px) 33vw, (min-width: 480px) 240px, 50vw",
    );
  });

  test("wraps the sub category chips from md instead of scrolling them", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "phone", "from md only");
    await openCategory(page);
    const subs = page.getByRole("navigation", { name: "الأقسام الفرعية" });
    test.skip((await subs.count()) === 0, "the seeded category has no sub chips");
    const sideways = await subs.evaluate((nav) => nav.scrollWidth - nav.clientWidth);
    expect(sideways).toBeLessThanOrEqual(0);
  });

  // covers: AC-19
  test("draws an ink border on a hovered card, only where hover exists", async ({
    page,
  }, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "desktop", "a pointer that hovers");
    await openCategory(page);
    const card = page.getByTestId("product-card").first();
    await expect(card).toHaveCSS("border-top-color", "rgb(222, 222, 216)");
    await card.hover();
    await expect(card).toHaveCSS("border-top-color", "rgb(17, 17, 17)");
  });
});

// covers: AC-1, AC-17 (spec 0029): forms in a centred 560 column, policies in a 720 one; on a
// phone both are the 480 column as before.
test.describe("narrow pages", () => {
  const cases = [
    { path: "/orders/track", max: 560 },
    { path: "/account/sign-in", max: 560 },
    { path: "/policies/terms", max: 720 },
  ] as const;

  for (const { path, max } of cases) {
    test(`centres ${path} in a ${max} column`, async ({ page }, testInfo) => {
      await page.goto(path);
      const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
      const width = page.viewportSize()!.width;
      const column = Math.min(width, testInfo.project.name === "phone" ? 480 : max);
      // Right to left: the heading starts at the column's right edge, inside the side padding.
      expect(Math.round((width + column) / 2 - (heading!.x + heading!.width))).toBe(
        pad[testInfo.project.name],
      );
      await expectNoAxeViolations(page);
      await expectNoSidewaysScroll(page);
    });
  }
});

// covers: AC-14 (spec 0029): one centred column below lg; from lg the lines or form cards at the
// start and the summary at the end, sticky only in a tall enough window.
test.describe("cart and checkout", () => {
  test.beforeEach(async ({ page }) => {
    // Checkout sends count per IP (spec 0004 AC-10); this flow keeps an allowance of its own.
    await page.context().setExtraHTTPHeaders(ownIpHeaders());
    const sql = localSql();
    try {
      const { product } = await seededChandelier(sql);
      await page.goto(`/p/${encodeURIComponent(product)}`);
    } finally {
      await sql.end();
    }
    await page.getByTestId("add-to-cart").click({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible({ timeout: 15_000 });
  });

  /** The summary sits beside the start column from lg, under it below lg. */
  async function expectColumns(page: Page, testInfo: TestInfo, start: string, summary: string) {
    const lines = await page.getByTestId(start).boundingBox();
    const box = await page.getByTestId(summary).boundingBox();
    if (isDesktop(testInfo)) {
      // Right to left: the start column is on the right.
      expect(box!.x + box!.width).toBeLessThanOrEqual(lines!.x + 1);
      expect(Math.abs(box!.y - lines!.y)).toBeLessThan(40);
      expect(Math.round(box!.width)).toBe(360);
    } else {
      expect(box!.y).toBeGreaterThan(lines!.y);
      expect(box!.width).toBeLessThanOrEqual(720);
    }
  }

  test("puts the cart lines at the start and the summary at the end from lg", async ({
    page,
  }, testInfo) => {
    await page.goto("/cart");
    await expect(page.getByTestId("cart-lines")).toBeVisible({ timeout: 15_000 });
    await expectColumns(page, testInfo, "cart-lines", "cart-summary");
    await expectNoAxeViolations(page);
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  });

  test("puts the checkout fields at the start and the summary at the end from lg", async ({
    page,
  }, testInfo) => {
    await page.goto("/checkout");
    await expect(page.getByTestId("checkout-fields")).toBeVisible({ timeout: 15_000 });
    await expectColumns(page, testInfo, "checkout-fields", "checkout-summary");
    await expectNoAxeViolations(page);
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  });

  test("tabs from the last field to the summary's button, which sends the form", async ({
    page,
  }) => {
    await page.goto("/checkout");
    await page.getByLabel("ملاحظات (اختياري)").focus({ timeout: 15_000 });
    await page.keyboard.press("Tab");
    const send = page.getByTestId("place-order");
    await expect(send).toBeFocused();
    // An empty name is refused by the server and focus goes back to the first field.
    await page.getByLabel("الاسم الكامل").fill("");
    await send.click();
    await expect(page.getByLabel("الاسم الكامل")).toBeFocused({ timeout: 15_000 });
  });

  test("keeps the summaries in view only in a tall enough window", async ({ page }, testInfo) => {
    test.skip(!isDesktop(testInfo), "sticky from lg only");
    for (const [path, summary] of [
      ["/cart", "cart-summary"],
      ["/checkout", "checkout-summary"],
    ] as const) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(path);
      const box = page.getByTestId(summary);
      await expect(box).toHaveCSS("position", "sticky", { timeout: 15_000 });
      await expect(box).toHaveCSS("top", "16px");
      await page.setViewportSize({ width: 1280, height: 640 });
      await expect(box).toHaveCSS("position", "static");
    }
  });
});

// covers: AC-10 (spec 0029): from lg the filters stand beside the grid, always open.
test.describe("filter column", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isDesktop(testInfo), "the column shows from lg");
  });

  const panel = (page: Page) => page.getByTestId("filters-panel");
  const count = (page: Page) => page.getByTestId("category-count");

  test("applies a chip at once and the price on Enter, then clears all", async ({ page }) => {
    await page.goto(`/c/${SLUG}`);
    await expect(count(page)).toHaveText("3 منتج", { timeout: 15_000 });
    await expect(panel(page)).toBeVisible();
    await expect(page.getByTestId("filters-button")).toBeHidden();
    await expect(panel(page)).toHaveAccessibleName("تصفية المنتجات");

    // A chip: the address and the count follow, focus stays on it, the page does not jump.
    await page.evaluate(() => window.scrollTo(0, 120));
    const before = await page.evaluate(() => window.scrollY);
    const chip = panel(page).getByRole("group", { name: "الحجم" }).getByRole("button", {
      name: "60 سم",
    });
    await chip.click();
    await expect(page).toHaveURL(new RegExp(`\\?size=${encodeURIComponent("60سم")}`));
    await expect(count(page)).toHaveText("2 منتج");
    await expect(chip).toBeFocused();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await expect(
      page.getByTestId("applied-chips").getByRole("link", { name: "إزالة التصفية: 60 سم" }),
    ).toBeVisible();

    // The price waits for Enter (or تطبيق), keeping the chip.
    await panel(page).getByLabel("من").fill("١٥٠");
    await expect(page).not.toHaveURL(/min=/);
    await panel(page).getByLabel("من").press("Enter");
    await expect(page).toHaveURL(/min=150/);
    await expect(page).toHaveURL(/size=/);
    await expect(count(page)).toHaveText("1 منتج");

    // A removed chip shows in the column too.
    await page
      .getByTestId("applied-chips")
      .getByRole("link", { name: "إزالة التصفية: 60 سم" })
      .click();
    await expect(count(page)).toHaveText("2 منتج");
    await expect(chip).toHaveAttribute("aria-pressed", "false");

    await panel(page).getByRole("link", { name: "مسح الكل" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${SLUG}$`));
    await expect(count(page)).toHaveText("3 منتج");
    await expect(panel(page).getByLabel("من")).toHaveValue("");
    await expectNoAxeViolations(page);
  });

  // The list streams in, which needs JavaScript, so the native submit is driven directly: it
  // skips the React handler and sends the GET form as a browser would before hydration.
  test("submits the whole column as a plain GET form", async ({ page }) => {
    await page.goto(`/c/${SLUG}`);
    await expect(count(page)).toHaveText("3 منتج", { timeout: 15_000 });
    await expect(panel(page)).toHaveAttribute("method", "get");
    await expect(panel(page).getByTestId("filters-panel-price")).toHaveAttribute("type", "submit");
    await panel(page)
      .getByRole("group", { name: "الحجم" })
      .getByRole("button", { name: "60 سم" })
      .click();
    await expect(count(page)).toHaveText("2 منتج");
    await panel(page).getByLabel("إلى").fill("250");
    await panel(page).evaluate((form) => HTMLFormElement.prototype.submit.call(form));
    await expect(page).toHaveURL(/max=250/);
    await expect(page).toHaveURL(/size=/);
    await expect(count(page)).toHaveText("1 منتج");
  });
});

// covers: AC-11 (spec 0029): a dialog whose button hides at lg closes when the window gets there.
test.describe("crossing lg", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!isDesktop(testInfo), "resizes a desktop window");
  });

  test("closes the filters screen and the menu sheet", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto(`/c/${SLUG}`);
    await page.getByTestId("filters-button").click();
    await expect(page.getByTestId("filters-screen")).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page.getByTestId("filters-screen")).toBeHidden();

    await page.setViewportSize({ width: 900, height: 800 });
    await page.getByRole("button", { name: "القائمة" }).click();
    const menu = page.getByRole("dialog", { name: "القائمة" });
    await expect(menu).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(menu).toBeHidden();
  });
});

// covers: AC-9 (spec 0029): search grows like the category page; /c runs 1, 2, then 3 across.
test.describe("search and /c", () => {
  test("grows the search grid with the screen", async ({ page }, testInfo) => {
    await page.goto(`/search?q=${encodeURIComponent(WORD)}`);
    await expect(page.getByTestId("search-products")).toBeVisible({ timeout: 15_000 });
    expect(await columnCount(page, "search-products")).toBe(columns[testInfo.project.name]);
    await expect(page.getByTestId("filters-panel")).toBeVisible({
      visible: isDesktop(testInfo),
    });
    await expectNoAxeViolations(page);
    await expectNoSidewaysScroll(page);
  });

  test("lays the categories out in columns", async ({ page }, testInfo) => {
    await page.goto("/c");
    await expect(page.getByTestId("category-list")).toBeVisible({ timeout: 15_000 });
    const list = page.getByTestId("category-list");
    const tracks = await list.evaluate((ul) =>
      getComputedStyle(ul).display === "grid"
        ? getComputedStyle(ul).gridTemplateColumns.split(" ").length
        : 1,
    );
    expect(tracks).toBe({ phone: 1, tablet: 2, desktop: 3 }[testInfo.project.name]);
    await expectNoAxeViolations(page);
    await expectNoSidewaysScroll(page);
  });
});

// covers: AC-12, AC-20 (spec 0029): one centred column at md, two columns from lg.
test.describe("product page", () => {
  async function openProduct(page: Page) {
    const sql = localSql();
    try {
      const { product } = await seededChandelier(sql);
      await page.goto(`/p/${encodeURIComponent(product)}`);
    } finally {
      await sql.end();
    }
    await expect(page.getByTestId("product-purchase")).toBeVisible({ timeout: 15_000 });
  }

  test("puts the gallery at the start and the purchase box at the end from lg", async ({
    page,
  }, testInfo) => {
    await openProduct(page);
    const gallery = await page.getByTestId("product-media").boundingBox();
    const purchase = await page.getByTestId("product-purchase").boundingBox();
    if (isDesktop(testInfo)) {
      // Right to left: the start column is on the right.
      expect(purchase!.x + purchase!.width).toBeLessThanOrEqual(gallery!.x + 1);
      expect(Math.abs(purchase!.y - gallery!.y)).toBeLessThan(40);
    } else {
      expect(purchase!.y).toBeGreaterThan(gallery!.y);
      expect(purchase!.width).toBeLessThanOrEqual(720);
    }
    await expectNoAxeViolations(page);
    await expectNoSidewaysScroll(page);
  });

  test("keeps the purchase box in view only in a tall enough window", async ({
    page,
  }, testInfo) => {
    test.skip(!isDesktop(testInfo), "sticky from lg only");
    await openProduct(page);
    const purchase = page.getByTestId("product-purchase");
    await expect(purchase).toHaveCSS("position", "sticky");
    await expect(purchase).toHaveCSS("top", "16px");
    await page.setViewportSize({ width: 1280, height: 640 });
    await expect(purchase).toHaveCSS("position", "static");
  });

  test("gives the gallery photo the sizes of its new width", async ({ page }) => {
    await openProduct(page);
    const photo = page.getByTestId("product-gallery").locator("img").first();
    test.skip((await photo.count()) === 0, "the seeded product has no photos");
    await expect(photo).toHaveAttribute(
      "sizes",
      "(min-width: 1024px) 680px, (min-width: 768px) 672px, (min-width: 480px) 448px, 100vw",
    );
  });
});

// covers: AC-9, AC-13 (spec 0029): Home without banners on every width.
test.describe("home", () => {
  test("widens the hero, shows the circles still from md, and spreads the cards", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const project = testInfo.project.name;
    const hero = page.getByTestId("home-hero");
    test.skip((await hero.count()) === 0, "a banner is on (the homepage flow covers that Home)");
    const width = page.viewportSize()!.width;
    const heroBox = await hero.boundingBox();
    const content = project === "phone" ? Math.min(width, 480) : Math.min(width, 1280);
    expect(Math.round(heroBox!.width)).toBe(content - 2 * pad[project]);

    const row = page.getByTestId("home-circle-row");
    if ((await row.count()) > 0) {
      await expect(row).toBeVisible({ visible: project !== "phone" });
      await expect(page.getByTestId("home-circles")).toBeVisible({ visible: project === "phone" });
    }
    const trust = await page
      .getByTestId("home-trust")
      .evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(trust).toBe(project === "desktop" ? 4 : 2);
    if (await page.getByTestId("home-products").count()) {
      expect(await columnCount(page, "home-products")).toBe(
        { phone: 2, tablet: 3, desktop: 4 }[project],
      );
    }
    await expectNoAxeViolations(page);
    await expectNoSidewaysScroll(page);
  });
});
