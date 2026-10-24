import { expect as baseExpect, test, type Locator, type Page } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import { chooseCategory, ensureCategory } from "./categories";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-2, AC-7, AC-11, AC-13, AC-16 (spec 0004); AC-8, AC-9, AC-11, AC-14 (spec 0005);
// AC-2, AC-17 (spec 0006);
// AC-17 (spec 0008: the category is made on the categories page first).
// The tracer bullet end to end on a phone sized right to left screen: the owner signs in with a code
// and adds a product in the product editor, a guest orders it for delivery, and the owner sees the
// order flagged "جديد" until they open it.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the tracer bullet runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

const CATEGORY = "فئة تجربة";

const uniqueCode = () => `E2E-${Date.now().toString(36).toUpperCase()}`;

/**
 * Spec 0005 AC-14 on an admin order screen: prices read left to right through formatPrice, and the
 * order time is one `<time>` through formatDateTime, never wrapped in a `bdi`.
 */
async function expectMoneyAndTime(scope: Locator) {
  await expect(
    scope.locator("bdi[dir=ltr]", { hasText: /^₪[\d,]+(\.\d{2})?$/ }).first(),
  ).toBeVisible();
  const time = scope.locator("time");
  await expect(time).toHaveCount(1);
  await expect(time).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  await expect(time).toHaveText(/^\d{2}\/\d{2}\/\d{4} · \d{1,2}:\d{2} [صم]$/);
  await expect(scope.locator("bdi time, time bdi")).toHaveCount(0);
}

async function addProduct(page: Page, fields: { name: string; code: string; price: string }) {
  await page.getByLabel("اسم المنتج").fill(fields.name);
  await page.getByLabel("كود المنتج").fill(fields.code);
  await chooseCategory(page, CATEGORY);
  await page.getByLabel("السعر (₪)").fill(fields.price);
  await page.getByTestId("product-save").click();
}

