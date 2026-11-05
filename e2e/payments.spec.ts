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

// covers: AC-1 to AC-13, AC-16, AC-17 (spec 0023). On a phone sized (390) and a computer sized
// (1280) right to left screen the owner records a partial cash payment, pays the rest by cheque,
// and reverses the cheque; the customer's order page and My Orders show the same balance. A paid
// order is cancelled with a warning and refunded in two steps, the list filters by payment, and a
// cheque without a bank is refused under its field.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);
const PASSWORD = "balance due 123";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(240_000);
  await usePhoneWidth(page, testInfo);
});

test.afterAll(async () => {
  if (!accounts) return;
  await removeTestAccounts(sql);
  await sql.end();
});

async function checkA11y(page: Page, testInfo: TestInfo) {
  await expectNoAxeViolations(page);
  if (testInfo.project.name === "phone") {
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  }
}

/** A customer account and an order it placed, with the order's total. */
async function customerOrder() {
  const email = uniqueEmail("pay-cust");
  const userId = await createCustomer(sql, { email, password: PASSWORD, name: "ليلى منصور" });
  const order = await insertOrder(sql, { role: "customer", userId, status: "preparing" });
  const [{ total }] = await sql<{ total: number }[]>`
    select total from orders where id = ${order.id}`;
  return { email, order, total };
}

const card = (page: Page) => page.getByTestId("order-payments");
const form = (page: Page) => page.getByTestId("payment-form");
const notice = (page: Page) => page.getByTestId("payments-notice");

async function openOrder(page: Page, order: InsertedOrder) {
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);
  await expect(card(page)).toBeVisible();
}

