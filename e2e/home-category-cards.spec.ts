import { expect as baseExpect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations, expectNoSidewaysScroll, usePhoneWidth } from "./a11y";
import { ownIpHeaders } from "./own-ip";

// covers: AC-1 to AC-8, AC-11 (spec 0031): Home's category cards on the phone, tablet, and desktop
// projects, against whatever Home shows (the dev seed ticks two mains, each with products). It
// needs two or more cards and changes nothing: the failure steps answer the route with
// `page.route`, so the real rate limit is never spent. The homepage flow covers the owner's ticks,
// the photo and line, and the small counts.

const expect = baseExpect.configure({ timeout: 15_000 });
const ROUTE = "**/api/catalog/home-products?**";

test.beforeEach(async ({ page }, testInfo) => {
  await usePhoneWidth(page, testInfo);
  // The route counts per IP and every local request shares one: an allowance of its own.
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
});

const tabs = (page: Page) => page.getByTestId("home-category-tabs").getByRole("tab");
const heading = (page: Page) => page.getByTestId("home-category-heading");
const grid = (page: Page) => page.getByTestId("home-category-products");

/** The slug in a card's id, `category-tab-<slug>`. */
async function slugOf(page: Page, index: number) {
  const id = await tabs(page).nth(index).getAttribute("id");
  return id!.replace(/^category-tab-/, "");
}

/** Opens Home and skips when it has fewer than two category cards. */
async function openHome(page: Page) {
  await page.goto("/");
  // The first visit compiles the route on the dev server.
  await expect(page.getByTestId("home-category-panel")).toBeVisible({ timeout: 30_000 });
  const count = await tabs(page).count();
  test.skip(count < 2, "needs two or more category cards on Home");
  return count;
}

/** The name the card shows: its first line. */
const nameOf = async (page: Page, index: number) =>
  (await tabs(page).nth(index).locator("span").first().locator("span").first().textContent()) ?? "";

test("shows the cards as tabs with the first category's products on the page", async ({ page }) => {
  await openHome(page);
  const first = tabs(page).first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(first).toHaveAttribute("tabindex", "0");
  await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "false");
  await expect(tabs(page).nth(1)).toHaveAttribute("tabindex", "-1");
  await expect(heading(page)).toHaveText(await nameOf(page, 0));
  const count = await grid(page).locator("li").count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(8);
  await expect(page.getByTestId("home-category-panel")).toHaveAttribute(
    "aria-labelledby",
    `category-tab-${await slugOf(page, 0)}`,
  );
  await expectNoSidewaysScroll(page);
  await expectNoAxeViolations(page, ["#categories"]);
});

