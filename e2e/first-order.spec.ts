import { expect as baseExpect, test, type Page } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import { chooseCategory, ensureCategory } from "./categories";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-2, AC-7, AC-11, AC-13, AC-16 (spec 0004); AC-11 (spec 0005); AC-2, AC-17 (spec 0006);
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
  await checkA11y(page);

  await row.getByRole("link", { name: number }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${number}$`));
  await expect(page.getByTestId("admin-order-lines")).toContainText(name);
  await expect(page.getByText("رام الله")).toBeVisible();
  await checkA11y(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByTestId(`order-row-${number}`)).toBeVisible();
  await expect(page.getByTestId(`order-row-${number}`).getByText("جديد")).toHaveCount(0);
});

test("a taken code is refused on its field and nothing is saved", async ({ page }) => {
  test.setTimeout(120_000);
  await signInAdmin(page, accounts!, "/admin/products/new");
  const code = uniqueCode();
  await addProduct(page, { name: "لمبة تجربة", code, price: "20" });
  await expect(page.getByTestId("product-saved")).toBeVisible();

  await page.getByRole("link", { name: "+ إضافة منتج آخر" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
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
