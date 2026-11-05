import { expect as baseExpect, test, type Page } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-6, AC-8 to AC-15, AC-19 (spec 0008). On a phone sized right to left screen:
// the owner adds a main and a sub, renames one, reorders, and hides then shows again; a customer
// opens /c, the main, and the sub, loads more, sees an out of stock card, and adds from a card; a
// hidden category's page and product page give 404. Axe runs on all three pages.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the category flow runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

const tag = Date.now().toString(36);
const MAIN = `ثريات ${tag}`;
const SUB = `كريستال ${tag}`;
const OTHER = `أباجورات ${tag}`;
const CODE = `CAT-E2E-${tag.toUpperCase()}`;
const PRODUCTS = 25;

/** 25 products in the sub, newest first by number; the oldest is out of stock. */
async function seedProducts() {
  const sql = localSql();
  try {
    const [sub] = await sql<{ id: string }[]>`select id from categories where name = ${SUB}`;
    for (let i = 1; i <= PRODUCTS; i += 1) {
      const [product] = await sql<{ id: string }[]>`
        insert into products (category_id, code, name, slug, is_available, created_at)
        values (${sub.id}, ${`${CODE}-${i}`}, ${`ثريا ${tag} ${i}`}, ${`cat-e2e-${tag}-${i}`},
                ${i !== 1}, now() - make_interval(mins => ${PRODUCTS - i}))
        returning id`;
      await sql`
        insert into product_variants (product_id, price, is_default)
        values (${product.id}, ${10_000 + i * 100}, true)`;
    }
  } finally {
    await sql.end();
  }
}

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}-%`}`;
    await sql`delete from categories where name = ${SUB}`;
    await sql`delete from categories where name in (${MAIN}, ${OTHER})`;
  } finally {
    await sql.end();
  }
});

async function saveDialog(page: Page, name: string) {
  const dialog = page.getByTestId("category-dialog");
  await dialog.getByLabel("اسم القسم").fill(name);
  await dialog.getByTestId("category-save").click();
  await expect(dialog).toBeHidden();
}

async function setVisible(page: Page, name: string, visible: boolean) {
  await page.getByRole("button", { name: `تعديل: ${name}` }).click();
  const dialog = page.getByTestId("category-dialog");
  const toggle = dialog.getByRole("switch", { name: "ظاهر في المتجر" });
  if ((await toggle.getAttribute("aria-checked")) !== String(visible)) await toggle.click();
  await dialog.getByTestId("category-save").click();
  await expect(dialog).toBeHidden();
}

const mainOrder = (page: Page) =>
  page
    .getByTestId("admin-categories")
    .locator(":scope > li [data-testid^='category-'] > div > p > span:first-child")
    .allTextContents();

