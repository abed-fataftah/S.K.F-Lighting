import { expect as baseExpect, test } from "@playwright/test";
import { usePhoneWidth } from "./a11y";
import { ownIpHeaders } from "./own-ip";

// covers: AC-10 (spec 0004). The Workers rate limiting binding exists only on workerd, so this runs
// with E2E_TARGET=preview (as CI does), in its own project after the others. Each attempt sends
// its own IP, so a retry starts from an empty count rather than the last attempt's submits.

const expect = baseExpect.configure({ timeout: 15_000 });
const onWorkers = process.env.E2E_TARGET === "preview" || !!process.env.CI;

// The local limiter counts in windows aligned to the wall clock (`period` 60 in wrangler.jsonc), so
// a burst across a minute boundary splits over two windows and is never refused.
const WINDOW_MS = 60_000;

/** Waits for the next window when fewer than `burstMs` are left in this one. */
async function startInOneWindow(burstMs: number) {
  const left = WINDOW_MS - (Date.now() % WINDOW_MS);
  if (left < burstMs) await new Promise((resolve) => setTimeout(resolve, left + 500));
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!onWorkers, "the rate limit binding exists only on workerd (E2E_TARGET=preview)");
  test.setTimeout(120_000);
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
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
  await startInOneWindow(20_000);
  for (let i = 1; i <= 5; i += 1) {
    await page.getByTestId("place-order").click();
    await expect(banner).toContainText("السلة فارغة");
    await expect(page.getByTestId("place-order")).toBeEnabled();
  }
  await page.getByTestId("place-order").click();
  await expect(banner).toContainText("حاول مرة أخرى بعد دقيقة");
});

// covers: AC-15 (spec 0010). 60 count calls a minute per IP; the next gets 429 with no read. On an
// IP of its own and inside one window, exactly the 61st call is refused.
test("the count route refuses calls over 60 a minute", async ({ request }) => {
  const headers = ownIpHeaders();
  await startInOneWindow(30_000);
  const statuses: number[] = [];
  for (let i = 0; i < 61; i += 1) {
    const response = await request.get("/api/catalog/count?q=zz", { headers });
    statuses.push(response.status());
    expect(response.headers()["cache-control"]).toBe("no-store");
  }
  expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
  expect(statuses[60]).toBe(429);
});
