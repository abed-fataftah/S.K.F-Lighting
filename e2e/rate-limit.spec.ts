import { expect as baseExpect, test } from "@playwright/test";
import { usePhoneWidth } from "./a11y";

// covers: AC-10 (spec 0004). The Workers rate limiting binding exists only on workerd, so this runs
// with E2E_TARGET=preview (as CI does), in its own project after the others: its six submits
// would otherwise spend the shared local IP's allowance for the other tests.

const expect = baseExpect.configure({ timeout: 15_000 });
const onWorkers = process.env.E2E_TARGET === "preview" || !!process.env.CI;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!onWorkers, "the rate limit binding exists only on workerd (E2E_TARGET=preview)");
  test.setTimeout(120_000);
  await usePhoneWidth(page, testInfo);
});

test("the sixth order submission in a minute is refused and saves nothing", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByTestId("home-products").getByRole("link").first().click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("الاسم الكامل").fill("زبون تجربة");
  await page.getByLabel("رقم الهاتف").fill("0599123456");

  // An empty cart makes each submission count (it parses) without placing an order.
  await context.clearCookies({ name: "skf_cart" });
  const banner = page.locator("#checkout-banner");
  for (let i = 1; i <= 5; i += 1) {
    await page.getByTestId("place-order").click();
    await expect(banner).toContainText("السلة فارغة");
    await expect(page.getByTestId("place-order")).toBeEnabled();
  }
  await page.getByTestId("place-order").click();
  await expect(banner).toContainText("حاول مرة أخرى بعد دقيقة");
});
