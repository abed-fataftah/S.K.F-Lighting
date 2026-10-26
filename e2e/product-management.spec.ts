import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import { chooseCategory, ensureCategory } from "./categories";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-1, AC-2, AC-4, AC-5, AC-6, AC-8, AC-10, AC-11, AC-12, AC-14, AC-17 (spec 0006);
// AC-17 (spec 0008: the category is made on the categories page first).
// The product editor on a phone sized right to left screen, against the local Supabase.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the product flows run on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

const CATEGORY = "فئة تجربة المنتجات";

/** Signs in, makes sure the test category exists, and opens a new product, ready for input. */
async function openNewProduct(page: Page) {
  await signInAdmin(page, accounts!, "/admin/categories");
  await ensureCategory(page, CATEGORY);
  await page.goto("/admin/products/new");
  await expect(page.getByLabel("اسم المنتج")).toBeEnabled();
}

const uniqueCode = () => `E2E-${Date.now().toString(36).toUpperCase()}`;

// A 2 by 2 PNG: enough for the browser to decode, shrink, and encode.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

async function fillBasics(page: Page, name: string, code: string) {
  await page.getByLabel("اسم المنتج").fill(name);
  await page.getByLabel("كود المنتج").fill(code);
  await chooseCategory(page, CATEGORY);
}

async function addColour(page: Page, name: string) {
  await page.getByTestId("add-colour").click();
  await page.getByTestId("colour-search").fill(name);
  await page.getByRole("button", { name: `إضافة «${name}»` }).click();
}

async function save(page: Page) {
  await page.getByTestId("product-save").click();
  await expect(page.getByTestId("product-saved")).toBeVisible();
}

/** A guest buys the product through the slice 1 checkout, so it has an order. */
async function orderAsGuest(browser: Browser, slug: string) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const guest = await context.newPage();
  await guest.goto(`/p/${encodeURIComponent(slug)}`);
  await guest.getByTestId("add-to-cart").click();
  await guest.getByRole("link", { name: "عرض السلة" }).click();
  await guest.getByRole("link", { name: "متابعة الطلب" }).click();
  await guest.getByLabel("الاسم الكامل").fill("زبون الأرشفة");
  await guest.getByLabel("رقم الهاتف").fill("0599123456");
  await guest.getByRole("radio", { name: /استلام/ }).click();
  const whatsapp = guest.waitForRequest(/https:\/\/wa\.me\//);
  await guest.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  await guest.getByTestId("place-order").click();
  await whatsapp;
  await context.close();
}

const slugOf = async (page: Page) => {
  const href = await page.getByTestId("product-view").getAttribute("href");
  return decodeURIComponent(href!.replace(/^\/p\//, ""));
};

test("the owner adds a product with sizes, colours, and a photo, then hides, edits, and meets a stale save", async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);
  await openNewProduct(page);
  await checkA11y(page);

  const code = uniqueCode();
  const name = `ثريا خيارات ${code.slice(4).toLowerCase()}`;
  await fillBasics(page, name, code);

  await page.getByTestId("photo-input").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByTestId("photo-tile").getByText("رئيسية")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("add-size").click();
  await page.getByLabel("الحجم 1", { exact: true }).fill("صغير");
  await page.getByLabel("سعر الحجم 1").fill("100");
  await page.getByTestId("add-size").click();
  await page.getByLabel("الحجم 2", { exact: true }).fill("كبير");
  await page.getByLabel("سعر الحجم 2").fill("150");
  await addColour(page, `ذهبي ${code.slice(4)}`);
  await addColour(page, `أسود ${code.slice(4)}`);

  // Untick one pair in the grid.
  await page.getByRole("checkbox", { name: `كبير أسود ${code.slice(4)}` }).click();
  await expect(
    page.getByRole("checkbox", { name: `كبير أسود ${code.slice(4)}` }),
  ).not.toBeChecked();
  await save(page);
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}$/);
  const editUrl = page.url();
  const slug = await slugOf(page);

  // The list shows the lowest price with من and both counts.
  await page.goto(`/admin/products?q=${code}`);
  const row = page.getByTestId(`product-row-${code}`);
  await expect(row.getByTestId("product-price")).toHaveText("من ₪100");
  // The price stays left to right inside the sentence (spec 0005 AC-14).
  await expect(row.getByTestId("product-price").locator("bdi[dir=ltr]")).toHaveText("₪100");
  await expect(row.getByTestId("product-options")).toHaveText("2 أحجام · 2 ألوان");
  await expect(row.getByTestId("product-status")).toHaveText("متوفر");
  await checkA11y(page);

  // Hide it: its shop page is gone at once; show it again.
  await page.goto(editUrl);
  await expect(page.getByLabel("اسم المنتج")).toBeEnabled();
  await checkA11y(page);
  await page.getByTestId("product-visible").click();
  await save(page);
  expect((await page.request.get(`/p/${encodeURIComponent(slug)}`)).status()).toBe(404);
  await page.getByTestId("product-visible").click();
  await save(page);
  expect((await page.request.get(`/p/${encodeURIComponent(slug)}`)).status()).toBe(200);

  // A second tab opens the same version; this tab saves a price first.
  const other = await context.newPage();
  await other.goto(editUrl);
  await page.getByLabel("سعر الحجم 1").fill("110");
  await save(page);
  await page.goto(`/admin/products?q=${code}`);
  await expect(page.getByTestId(`product-row-${code}`).getByTestId("product-price")).toHaveText(
    "من ₪110",
  );

  await other.getByLabel("سعر الحجم 2").fill("999");
  await other.getByTestId("product-save").click();
  await expect(other.getByTestId("product-banner")).toContainText("تغيّر هذا المنتج منذ فتحته");
  await expect(other.getByLabel("سعر الحجم 2")).toHaveValue("999");
  await other.getByRole("button", { name: "إعادة التحميل" }).click();
  await expect(other.getByLabel("سعر الحجم 1")).toHaveValue("110");
  await expect(other.getByLabel("سعر الحجم 2")).toHaveValue("150");
});