test("the owner adds a product, a guest orders it, and the owner sees the order flagged new", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await signInAdmin(page, accounts!, "/admin/categories");
  await ensureCategory(page, CATEGORY);
  await page.goto("/admin/products/new");
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await expect(page.getByLabel("اسم المنتج")).toBeEnabled();
  await checkA11y(page);

  const code = uniqueCode();
  const name = `ثريا تجربة ${code.slice(4).toLowerCase()}`;
  // Arabic digits and the Arabic decimal mark are read as 125.50.
  await addProduct(page, { name, code: code.toLowerCase(), price: "١٢٥٫٥" });
  await expect(page.getByTestId("product-saved")).toBeVisible();
  await checkA11y(page);
  const productHref = await page.getByTestId("product-view").getAttribute("href");
  expect(decodeURIComponent(productHref ?? "")).toContain(code);

  // The guest, in a browser of their own.
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const guest = await guestContext.newPage();
  await guest.goto("/");
  await guest.getByTestId("home-products").getByRole("link", { name }).first().click();
  await expect(guest.getByRole("heading", { level: 1, name })).toBeVisible();
  await guest.getByTestId("add-to-cart").click();
  await guest.getByRole("link", { name: "عرض السلة" }).click();
  await guest.getByRole("link", { name: "متابعة الطلب" }).click();
  await expect(guest).toHaveURL(/\/checkout$/);

  await guest.getByLabel("الاسم الكامل").fill("زبون الطرف");
  await guest.getByLabel("رقم الهاتف").fill("0599123456");
  await guest.getByRole("radio", { name: /توصيل/ }).click();
  await guest.getByLabel("المدينة أو البلدة").fill("رام الله");
  await guest.getByLabel("العنوان بالتفصيل").fill("شارع الإرسال، بناية ٤");

  const whatsapp = guest.waitForRequest(/https:\/\/wa\.me\//);
  await guest.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  await guest.getByTestId("place-order").click();
  const text = new URL((await whatsapp).url()).searchParams.get("text") ?? "";
  const number = /طلب جديد رقم (\d{2}-\d{5})/.exec(text)?.[1];
  expect(number).toBeTruthy();
  expect(text).toContain(name);
  expect(text).toContain("الاستلام: توصيل إلى");
  await guestContext.close();

  // The owner's list flags it; opening it clears the flag.
  await page.goto("/admin/orders");
  const row = page.getByTestId(`order-row-${number}`);
  await expect(row.getByText("جديد")).toBeVisible();
  // The phone reads through formatPhone, left to right (spec 0005 AC-8, AC-14).
  await expect(row.locator("bdi[dir=ltr]", { hasText: "059 912 3456" })).toHaveCount(1);
  await expectMoneyAndTime(row);
  await expect(row).not.toContainText(/[٠-٩]/);
  await checkA11y(page);

  await row.getByRole("link", { name: number }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${number}$`));
  await expect(page.getByTestId("admin-order-lines")).toContainText(name);
  await expect(page.getByText("رام الله")).toBeVisible();
  await expect(page.locator("main bdi[dir=ltr]", { hasText: "059 912 3456" })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 }).locator("bdi[dir=ltr]")).toHaveText(number!);
  // ١٢٥٫٥ was saved as 12550 agorot: the unit price and line total read ₪125.50 (spec 0005 AC-9).
  await expect(
    page.getByTestId("admin-order-lines").locator("bdi[dir=ltr]", { hasText: "₪125.50" }),
  ).toHaveCount(2);
  await expectMoneyAndTime(page.locator("main"));
  await checkA11y(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByTestId(`order-row-${number}`)).toBeVisible();
  await expect(page.getByTestId(`order-row-${number}`).getByText("جديد")).toHaveCount(0);

  // One price, no "من": the products list shows it alone, left to right (spec 0005 AC-14).
  await page.goto(`/admin/products?q=${code}`);
  const price = page.getByTestId(`product-row-${code}`).getByTestId("product-price");
  await expect(price).toHaveText("₪125.50");
  await expect(price.locator("bdi[dir=ltr]")).toHaveText("₪125.50");
});

test("a taken code is refused on its field and nothing is saved", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAdmin(page, accounts!, "/admin/products/new");
  const code = uniqueCode();
  await addProduct(page, { name: "لمبة تجربة", code, price: "20" });
  await expect(page.getByTestId("product-saved")).toBeVisible();

  // A slow network: while the fresh editor loads, the saved one is busy and takes no typing.
  await page.route(/\/admin\/products\/new$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.continue();
  });
  const historyLength = () => page.evaluate(() => window.history.length);
  const entriesBefore = await historyLength();
  await page.getByRole("link", { name: "+ إضافة منتج آخر" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await expect(page.getByTestId("product-editor")).toHaveAttribute("aria-busy", "true");
  await page.getByLabel("اسم المنتج").focus();
  await expect(page.getByLabel("اسم المنتج")).not.toBeFocused();
  // Ready when the editor stands empty and editable again, with no saved notice.
  await expect(page.getByTestId("product-saved")).toHaveCount(0);
  await expect(page.getByTestId("product-editor")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByLabel("اسم المنتج")).toHaveValue("");
  await expect(page.getByLabel("اسم المنتج")).toBeEditable();
  // The address is replaced, not pushed, so Back never brings the saved product's editor back.
  expect(await historyLength()).toBe(entriesBefore);
  await page.unroute(/\/admin\/products\/new$/);
  await addProduct(page, {
    name: "لمبة تجربة ثانية",
    code: ` ${code.toLowerCase()} `,
    price: "20",
  });
  await expect(page.getByLabel("كود المنتج")).toBeFocused();
  await expect(page.getByText("هذا الرمز مستخدم لمنتج آخر")).toBeVisible();
  await expect(page.getByTestId("product-saved")).toHaveCount(0);
});

test("a name with no Arabic is refused on its field, and Arabic beside it saves", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signInAdmin(page, accounts!, "/admin/products/new");
  await addProduct(page, { name: "Philips 60W", code: uniqueCode(), price: "20" });
  await expect(page.getByLabel("اسم المنتج")).toBeFocused();
  await expect(page.getByText("اكتب هذا الحقل بالعربية")).toBeVisible();

  await page.getByLabel("اسم المنتج").fill("لمبة Philips 60W");
  await page.getByTestId("product-save").click();
  await expect(page.getByTestId("product-saved")).toBeVisible();
});
