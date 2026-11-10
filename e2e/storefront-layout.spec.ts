import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { seededChandelier } from "./categories";
import { localSql } from "./local-db";

// covers: AC-1, AC-3, AC-9, AC-19, AC-20, AC-21, AC-22 (spec 0029): the storefront pages that are
// converted to their tablet and desktop layouts, on all three projects. Today: the category page.

const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  await usePhoneWidth(page, testInfo);
});

/** Grid columns per project (spec 0029 AC-9). */
const columns: Readonly<Record<string, number>> = { phone: 2, tablet: 3, desktop: 4 };

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

// covers: AC-1 (spec 0029): pages not yet converted keep the 480 column at every width.
test("keeps an unconverted page on the 480 column", async ({ page }) => {
  await page.goto("/orders/track");
  const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
  const width = page.viewportSize()!.width;
  const column = Math.min(width, 480);
  expect(Math.round((width + column) / 2 - (heading!.x + heading!.width))).toBe(
    width >= 1024 ? 32 : width >= 768 ? 24 : 16,
  );
});