/** Holds the page scripts back until the returned function lets them through: a slow connection. */
async function holdScripts(page: Page) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/_next/static/**/*.js", async (route) => {
    await held;
    await route.continue();
  });
  return release;
}

/** The editor shows disabled while its scripts are held, and turns usable once they arrive. */
async function expectDisabledUntilReady(page: Page, load: () => Promise<unknown>) {
  const release = await holdScripts(page);
  await load();
  const name = page.getByLabel("اسم المنتج");
  await expect(name).toBeVisible();
  await expect(page.getByTestId("product-editor")).toHaveAttribute("aria-busy", "true");
  await expect(name).toBeDisabled();
  await expect(page.getByTestId("product-save")).toBeDisabled();
  release();
  await expect(page.getByTestId("product-editor")).not.toHaveAttribute("aria-busy", "true");
  await expect(name).toBeEnabled();
  await page.unrouteAll();
}

test("the editor stays disabled until it is ready, on a direct load and on refresh", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signInAdmin(page, accounts!, "/admin/categories");
  await ensureCategory(page, CATEGORY);
  await expectDisabledUntilReady(page, () =>
    page.goto("/admin/products/new", { waitUntil: "commit" }),
  );
  await expectDisabledUntilReady(page, () => page.reload({ waitUntil: "commit" }));

  // What is typed once it is ready stays through the next render.
  await fillBasics(page, "لمبة بعد التحميل", uniqueCode());
  await expect(page.getByLabel("اسم المنتج")).toHaveValue("لمبة بعد التحميل");
});

test("unsaved changes ask before leaving, and a product nothing ordered is deleted", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openNewProduct(page);
  const code = uniqueCode();
  await fillBasics(page, "لمبة للحذف", code);

  await page.getByRole("button", { name: "إلغاء" }).click();
  await expect(page.getByTestId("leave-dialog")).toBeVisible();
  await page.getByRole("button", { name: "متابعة التعديل" }).click();
  await expect(page.getByLabel("اسم المنتج")).toHaveValue("لمبة للحذف");

  await page.getByLabel("السعر (₪)").fill("20");
  await save(page);

  await page.getByTestId("product-delete").click();
  await expect(page.getByTestId("delete-dialog")).toContainText("سيُحذف لمبة للحذف نهائيًا");
  await page.getByTestId("delete-confirm").click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await page.goto(`/admin/products?q=${code}`);
  await expect(page.getByText("لا توجد منتجات تطابق التصفية")).toBeVisible();
});

test("an ordered product is archived instead, opens read only, and restores to hidden", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await openNewProduct(page);
  const code = uniqueCode();
  await fillBasics(page, `ثريا للأرشفة ${code.slice(4).toLowerCase()}`, code);
  await page.getByLabel("السعر (₪)").fill("75");
  await save(page);
  const slug = await slugOf(page);

  await orderAsGuest(browser, slug);

  await page.reload();
  await page.getByTestId("product-delete").click();
  await expect(page.getByTestId("delete-dialog")).toContainText("موجود في طلبات سابقة");
  await page.getByTestId("delete-confirm").click();
  await expect(page.getByTestId("product-archived")).toBeVisible();
  await expect(page.getByLabel("اسم المنتج")).toBeDisabled();
  await expect(page.getByTestId("product-save")).toHaveCount(0);
  await checkA11y(page);
  expect((await page.request.get(`/p/${encodeURIComponent(slug)}`)).status()).toBe(404);

  await page.getByTestId("product-restore").click();
  await expect(page.getByTestId("product-archived")).toHaveCount(0);
  await expect(page.getByTestId("product-visible")).not.toBeChecked();
  await page.goto(`/admin/products?q=${code}&filter=hidden`);
  await expect(page.getByTestId(`product-row-${code}`).getByTestId("product-status")).toHaveText(
    "مخفي",
  );
});
