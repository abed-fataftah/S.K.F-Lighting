import { expect as baseExpect, test, type Page } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-3 to AC-9, AC-11, AC-12, AC-14 (spec 0004); AC-9, AC-14 (spec 0005).
// One guest order on the dev seed (`pnpm db:seed`), from `/` to the WhatsApp link, phone sized.

// Each step waits on a Server Action and a server render; the dev server is slow under a full run.
const expect = baseExpect.configure({ timeout: 15_000 });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the guest flow runs on the phone project");
  test.setTimeout(90_000);
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

async function addFirstProduct(page: Page) {
  await page.goto("/");
  await page.getByTestId("home-products").getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
}

test("a guest finds a product, checks out, and lands on WhatsApp with the order number", async ({
  page,
}) => {
  // Six pages, each with an axe pass; the dev server also compiles them on first visit.
  test.setTimeout(180_000);
  await page.goto("/");
  await checkA11y(page);

  await addFirstProduct(page);
  await checkA11y(page);
  // The header count follows the cookie.
  await expect(page.locator("header").getByRole("link", { name: /السلة،/ })).toBeVisible();

  await page.getByRole("link", { name: "عرض السلة" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(1);
  await checkA11y(page);

  await page.getByRole("link", { name: "متابعة الطلب" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await checkA11y(page);

  // Submitting empty shows inline errors and focuses the name.
  await page.getByTestId("place-order").click();
  await expect(page.getByLabel("الاسم الكامل")).toBeFocused();
  await expect(page.getByRole("alert").first()).toBeVisible();

  await page.getByLabel("الاسم الكامل").fill("زبون تجربة");
  // Arabic digits in the phone are accepted (spec 0005 AC-9).
  await page.getByLabel("رقم الهاتف").fill("٠٥٩٩١٢٣٤٥٦");

  const whatsapp = page.waitForRequest(/https:\/\/wa\.me\//);
  await page.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  await page.getByTestId("place-order").click();

  const request = await whatsapp;
  const text = new URL(request.url()).searchParams.get("text") ?? "";
  const number = /طلب جديد رقم (\d{2}-\d{5})/.exec(text)?.[1];
  expect(number).toBeTruthy();
  expect(text).toContain("الهاتف: 0599123456");
  expect(text).toContain("الاستلام: استلام من المعرض");

  // Back on the confirmation page: the flag is gone, so it does not hand off again.
  await page.goto(`/checkout/done/${number}`);
  await expect(page.getByTestId("order-number")).toHaveText(number!);
  await expect(page.getByTestId("order-number").locator("bdi[dir=ltr]")).toHaveText(number!);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByTestId("open-whatsapp")).toHaveAttribute("href", /wa\.me/);
  await checkA11y(page);

  // The cart emptied after placing.
  await page.goto("/cart");
  await expect(page.getByRole("heading", { level: 1, name: "السلة فارغة" })).toBeVisible();
});

test("another browser cannot open a confirmation page", async ({ browser }) => {
  const other = await browser.newPage();
  const response = await other.goto("/checkout/done/26-00001");
  expect(response?.status()).toBe(404);
  await other.close();
});

test("the cart adds to a line and removes it", async ({ page }) => {
  await addFirstProduct(page);
  const added = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByTestId("add-to-cart").click();
  await added;
  await page.goto("/cart");
  const line = page.getByTestId("cart-lines").getByRole("listitem");
  await expect(line).toHaveCount(1);
  await expect(line.getByRole("textbox")).toHaveValue("2");
  await line.getByRole("button", { name: /^حذف / }).click();
  await expect(page.getByRole("heading", { level: 1, name: "السلة فارغة" })).toBeVisible();
});

test("delivery shows the zone fee in the total", async ({ page }) => {
  await addFirstProduct(page);
  await page.goto("/checkout");
  const total = page.getByTestId("checkout-total");
  const pickupTotal = await total.textContent();
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await expect(page.getByLabel("المدينة أو البلدة")).toBeVisible();
  await expect(total).not.toHaveText(pickupTotal ?? "");
  await checkA11y(page);
});
