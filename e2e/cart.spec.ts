import { expect as baseExpect, test, type Page } from "@playwright/test";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: feature 12 (docs/scope/ordering.md); AC-4, AC-5 (spec 0004). On a phone sized right to
// left screen: two products go in from their pages, the line with a photo shows it and the one
// without shows the placeholder, a quantity change moves the line total and the subtotal, a new
// visit keeps the cart, a line that stops selling is flagged and blocks checkout until it is
// removed, and both ways out of the cart lead to the categories page.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the cart flow runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

const tag = Date.now().toString(36);
const CODE = `CART-E2E-${tag.toUpperCase()}`;
const LAMP = `ثريا السلة ${tag}`;
const SPOT = `سبوت السلة ${tag}`;
const lampSlug = `cart-e2e-lamp-${tag}`;
const spotSlug = `cart-e2e-spot-${tag}`;

let spotVariant: string;

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    const [category] = await sql<{ id: string }[]>`
      insert into categories (name, slug) values (${`السلة ${tag}`}, ${`cart-e2e-${tag}`})
      returning id`;
    // Dated in the past, so they never lead Home's newest products, which other flows add from.
    const [lamp] = await sql<{ id: string }[]>`
      insert into products (category_id, code, name, slug, created_at)
      values (${category.id}, ${CODE}, ${LAMP}, ${lampSlug}, now() - interval '10 years')
      returning id`;
    await sql`
      insert into product_variants (product_id, size_label, size_sort, price, is_default)
      values (${lamp.id}, ${"60 سم"}, 1, ${30_000}, true)`;
    await sql`
      insert into product_media (product_id, kind, storage_key, width, height, sort)
      values (${lamp.id}, 'image', ${`products/${lamp.id}/e2e-0.webp`}, 800, 800, 0)`;
    const [spot] = await sql<{ id: string }[]>`
      insert into products (category_id, code, name, slug, created_at)
      values (${category.id}, ${`${CODE}-SPOT`}, ${SPOT}, ${spotSlug}, now() - interval '10 years')
      returning id`;
    const [spotRow] = await sql<{ id: string }[]>`
      insert into product_variants (product_id, price, is_default)
      values (${spot.id}, ${12_000}, true) returning id`;
    spotVariant = spotRow.id;
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}%`}`;
    await sql`delete from categories where slug = ${`cart-e2e-${tag}`}`;
  } finally {
    await sql.end();
  }
});

async function addFromProductPage(page: Page, slug: string) {
  await page.goto(`/p/${encodeURIComponent(slug)}`);
  const added = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByTestId("add-to-cart").click();
  await added;
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
}

const lineOf = (page: Page, name: string) =>
  page.getByTestId("cart-lines").getByRole("listitem").filter({ hasText: name });
const subtotal = (page: Page) => page.getByTestId("cart-subtotal");

test("the cart keeps its items, follows quantities, and flags a line that stopped selling", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await addFromProductPage(page, lampSlug);
  await addFromProductPage(page, spotSlug);

  await page.goto("/cart");
  await expect(page.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(2);
  // The line with a photo shows it; the line without keeps the placeholder.
  await expect(lineOf(page, LAMP).locator("img")).toHaveCount(1);
  await expect(lineOf(page, SPOT).locator("img")).toHaveCount(0);
  await expect(lineOf(page, LAMP)).toContainText("الحجم: 60 سم");
  await expect(subtotal(page)).toHaveText("₪420");
  await checkA11y(page);

  // A quantity change moves the line total and the subtotal.
  await lineOf(page, LAMP).getByRole("button", { name: "زيادة الكمية" }).click();
  await expect(lineOf(page, LAMP).getByRole("textbox")).toHaveValue("2");
  await expect(lineOf(page, LAMP)).toContainText("₪600");
  await expect(subtotal(page)).toHaveText("₪720");

  // A later visit finds the same cart: the cookie lasts about a month.
  const cookie = (await context.cookies()).find((c) => c.name === "skf_cart");
  expect(cookie?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 29 * 24 * 3600);
  await page.close();
  const next = await context.newPage();
  await next.goto("/cart");
  await expect(lineOf(next, LAMP).getByRole("textbox")).toHaveValue("2");
  await expect(subtotal(next)).toHaveText("₪720");

  // The spot stops selling: its line is flagged and checkout waits until it is removed.
  const sql = localSql();
  try {
    await sql`update product_variants set is_available = false where id = ${spotVariant}`;
  } finally {
    await sql.end();
  }
  await next.reload();
  // Next adds its own route announcer with the alert role, so find the notice by its text.
  const notice = next.getByRole("alert").filter({ hasText: "أزله لمتابعة الطلب" });
  await expect(notice).toBeVisible();
  await expect(lineOf(next, SPOT)).toContainText("غير متوفر حالياً. أزله للمتابعة.");
  await expect(lineOf(next, SPOT).getByRole("textbox")).toHaveCount(0);
  await expect(subtotal(next)).toHaveText("₪600");
  const blocked = next.getByRole("button", { name: "متابعة الطلب" });
  await expect(blocked).toHaveAttribute("aria-disabled", "true");
  await expect(blocked).toHaveAttribute("aria-describedby", (await notice.getAttribute("id"))!);
  await checkA11y(next);

  await lineOf(next, SPOT)
    .getByRole("button", { name: `حذف ${SPOT} من السلة` })
    .click();
  await expect(next.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(1);
  await expect(notice).toHaveCount(0);
  await expect(next.getByRole("link", { name: "متابعة الطلب" })).toBeVisible();

  // Keep shopping leads to the categories page.
  await next.getByRole("link", { name: "أكمل التسوق" }).click();
  await expect(next).toHaveURL(/\/c$/);

  // Removing the last line shows the empty cart, which also leads to the categories page.
  await next.goto("/cart");
  await lineOf(next, LAMP)
    .getByRole("button", { name: `حذف ${LAMP} من السلة` })
    .click();
  await expect(next.getByRole("heading", { level: 1, name: "السلة فارغة" })).toBeVisible();
  await checkA11y(next);
  await next.getByRole("link", { name: "تصفّح الأقسام" }).click();
  await expect(next).toHaveURL(/\/c$/);
});
