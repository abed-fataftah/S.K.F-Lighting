import {
  expect as baseExpect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { formatPrice, toShekelsInput } from "../src/lib/money";
import { createCustomer, removeTestAccounts, signInCustomer, uniqueEmail } from "./accounts";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { insertOrder, type InsertedOrder } from "./orders";

// covers: AC-1 to AC-4, AC-6 to AC-9, AC-12, AC-13 (spec 0022). The owner cuts line prices on an
// electrician's order on a phone sized (390) and a computer sized (1280) right to left screen,
// resets one, saves, and the electrician then sees the struck price and the shop's discount.
// A customer order shows no button, a delivered electrician order shows the locked line, and a
// price above the catalog is refused under its field.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);
const PASSWORD = "price deal 123";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
  await usePhoneWidth(page, testInfo);
});

test.afterAll(async () => {
  if (!accounts) return;
  await removeTestAccounts(sql);
  await sql.end();
});

/**
 * Axe on every screen. Touch targets only out of edit mode: the price field is 40 high by the spec
 * (AC-2), under the 44 the other controls keep.
 */
async function checkA11y(page: Page, testInfo: TestInfo, { touch = true } = {}) {
  await expectNoAxeViolations(page);
  if (testInfo.project.name === "phone") {
    if (touch) await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  }
}

/** An electrician account, and an order it placed with a second line (3 units), totals summed. */
async function electricianOrder(status?: "delivered") {
  const email = uniqueEmail("price-elec");
  const userId = await createCustomer(sql, { email, password: PASSWORD, name: "سامي حداد" });
  await sql`update profiles set role = 'electrician' where id = ${userId}`;
  const order = await insertOrder(sql, { role: "electrician", userId });
  await sql`
    insert into order_lines (order_id, product_id, variant_id, product_name, product_code,
      quantity, catalog_unit_price, unit_price, line_total, sort)
    select order_id, product_id, variant_id, 'سبوت لوحة التحكم', 'E2E-ORD-2',
      3, catalog_unit_price, catalog_unit_price, catalog_unit_price * 3, 1
    from order_lines where order_id = ${order.id}`;
  await sql`
    update orders set
      subtotal = (select sum(line_total) from order_lines where order_id = ${order.id}),
      total = (select sum(line_total) from order_lines where order_id = ${order.id})
    where id = ${order.id}`;
  if (status === "delivered") {
    await sql`update orders set status = 'delivered', delivered_at = now() where id = ${order.id}`;
  }
  const [{ price }] = await sql<{ price: number }[]>`
    select catalog_unit_price as price from order_lines where order_id = ${order.id} limit 1`;
  return { email, order, price };
}

const fields = (page: Page) => page.getByTestId("line-price-input");
const total = (page: Page) => page.getByTestId("admin-order-total");
const editButton = (page: Page) => page.getByRole("button", { name: "تعديل الأسعار" });

async function openOrder(page: Page, order: InsertedOrder) {
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);
  await expect(page.getByTestId("admin-order-lines")).toBeVisible();
}

async function signInElectrician(
  browser: Browser,
  testInfo: TestInfo,
  email: string,
  path: string,
) {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  await page.goto(`/account/sign-in?next=${encodeURIComponent(path)}`);
  await page.waitForLoadState("networkidle");
  await signInCustomer(page, email, PASSWORD);
  await page.waitForURL((url) => url.pathname === path, { timeout: 30_000 });
  return { context, page };
}

