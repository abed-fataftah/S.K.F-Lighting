import { expect, test, type Page } from "@playwright/test";
import { usePhoneWidth } from "./a11y";

// covers: AC-1, AC-3, AC-9, AC-14, AC-16 (spec 0005). The gallery's numbers and dates read the
// same whatever the browser's language and time zone. Needs DESIGN_SYSTEM_PAGE=1.

const ARABIC_INDIC_DIGIT = /[\u0660-\u0669\u06F0-\u06F9]/;

async function expectShopFormats(page: Page) {
  const formats = page.getByTestId("formats-sample");
  await expect(formats.locator("dd").nth(0)).toHaveText("₪1,250");
  await expect(formats.locator("dd").nth(1)).toHaveText("-₪50");
  await expect(formats.locator("dd").nth(2)).toHaveText("1,250");
  await expect(formats.locator("time")).toHaveText("20/10/2026 · 4:45 م");
  await expect(formats.locator("time")).toHaveAttribute("datetime", "2026-10-20T13:45:00.000Z");
  await expect(formats.locator("dd").nth(5)).toHaveText("059 912 3456");
  await expect(page.locator("#type")).toContainText("₪48,300");
  await expect(page.locator("#display table")).toContainText("₪340");
  expect(await page.locator("body").innerText()).not.toMatch(ARABIC_INDIC_DIGIT);
}

for (const browser of [
  { locale: "ar-PS", timezoneId: "America/New_York" },
  { locale: "en-US", timezoneId: "Asia/Hebron" },
]) {
  test.describe(`gallery in a ${browser.locale} browser on ${browser.timezoneId} time`, () => {
    test.use(browser);

    test.beforeEach(async ({ page }, testInfo) => {
      await usePhoneWidth(page, testInfo);
      await page.goto("/design-system");
    });

    test("shows Western digits and the shop's date and time", async ({ page }) => {
      await expectShopFormats(page);
    });
  });
}

/** Text in `main` holding a price that is not inside `<Ltr>` (it would flip `-₪50` in RTL). */
function pricesOutsideLtr(page: Page) {
  return page.locator("main").evaluate((main) => {
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const loose: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (text.includes("₪") && !node.parentElement?.closest("bdi[dir=ltr]")) loose.push(text);
    }
    return loose;
  });
}

async function expectStorefrontNumbers(page: Page) {
  await expect(page.locator("main bdi[dir=ltr]", { hasText: "₪" }).first()).toBeVisible();
  expect(await pricesOutsideLtr(page)).toEqual([]);
  expect(await page.locator("body").innerText()).not.toMatch(ARABIC_INDIC_DIGIT);
}

// covers: AC-1, AC-14 on spec 0004's product, cart, and checkout pages (needs `pnpm db:seed`).
test.describe("storefront in an ar-PS browser on America/New_York time", () => {
  test.use({ locale: "ar-PS", timezoneId: "America/New_York" });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "phone", "the storefront flow runs on the phone project");
    test.setTimeout(90_000);
    await usePhoneWidth(page, testInfo);
  });

  test("keeps prices and codes left to right with Western digits", async ({ page }) => {
    const slow = expect.configure({ timeout: 15_000 });
    await page.goto("/");
    await page.getByTestId("home-products").getByRole("link").first().click();
    await slow(page.getByRole("heading", { level: 1 })).toBeVisible();
    await slow(page.locator("main bdi[dir=ltr]", { hasText: /^[A-Z0-9][A-Z0-9-]*$/ })).toHaveCount(
      1,
    );
    await expectStorefrontNumbers(page);

    await page.getByTestId("add-to-cart").click();
    await page.getByRole("link", { name: "عرض السلة" }).click();
    await slow(page).toHaveURL(/\/cart$/);
    await expectStorefrontNumbers(page);

    await page.getByRole("link", { name: "متابعة الطلب" }).click();
    await slow(page).toHaveURL(/\/checkout$/);
    await expectStorefrontNumbers(page);
  });

  // covers: AC-1, AC-7, AC-13 (a limit in a field error arrives through formatNumber)
  test("shows a field error's limit in Western digits", async ({ page }) => {
    const slow = expect.configure({ timeout: 15_000 });
    await page.goto("/");
    await page.getByTestId("home-products").getByRole("link").first().click();
    await page.getByTestId("add-to-cart").click();
    await slow(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
    await page.goto("/checkout");

    await page.getByLabel("الاسم الكامل").fill("ا");
    await page.getByLabel("رقم الهاتف").fill("0599123456");
    await page.getByTestId("place-order").click();

    const error = page.getByRole("alert").filter({ hasText: "النص قصير جدًا" });
    await slow(error).toHaveText("النص قصير جدًا، الحد الأدنى 2 أحرف");
    await expect(page.getByLabel("الاسم الكامل")).toBeFocused();
  });
});

test.describe("gallery number direction and typing", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await usePhoneWidth(page, testInfo);
    await page.goto("/design-system");
  });

  // covers: AC-14
  test("keeps prices, order numbers, and phones left to right, and times in <time>", async ({
    page,
  }) => {
    const formats = page.getByTestId("formats-sample");
    for (const text of ["-₪50", "₪1,250", "26-00123", "059 912 3456"]) {
      await expect(formats.locator("bdi[dir=ltr]", { hasText: text })).toHaveCount(1);
    }
    await expect(page.locator("#display table bdi[dir=ltr]", { hasText: "₪1,250" })).toHaveCount(1);
    await expect(formats.locator("bdi time, time bdi")).toHaveCount(0);
  });

  // covers: AC-9
  test("commits a quantity typed in Arabic digits", async ({ page }) => {
    const value = page
      .locator('[data-slot="quantity-stepper"]')
      .first()
      .getByRole("textbox", { name: "الكمية" });
    await value.fill("١٢");
    await value.press("Enter");
    await expect(value).toHaveValue("12");
  });
});
