import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { formatNumber } from "../src/lib/format";
import { adminAccounts, signInAdmin, signInWithPassword } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import {
  EXPECTED_PRODUCTS,
  EXPECTED_SOURCES,
  expectedVisits,
  ZERO_DAY,
} from "./stubs/cf-graphql-data";

// covers: AC-1 to AC-7, AC-17 (spec 0027). On a phone sized (390) and a computer sized (1280) right
// to left screen the owner opens the visits page against the Web Analytics stub: the last 30 days
// with its day bars, top products, and sources; the default 7 days; and today, where the stub fails
// two sections. The beacon never loads here (not the production host). Anyone but a signed in
// admin with a code is sent away.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
  await usePhoneWidth(page, testInfo);
});

test.afterAll(async () => {
  if (accounts) await sql.end();
});

async function checkA11y(page: Page, testInfo: TestInfo) {
  await expectNoAxeViolations(page);
  if (testInfo.project.name === "phone") {
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  }
}

const BEACON = 'script[src*="cloudflareinsights"]';

async function productNames(): Promise<ReadonlyMap<string, string>> {
  const rows = await sql<{ slug: string; name: string }[]>`
    select slug, name from products where slug in ${sql(EXPECTED_PRODUCTS.map((p) => p.slug))}`;
  return new Map(rows.map((row) => [row.slug, row.name]));
}

test("the last 30 days: totals, a bar a day, top products, and sources", async ({
  page,
}, testInfo) => {
  await signInAdmin(page, accounts!, "/admin/stats?period=30d");
  await expect(page.getByRole("heading", { level: 1, name: "الزيارات" })).toBeVisible();
  await expect(page).toHaveTitle(/الزيارات/);
  await expect(page.getByRole("link", { name: "آخر 30 يوماً" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The sidebar marks the page, after Reports.
  const nav = page.getByRole("navigation", { name: "لوحة التحكم" });
  await expect(nav.getByRole("link", { name: "الزيارات" })).toHaveAttribute("aria-current", "page");

  const expected = expectedVisits(30);
  await expect(page.getByTestId("stats-page-views")).toHaveText(formatNumber(expected.pageViews));
  await expect(page.getByTestId("stats-visit-count")).toHaveText(formatNumber(expected.visits));
  const bars = page.getByTestId("stats-bar");
  await expect(bars).toHaveCount(30);
  // A day with no rows is a zero bar, never missing.
  await expect(bars.nth(ZERO_DAY)).toHaveAttribute("data-value", "0");
  await expect(bars.nth(ZERO_DAY + 1)).toHaveAttribute("data-value", String(ZERO_DAY + 2));
  // The text alternative holds every day.
  await expect(page.getByRole("table", { name: "مشاهدات الصفحات حسب اليوم" })).toBeAttached();

  // Top products: the stale path dropped, the two paths of one product added, in order.
  const names = await productNames();
  const productRows = page.getByTestId("stats-product-row");
  await expect(productRows).toHaveCount(EXPECTED_PRODUCTS.length);
  for (const [i, product] of EXPECTED_PRODUCTS.entries()) {
    const row = productRows.nth(i);
    const name = names.get(product.slug)!;
    await expect(row.getByRole("link", { name, exact: true })).toBeVisible();
    await expect(row).toContainText(formatNumber(product.pageViews));
    await expect(row.getByRole("link", { name: `تعديل ${name}` })).toBeVisible();
  }

  // Sources: direct and the shop's own host together, both Facebook hosts together.
  const sourceRows = page.getByTestId("stats-source-row");
  await expect(sourceRows).toHaveCount(EXPECTED_SOURCES.length);
  for (const [i, source] of EXPECTED_SOURCES.entries()) {
    await expect(sourceRows.nth(i)).toContainText(source.name);
    await expect(sourceRows.nth(i)).toContainText(formatNumber(source.visits));
  }
  await expect(page.getByText("داخل تطبيق واتساب")).toBeVisible();

  // AC-6: never under /admin.
  await expect(page.locator(BEACON)).toHaveCount(0);
  await checkA11y(page, testInfo);

  // The storefront page link opens the product.
  await productRows
    .first()
    .getByRole("link", { name: names.get(EXPECTED_PRODUCTS[0].slug)!, exact: true })
    .click();
  await expect(page).toHaveURL(/\/p\//);
  // AC-6: and not on the storefront either, as e2e is not the production host.
  await expect(page.locator(BEACON)).toHaveCount(0);
});

test("the page opens on the last 7 days, and the chips move by keyboard", async ({ page }) => {
  await signInAdmin(page, accounts!, "/admin/stats");
  const week = page.getByRole("link", { name: "آخر 7 أيام" });
  await expect(week).toHaveAttribute("aria-current", "page");
  await expect(week).toHaveAttribute("href", "/admin/stats");
  const expected = expectedVisits(7);
  await expect(page.getByTestId("stats-page-views")).toHaveText(formatNumber(expected.pageViews));
  await expect(page.getByTestId("stats-bar")).toHaveCount(7);

  // An unknown period reads as 7 days too.
  await page.goto("/admin/stats?period=90d");
  await expect(page.getByRole("link", { name: "آخر 7 أيام" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const month = page.getByRole("link", { name: "آخر 30 يوماً" });
  await month.focus();
  await expect(month).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/stats\?period=30d$/);
  await expect(page.getByTestId("stats-bar")).toHaveCount(30);
});

test("today: totals only, and a failed and a slow section each show a retry", async ({
  page,
}, testInfo) => {
  await signInAdmin(page, accounts!, "/admin/stats?period=today");
  // Visits still show, with no day bars for a single day.
  const expected = expectedVisits(1);
  await expect(page.getByTestId("stats-page-views")).toHaveText(formatNumber(expected.pageViews));
  await expect(page.getByTestId("stats-chart")).toHaveCount(0);

  // The stub answers sources with a 500 and products after the 5 second limit.
  for (const id of ["stats-sources-error", "stats-products-error"]) {
    const card = page.getByTestId(id);
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toHaveAttribute("role", "alert");
    await expect(card.getByRole("link", { name: "حاول مرة أخرى" })).toHaveAttribute(
      "href",
      "/admin/stats?period=today",
    );
  }
  await checkA11y(page, testInfo);

  // The retry really loads the page again.
  await page.getByTestId("stats-sources-error").getByRole("link").click();
  await expect(page.getByTestId("stats-sources-error")).toBeVisible({ timeout: 20_000 });
});

test("a signed out visitor and an admin without a code are sent away", async ({ page }) => {
  await page.goto("/admin/stats?period=30d");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fstats%3Fperiod%3D30d$/);

  await page.goto("/admin/login");
  await signInWithPassword(page, accounts!.admin.email, accounts!.password);
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await page.goto("/admin/stats");
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin%2Fstats$/);
  await expect(page.getByTestId("stats-visits")).toHaveCount(0);
});