test("the owner cuts two lines, resets one, and the electrician sees the deal", async ({
  page,
  browser,
}, testInfo) => {
  const { email, order, price } = await electricianOrder();
  const start = price * 4;
  const cut = price - 1_000;
  await openOrder(page, order);
  await expect(page.getByTestId("prices-locked")).toHaveCount(0);
  await expect(total(page)).toHaveText(formatPrice(start));
  await checkA11y(page, testInfo);

  // AC-2: edit mode with prefilled fields, by keyboard.
  await editButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(editButton(page)).toHaveCount(0);
  await expect(fields(page)).toHaveCount(2);
  await expect(page.getByLabel("سعر الوحدة للسطر 1")).toHaveValue(toShekelsInput(price));
  await expect(page.getByLabel("سعر الوحدة للسطر 2")).toHaveValue(toShekelsInput(price));
  await expect(page.getByTestId("save-prices")).toBeDisabled();

  // Live preview while typing.
  await page.getByLabel("سعر الوحدة للسطر 1").fill(toShekelsInput(cut));
  await page.getByLabel("سعر الوحدة للسطر 2").fill("0");
  await expect(total(page)).toHaveText(formatPrice(cut));
  await expect(page.getByTestId("line-catalog-price")).toHaveCount(2);
  await expect(page.getByTestId("admin-order-discount")).toHaveText(formatPrice(cut - start));
  await checkA11y(page, testInfo, { touch: false });

  await page.getByLabel("ملاحظة (تظهر لك فقط)").fill("مشروع كبير");
  await page.getByTestId("save-prices").click();
  await expect(page.getByTestId("prices-saved")).toHaveText("حُفظت الأسعار.");
  await expect(editButton(page)).toBeFocused();
  await expect(total(page)).toHaveText(formatPrice(cut));
  await expect(page.getByTestId("order-history")).toContainText(
    `المتجر عدّل الأسعار: الإجمالي من ${formatPrice(start)} إلى ${formatPrice(cut)}`,
  );
  await expect(page.getByTestId("order-history-note")).toHaveText("مشروع كبير");

  // AC-2: reset one line to its catalog price and save again.
  await editButton(page).click();
  await page.getByTestId("line-price-reset").nth(1).click();
  await expect(page.getByLabel("سعر الوحدة للسطر 2")).toHaveValue(toShekelsInput(price));
  const afterReset = cut + price * 3;
  await expect(total(page)).toHaveText(formatPrice(afterReset));
  await page.getByTestId("save-prices").click();
  await expect(page.getByTestId("prices-saved")).toBeVisible();
  await expect(total(page)).toHaveText(formatPrice(afterReset));
  await expect(page.getByTestId("order-history").getByRole("listitem")).toHaveCount(3);

  // AC-7: struck catalog price on the cut line, and the deal rows.
  await expect(page.getByTestId("line-catalog-price")).toHaveCount(1);
  await expect(page.getByTestId("admin-order-before")).toHaveText(formatPrice(start));
  await expect(page.getByTestId("admin-order-discount")).toHaveText(formatPrice(-1_000));
  await checkA11y(page, testInfo);

  // AC-9: the electrician's order page.
  const electrician = await signInElectrician(browser, testInfo, email, `/orders/${order.number}`);
  const summary = electrician.page.getByTestId("order-summary");
  await expect(summary.getByTestId("summary-line-before")).toHaveCount(1);
  await expect(summary.getByTestId("summary-line-before")).toContainText(formatPrice(price));
  await expect(summary.getByTestId("summary-before")).toHaveText(formatPrice(start));
  await expect(summary.getByTestId("summary-discount")).toHaveText(formatPrice(-1_000));
  await expect(summary.getByText("خصم المتجر")).toBeVisible();
  await expect(summary.getByTestId("summary-total")).toHaveText(formatPrice(afterReset));
  await expect(electrician.page.getByText("مشروع كبير")).toHaveCount(0);
  await checkA11y(electrician.page, testInfo);
  await electrician.context.close();
});

test("a price above the catalog is refused under its field, and cancel drops it", async ({
  page,
}, testInfo) => {
  const { order, price } = await electricianOrder();
  await openOrder(page, order);
  await editButton(page).click();
  const first = page.getByLabel("سعر الوحدة للسطر 1");
  await first.fill(toShekelsInput(price + 100));
  await page.getByTestId("save-prices").click();
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(first).toBeFocused();
  await expect(
    page.getByText(`لا يمكن أن يزيد السعر عن سعر الكتالوج (${formatPrice(price)}).`),
  ).toBeVisible();
  await checkA11y(page, testInfo, { touch: false });

  await page.getByTestId("cancel-prices").click();
  await expect(editButton(page)).toBeFocused();
  await expect(total(page)).toHaveText(formatPrice(price * 4));
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from order_events
    where order_id = ${order.id} and type = 'line_price_changed'`;
  expect(count).toBe(0);
});

test("a customer order shows no button, a delivered electrician order the locked line", async ({
  page,
}, testInfo) => {
  const customer = await insertOrder(sql, { role: "customer" });
  await openOrder(page, customer);
  await expect(editButton(page)).toHaveCount(0);
  await expect(page.getByTestId("prices-locked")).toHaveCount(0);

  const { order } = await electricianOrder("delivered");
  await page.goto(`/admin/orders/${order.number}`);
  await expect(page.getByTestId("prices-locked")).toHaveText(
    "الأسعار مقفلة بعد التسليم أو الإلغاء.",
  );
  await expect(editButton(page)).toHaveCount(0);
  await checkA11y(page, testInfo);
});