// Home streams behind its `loading.tsx` boundary, and the swap from the loading skeleton to the
// page is an inline script, so a browser with JavaScript off only ever shows the skeleton. The
// server's HTML is what carries the first grid: read it with no browser at all.
test("renders the first grid on the server, in the page's own HTML", async ({ request }) => {
  const html = await (await request.get("/")).text();
  test.skip(!html.includes('role="tablist"'), "needs a category card on Home");
  const panel = html.slice(html.indexOf('data-testid="home-category-panel"'));
  expect(html).toMatch(
    /aria-selected="true"[^>]*id="category-tab-|id="category-tab-[^"]+"[^>]*aria-selected="true"/,
  );
  expect(panel).toContain('data-testid="home-category-products"');
  expect(panel.split('data-testid="product-card"').length - 1).toBeGreaterThan(0);
  expect(html).not.toContain('data-testid="home-category-skeleton"');
});

test("swaps the heading and the grid on a press, and links to the category and the product", async ({
  page,
}) => {
  await openHome(page);
  const second = tabs(page).nth(1);
  const name = await nameOf(page, 1);
  const slug = await slugOf(page, 1);
  await second.click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(tabs(page).first()).toHaveAttribute("aria-selected", "false");
  await expect(heading(page)).toHaveText(name);
  await expect(grid(page).locator("li").first()).toBeVisible();
  await expect(page.getByTestId("home-category-panel")).toHaveAttribute(
    "aria-labelledby",
    `category-tab-${slug}`,
  );

  // A product card's link opens its product page.
  const product = grid(page).locator("li").first().getByRole("link").first();
  const href = await product.getAttribute("href");
  await product.click();
  await expect(page).toHaveURL((url) => url.pathname === href);
  await page.goBack();

  // "عرض الكل" opens the selected category's page.
  await openHome(page);
  await tabs(page).nth(1).click();
  await expect(heading(page)).toHaveText(name);
  await page
    .getByTestId("home-category-panel")
    .getByRole("link", { name: "عرض الكل", exact: true })
    .click();
  await expect(page).toHaveURL((url) => decodeURIComponent(url.pathname) === `/c/${slug}`);
});

test("moves the selection with the arrow keys, Home, and End", async ({ page }) => {
  const count = await openHome(page);
  await tabs(page).first().focus();
  // Right to left: the left arrow selects the card on the physical left, the next in the list.
  await page.keyboard.press("ArrowLeft");
  await expect(tabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs(page).nth(1)).toBeFocused();
  await expect(heading(page)).toHaveText(await nameOf(page, 1));
  await page.keyboard.press("ArrowRight");
  await expect(tabs(page).first()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tabs(page).nth(count - 1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs(page).first()).toHaveAttribute("aria-selected", "true");
  // The fetch waits for the keys to stop, then the grid lands.
  await page.keyboard.press("ArrowLeft");
  await expect(grid(page).locator("li").first()).toBeVisible();
});

for (const status of [503, 429]) {
  test(`shows a retry notice when the load answers ${status}, and the grid after a retry`, async ({
    page,
  }) => {
    let failing = true;
    await page.route(ROUTE, (route) =>
      failing
        ? route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify({ error: status === 429 ? "too_many" : "unavailable" }),
            headers: { "Cache-Control": "no-store" },
          })
        : route.continue(),
    );
    await openHome(page);
    const name = await nameOf(page, 1);
    await tabs(page).nth(1).click();
    const notice = page.getByTestId("home-category-failed");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "alert");
    await expect(notice).toContainText("تعذّر تحميل المنتجات");
    // The heading and "عرض الكل" stay, so the category page is one tap away.
    await expect(heading(page)).toHaveText(name);
    await expect(
      page.getByTestId("home-category-panel").getByRole("link", { name: "عرض الكل", exact: true }),
    ).toBeVisible();
    await expectNoAxeViolations(page, ["#categories"]);

    failing = false;
    await notice.getByRole("button", { name: "إعادة المحاولة" }).click();
    await expect(grid(page).locator("li").first()).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
}

test("shows a skeleton while a category loads", async ({ page }) => {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(ROUTE, async (route) => {
    await held;
    await route.continue();
  });
  await openHome(page);
  await tabs(page).nth(1).click();
  await expect(page.getByTestId("home-category-skeleton")).toBeVisible();
  await expect(page.getByTestId("home-category-panel")).toHaveAttribute("aria-busy", "true");
  release();
  await expect(grid(page).locator("li").first()).toBeVisible();
  await expect(page.getByTestId("home-category-panel")).not.toHaveAttribute("aria-busy", "true");
});

test("changes the selected card at once with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  const second = tabs(page).nth(1);
  await second.click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  // `motion-reduce:transition-none`: nothing transitions, so the rest state lands at once.
  expect(await second.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe("none");
});

test("faces the selected card and turns its neighbours in its row toward it", async ({ page }) => {
  await openHome(page);
  // The selected card carries no turn; a neighbour in the same row turns.
  const turnOf = (index: number) =>
    tabs(page)
      .nth(index)
      .evaluate((el) => (el as HTMLElement).style.getPropertyValue("--turn"));
  expect(await turnOf(0)).toBe("0");
  expect(await turnOf(1)).not.toBe("0");
  await tabs(page).nth(1).click();
  await expect.poll(() => turnOf(1)).toBe("0");
  expect(await turnOf(0)).not.toBe("0");
});
