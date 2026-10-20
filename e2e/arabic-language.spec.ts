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