async function signInAs(browser: Browser, testInfo: TestInfo, email: string, path: string) {
  const context = await browser.newContext(testInfo.project.use);
  const page = await context.newPage();
  // The same 390 width `usePhoneWidth` gives the main page.
  if (testInfo.project.name === "phone") await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/account/sign-in?next=${encodeURIComponent(path)}`);
  await page.waitForLoadState("networkidle");
  await signInCustomer(page, email, PASSWORD);
  await page.waitForURL((url) => url.pathname === path, { timeout: 30_000 });
  return { context, page };
}

async function record(page: Page, amount: string) {
  await form(page).getByLabel("المبلغ (₪)").fill(amount);
  await form(page).getByTestId("payment-submit").click();
}

test("a partial cash payment, the rest by cheque, and a reversed cheque agree everywhere", async ({
  page,
  browser,
}, testInfo) => {
  const { email, order, total } = await customerOrder();
  const first = 1_000;
  await openOrder(page, order);

  // AC-1, AC-2, AC-3: nothing yet, the payment form prefilled with the whole total.
  await expect(card(page).getByTestId("payments-empty")).toHaveText("لا توجد دفعات بعد.");
  await expect(card(page).getByTestId("payments-remaining")).toHaveText(formatPrice(total));
  await expect(form(page).getByLabel("المبلغ (₪)")).toHaveValue(toShekelsInput(total));
  await expect(form(page).getByTestId("payment-cheque-fields")).toHaveCount(0);
  await checkA11y(page, testInfo);

  // AC-4: a partial cash payment with a note, sent by keyboard.
  await form(page).getByLabel("المبلغ (₪)").fill(toShekelsInput(first));
  await form(page).getByLabel("ملاحظة (تظهر لك فقط)").fill("عربون");
  await form(page).getByTestId("payment-submit").focus();
  await page.keyboard.press("Enter");
  await expect(notice(page)).toHaveText("سُجّلت الدفعة.");
  await expect(notice(page)).toBeFocused();
  await expect(card(page).getByTestId("payment-row")).toHaveCount(1);
  await expect(card(page).getByTestId("payment-row")).toContainText("نقداً");
  await expect(card(page).getByTestId("payment-row-note")).toHaveText("عربون");
  await expect(card(page).getByTestId("payments-paid")).toHaveText(formatPrice(first));
  await expect(card(page).getByTestId("payments-remaining")).toHaveText(formatPrice(total - first));
  await expect(form(page).getByLabel("المبلغ (₪)")).toHaveValue(toShekelsInput(total - first));
  await expect(page.getByTestId("order-history")).toContainText(
    `المتجر سجّل دفعة ${formatPrice(first)} (نقداً)`,
  );
  await checkA11y(page, testInfo);

  // AC-12, AC-13: the customer sees the same balance on the order page and in My Orders.
  const customer = await signInAs(browser, testInfo, email, `/orders/${order.number}`);
  const payment = customer.page.getByTestId("order-payment");
  await expect(payment).toContainText("دفعة جزئية");
  await expect(payment.getByTestId("order-payment-paidAmount")).toHaveText(formatPrice(first));
  await expect(payment.getByTestId("order-payment-remainingAmount")).toHaveText(
    formatPrice(total - first),
  );
  await expect(customer.page.locator("main")).not.toContainText("عربون");
  await expect(customer.page.locator("main")).not.toContainText("نقداً");
  await checkA11y(customer.page, testInfo);
  await customer.page.goto("/account/orders");
  const myCard = customer.page
    .getByTestId("my-order")
    .filter({ has: customer.page.getByTestId("my-order-number").getByText(order.number) });
  await expect(myCard.getByTestId("my-order-money")).toHaveText(
    `المتبقي ${formatPrice(total - first)}`,
  );

  // AC-3: the rest by cheque, with its number, bank, and date.
  await form(page).getByLabel("الطريقة").selectOption("cheque");
  await form(page).getByLabel("رقم الشيك").fill("٠٠٤٥٦٧");
  await form(page).getByLabel("البنك").fill("بنك فلسطين");
  await form(page).getByLabel("تاريخ الشيك").fill("2030-01-15");
  await form(page).getByTestId("payment-submit").click();
  await expect(notice(page)).toHaveText("سُجّلت الدفعة.");
  await expect(card(page).getByTestId("payment-row").nth(1)).toContainText(
    "شيك رقم 004567 · بنك فلسطين · تاريخه 15/01/2030",
  );
  await expect(card(page).getByTestId("payments-settled")).toHaveText("الطلب مدفوع بالكامل.");
  await expect(form(page)).toHaveCount(0);
  await customer.page.reload();
  await expect(myCard.getByTestId("my-order-money")).toHaveText("مدفوع");

  // AC-6: the cheque bounced: reverse it with a reason, by keyboard.
  const reverseButton = card(page).getByRole("button", {
    name: new RegExp(`^عكس الدفعة ${escapeRegExp(formatPrice(total - first))}`),
  });
  await reverseButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("payment-reverse-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("payment-reverse-confirm").click();
  await expect(dialog.getByLabel("سبب العكس")).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("اكتب سبب العكس.")).toBeVisible();
  await checkA11y(page, testInfo);
  await dialog.getByLabel("سبب العكس").fill("شيك مرتجع");
  await dialog.getByTestId("payment-reverse-confirm").click();
  await expect(dialog).toHaveCount(0);
  await expect(notice(page)).toHaveText("عُكست الدفعة.");
  await expect(notice(page)).toBeFocused();
  const reversed = card(page).locator('[data-testid="payment-row"][data-reversed="true"]');
  await expect(reversed.locator("s")).toContainText(formatPrice(total - first));
  await expect(reversed.getByTestId("payment-reversal")).toContainText("شيك مرتجع");
  await expect(card(page).getByTestId("payments-remaining")).toHaveText(formatPrice(total - first));
  await expect(form(page)).toBeVisible();
  await expect(page.getByTestId("order-history")).toContainText(
    `المتجر عكس دفعة ${formatPrice(total - first)}`,
  );

  // AC-13: My Orders is back to the same remaining amount.
  await customer.page.reload();
  await expect(myCard.getByTestId("my-order-money")).toHaveText(
    `المتبقي ${formatPrice(total - first)}`,
  );
  await customer.context.close();
});

test("a paid order is cancelled with a warning, then refunded in two steps", async ({
  page,
}, testInfo) => {
  const { order, total } = await customerOrder();
  const paid = Math.min(total, 2_000);
  await openOrder(page, order);
  await record(page, toShekelsInput(paid));
  await expect(notice(page)).toHaveText("سُجّلت الدفعة.");

  // AC-9: the cancel dialog warns about the money on the order.
  await page.getByTestId("order-cancel").click();
  const cancel = page.getByTestId("order-cancel-dialog");
  await expect(cancel.getByTestId("order-cancel-paid-warning")).toHaveText(
    `على هذا الطلب دفعات بقيمة ${formatPrice(paid)}. بعد الإلغاء سجّل الاسترجاع في بطاقة الدفعات.`,
  );
  await cancel.getByTestId("order-cancel-confirm").click();
  await expect(cancel).toHaveCount(0);

  // AC-2, AC-5: refund mode, prefilled with what was paid.
  await expect(card(page).getByTestId("payments-owedBack")).toHaveText(formatPrice(paid));
  await expect(card(page).getByTestId("payments-remaining")).toHaveCount(0);
  await expect(form(page).getByRole("heading", { name: "تسجيل استرجاع" })).toBeVisible();
  await expect(form(page).getByLabel("المبلغ (₪)")).toHaveValue(toShekelsInput(paid));
  await checkA11y(page, testInfo);

  // A refund above what was paid is refused under its field.
  await record(page, toShekelsInput(paid + 100));
  await expect(form(page).getByLabel("المبلغ (₪)")).toHaveAttribute("aria-invalid", "true");
  await expect(form(page).getByLabel("المبلغ (₪)")).toBeFocused();
  await expect(form(page)).toContainText(`المبلغ أكبر من المدفوع (${formatPrice(paid)}).`);

  await record(page, toShekelsInput(paid / 2));
  await expect(notice(page)).toHaveText("سُجّل الاسترجاع.");
  await expect(card(page).getByTestId("payment-row").nth(1)).toContainText("استرجاع · نقداً");
  await expect(card(page).getByTestId("payment-row").nth(1)).toContainText(formatPrice(-paid / 2));
  await expect(card(page).getByTestId("payments-owedBack")).toHaveText(formatPrice(paid / 2));

  // AC-11: the list shows a refund due, and the filter finds it.
  await page.goto("/admin/orders?payment=refund_due");
  await expect(
    page.getByTestId(`order-row-${order.number}`).getByTestId("order-payment-badge"),
  ).toHaveText("استرجاع مستحق");
  await checkA11y(page, testInfo);

  await page.goto(`/admin/orders/${order.number}`);
  await record(page, toShekelsInput(paid / 2));
  await expect(notice(page)).toHaveText("سُجّل الاسترجاع.");
  await expect(form(page)).toHaveCount(0);
  await expect(card(page).getByTestId("payments-owedBack")).toHaveCount(0);
  await page.goto("/admin/orders?payment=refund_due");
  await expect(page.getByTestId(`order-row-${order.number}`)).toHaveCount(0);
});

test("the payment filter keeps each order to its own value", async ({ page }, testInfo) => {
  const unpaid = await customerOrder();
  const partial = await customerOrder();
  const paid = await customerOrder();
  await sql`update orders set amount_paid = 100 where id = ${partial.order.id}`;
  await sql`update orders set amount_paid = total where id = ${paid.order.id}`;
  await signInAdmin(page, accounts!, "/admin/orders");

  // The filter is a select in the GET form, so choosing and applying writes `payment=`.
  await page.getByLabel("الدفع", { exact: true }).selectOption("partial");
  await page.getByTestId("orders-apply").click();
  await expect(page).toHaveURL(/payment=partial/);
  await checkA11y(page, testInfo);

  const cases = [
    ["none", unpaid.order.number, "لم يُدفع"],
    ["partial", partial.order.number, "دفعة جزئية"],
    ["paid", paid.order.number, "مدفوع"],
  ] as const;
  for (const [value, number, label] of cases) {
    await page.goto(`/admin/orders?payment=${value}`);
    await expect(
      page.getByTestId(`order-row-${number}`).getByTestId("order-payment-badge"),
    ).toHaveText(label);
    for (const [, other] of cases.filter(([otherValue]) => otherValue !== value)) {
      await expect(page.getByTestId(`order-row-${other}`)).toHaveCount(0);
    }
  }
});

test("a cheque without a bank is refused inline, and nothing is sent", async ({ page }) => {
  const { order } = await customerOrder();
  await openOrder(page, order);
  await form(page).getByLabel("الطريقة").selectOption("cheque");
  await form(page).getByLabel("رقم الشيك").fill("123");
  await form(page).getByLabel("تاريخ الشيك").fill("2030-01-15");
  await form(page).getByTestId("payment-submit").click();
  const bank = form(page).getByLabel("البنك");
  await expect(bank).toHaveAttribute("aria-invalid", "true");
  await expect(bank).toBeFocused();
  await expect(form(page)).toContainText("أدخل اسم البنك.");
  await expect(card(page).getByTestId("payment-row")).toHaveCount(0);

  // Back to cash: the cheque fields go, and a 0 is refused.
  await form(page).getByLabel("الطريقة").selectOption("cash");
  await expect(form(page).getByTestId("payment-cheque-fields")).toHaveCount(0);
  await record(page, "0");
  await expect(form(page)).toContainText("اكتب مبلغاً صحيحاً.");
  await expect(card(page).getByTestId("payment-row")).toHaveCount(0);
});

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