test("the owner manages categories and a customer browses them", async ({ page, browser }) => {
  test.setTimeout(300_000);
  await signInAdmin(page, accounts!, "/admin/categories");
  await expect(page.getByRole("heading", { level: 1, name: "الأقسام" })).toBeVisible();

  // Add two mains and a sub; rename the sub (AC-2, AC-3).
  await page.getByTestId("category-add-main").click();
  await saveDialog(page, MAIN);
  await page.getByTestId("category-add-main").click();
  await saveDialog(page, OTHER);
  await page.getByRole("button", { name: `إضافة قسم فرعي إلى ${MAIN}` }).click();
  await expect(page.getByTestId("category-dialog")).toContainText(`قسم فرعي جديد في ${MAIN}`);
  await saveDialog(page, `كريستل ${tag}`);
  await page.getByRole("button", { name: `تعديل: كريستل ${tag}` }).click();
  await saveDialog(page, SUB);
  await expect(page.getByTestId(`category-${SUB}`)).toBeVisible();

  // A name already used at the same level is refused on the field (AC-2).
  await page.getByTestId("category-add-main").click();
  const dialog = page.getByTestId("category-dialog");
  await dialog.getByLabel("اسم القسم").fill(MAIN);
  await dialog.getByTestId("category-save").click();
  await expect(dialog.getByText("هذا الاسم مستخدم في نفس المستوى")).toBeVisible();
  await expect(dialog.getByLabel("اسم القسم")).toBeFocused();
  await dialog.getByRole("button", { name: "إلغاء" }).click();

  // A main with a sub cannot be deleted; the reason is on screen (AC-1, AC-5).
  const deleteMain = page.getByRole("button", { name: `حذف ${MAIN}` });
  await expect(deleteMain).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByTestId(`category-${MAIN}`)).toContainText("فيه منتجات أو أقسام فرعية");

  // Reorder: the last main moves up one step and keeps focus (AC-4).
  const before = await mainOrder(page);
  expect(before.at(-1)).toBe(OTHER);
  const up = page.getByRole("button", { name: `نقل لأعلى: ${OTHER}` });
  await up.click();
  await expect.poll(() => mainOrder(page)).toEqual([...before.slice(0, -2), OTHER, MAIN]);
  await expect(up).toBeFocused();
  await expect(page.getByRole("button", { name: `نقل لأسفل: ${MAIN}` })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await checkA11y(page);

  await seedProducts();

  // The customer, in a browser of their own (AC-9 to AC-15).
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const guest = await context.newPage();
  await guest.goto("/c");
  const mainCard = guest
    .getByTestId("category-list")
    .getByRole("listitem")
    .filter({
      has: guest.getByRole("link", { name: MAIN }),
    });
  await expect(mainCard.first()).toContainText("25 منتج");
  await checkA11y(guest);

  await guest.getByRole("button", { name: "القائمة" }).click();
  await expect(
    guest.getByTestId("menu-categories").getByRole("link", { name: MAIN }),
  ).toBeVisible();
  await guest.keyboard.press("Escape");

  await mainCard.first().getByRole("link", { name: MAIN }).click();
  await expect(guest.getByRole("heading", { level: 1, name: MAIN })).toBeVisible();
  await expect(guest.getByRole("link", { name: "الكل" })).toHaveAttribute("aria-current", "page");
  await expect(guest.getByTestId("category-count")).toHaveText("25 منتج");

  await guest
    .getByRole("navigation", { name: "الأقسام الفرعية" })
    .getByRole("link", { name: SUB })
    .click();
  await expect(guest.getByRole("heading", { level: 1, name: SUB })).toBeVisible();
  const cards = guest.getByTestId("product-card");
  await expect(cards).toHaveCount(24);
  await expect(guest.getByTestId("category-shown")).toHaveText("تم عرض 24 من 25 منتج");
  await checkA11y(guest);
  const subUrl = guest.url();
  const productHref = await guest.locator("#p-1 h2 a").getAttribute("href");

  // Load more keeps the first 24 and jumps to card 25, the out of stock one (AC-11, AC-12).
  await guest.getByTestId("category-more").click();
  await expect(guest).toHaveURL(/\?page=2#p-25$/);
  await expect(cards).toHaveCount(25);
  await expect(guest.getByTestId("category-shown")).toHaveText("تم عرض 25 من 25 منتج");
  await expect(guest.getByTestId("category-more")).toHaveCount(0);
  await expect(guest.locator("#p-25 h2 a")).toBeFocused();
  const outOfStock = guest.locator("#p-25");
  await expect(outOfStock.getByRole("button", { name: "غير متوفر" })).toBeDisabled();
  await expect(
    outOfStock.getByRole("link", { name: `اسأل عن توفره عبر واتساب: ثريا ${tag} 1` }),
  ).toBeVisible();

  // Add from a card (AC-12).
  await guest.locator("#p-1").getByTestId("card-add-to-cart").click();
  await expect(guest.locator("#p-1").getByTestId("card-add-to-cart")).toContainText("تمت الإضافة");

  // Hidden means hidden: the main, the sub, and the product page give 404 (AC-6 to AC-8).
  await page.reload();
  await setVisible(page, MAIN, false);
  await expect(page.getByTestId(`category-${MAIN}`).getByText("مخفي")).toBeVisible();
  expect((await guest.goto(subUrl))?.status()).toBe(404);
  expect((await guest.goto(productHref!))?.status()).toBe(404);

  // Showing the main again brings the sub back without touching it.
  await setVisible(page, MAIN, true);
  expect((await guest.goto(subUrl))?.status()).toBe(200);
  await expect(guest.getByRole("heading", { level: 1, name: SUB })).toBeVisible();
  await context.close();
});
