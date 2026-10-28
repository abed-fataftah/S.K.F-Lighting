import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { insertOrder, type InsertedOrder } from "./orders";

// covers: AC-3 to AC-7, AC-19 (spec 0014). The owner runs orders from the dashboard on a phone
// sized (390) and a computer sized (1280) right to left screen, signed in with a code.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

test.afterAll(async () => {
  if (accounts) await sql.end();
});

async function checkA11y(page: Page, testInfo: TestInfo) {
  await expectNoAxeViolations(page);
  if (testInfo.project.name === "phone") {
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  }
}

async function openOrder(page: Page, order: InsertedOrder) {
  await page.goto(`/admin/orders/${order.number}`);
  await expect(page.getByTestId("order-status-card")).toBeVisible();
}

const badge = (page: Page) => page.getByTestId("order-status-badge");
const history = (page: Page) => page.getByTestId("order-history").getByRole("listitem");

async function tapNext(page: Page, label: string) {
  await page.getByTestId("order-next").click();
  await expect(badge(page)).toHaveText(label);
  await expect(badge(page)).toBeFocused();
}

async function chooseMove(page: Page, label: string, status: string) {
  await page.getByTestId("order-more").click();
  await page.getByRole("menuitem", { name: label }).click();
  await expect(badge(page)).toHaveText(status);
}

test("a pickup order goes new, preparing, ready, delivered with the primary button", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const order = await insertOrder(sql, { fulfilment: "pickup", name: "سامي عودة" });
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);
  await expect(page.getByTestId("order-status-card")).toBeVisible();
  await expect(page.getByTestId("order-header-status")).toHaveText("جديد");
  await expect(page.getByTestId("order-next")).toHaveText("قيد التجهيز");
  await checkA11y(page, testInfo);

  // The contact link carries the status as it is now, and no price or address (AC-7).
  const contact = new URL((await page.getByTestId("order-contact").getAttribute("href")) ?? "");
  expect(contact.origin + contact.pathname).toBe("https://wa.me/970599123456");
  expect(contact.searchParams.get("text")).toBe(
    `مرحباً سامي عودة، معك S.K.F للإنارة بخصوص طلبك رقم ${order.number}. حالة الطلب الآن: جديد.`,
  );
  await expect(page.getByTestId("order-contact")).toHaveAttribute("target", "_blank");

  await tapNext(page, "قيد التجهيز");
  await tapNext(page, "جاهز");
  // A pickup order never offers "قيد التوصيل".
  await expect(page.getByTestId("order-next")).toHaveText("تم التسليم");
  await expect(page.getByTestId("order-more")).toHaveCount(1);
  await page.getByTestId("order-more").click();
  await expect(page.getByRole("menuitem")).toHaveText(["رجوع إلى قيد التجهيز"]);
  await page.keyboard.press("Escape");
  await tapNext(page, "تم التسليم");

  // Final: the completed line, no control, and every move in the history.
  const card = page.getByTestId("order-status-card");
  await expect(card).toContainText("اكتمل الطلب في");
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(page.getByTestId("order-header-status")).toHaveText("تم التسليم");
  await expect(history(page)).toHaveCount(4);
  await expect(history(page).nth(0)).toContainText("استلمنا الطلب");
  await expect(history(page).nth(1)).toContainText("المتجر نقل الطلب إلى قيد التجهيز");
  await expect(history(page).nth(3)).toContainText("المتجر نقل الطلب إلى تم التسليم");
  await expect(history(page).nth(3).locator("time")).toHaveText(
    /^\d{2}\/\d{2}\/\d{4} · \d{1,2}:\d{2} [صم]$/,
  );
  await checkA11y(page, testInfo);

  await page.reload();
  await expect(badge(page)).toHaveText("تم التسليم");
  const after = new URL((await page.getByTestId("order-contact").getAttribute("href")) ?? "");
  expect(after.searchParams.get("text")).toContain("حالة الطلب الآن: تم التسليم.");
});

test("a delivery order skips ahead, steps back once, and passes out for delivery", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const order = await insertOrder(sql, { fulfilment: "delivery" });
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);

  await chooseMove(page, "انقل إلى جاهز", "جاهز");
  // One step back follows the path: ready goes back to preparing, not to new.
  await chooseMove(page, "رجوع إلى قيد التجهيز", "قيد التجهيز");
  await tapNext(page, "جاهز");
  await tapNext(page, "قيد التوصيل");
  await tapNext(page, "تم التسليم");
  await expect(history(page)).toHaveText([
    /استلمنا الطلب/,
    /نقل الطلب إلى جاهز/,
    /نقل الطلب إلى قيد التجهيز/,
    /نقل الطلب إلى جاهز/,
    /نقل الطلب إلى قيد التوصيل/,
    /نقل الطلب إلى تم التسليم/,
  ]);
});

test("cancelling with a reason shows the reason and no controls", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const order = await insertOrder(sql, { status: "preparing" });
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);

  await page.getByTestId("order-cancel").click();
  const dialog = page.getByTestId("order-cancel-dialog");
  await expect(dialog.getByRole("heading")).toHaveText(`إلغاء الطلب ${order.number}؟`);
  await checkA11y(page, testInfo);
  // تراجع closes it and changes nothing.
  await dialog.getByRole("button", { name: "تراجع" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(badge(page)).toHaveText("قيد التجهيز");

  await page.getByTestId("order-cancel").click();
  await page.getByLabel("سبب الإلغاء (اختياري)").fill("  العميل طلب التأجيل  ");
  await page.getByTestId("order-cancel-confirm").click();
  await expect(page.getByTestId("order-cancel-dialog")).toHaveCount(0);
  await expect(badge(page)).toHaveText("ملغي");
  const card = page.getByTestId("order-status-card");
  await expect(card).toContainText("بواسطة المتجر");
  await expect(card).toContainText("السبب: العميل طلب التأجيل");
  await expect(card.getByRole("button")).toHaveCount(0);
  await expect(history(page).last()).toContainText("أُلغي الطلب بواسطة المتجر");
  await checkA11y(page, testInfo);
});

test("a second tab moving the same order first gives the stale message", async ({ page }) => {
  test.setTimeout(180_000);
  const order = await insertOrder(sql);
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);
  const other = await page.context().newPage();
  await openOrder(other, order);

  await other.getByTestId("order-next").click();
  await expect(badge(other)).toHaveText("قيد التجهيز");

  await page.getByTestId("order-next").click();
  await expect(page.getByTestId("order-status-problem")).toHaveText(
    "تغيّرت حالة الطلب من مكان آخر. حدّثنا الصفحة لتظهر الحالة الحالية.",
  );
  await expect(badge(page)).toHaveText("قيد التجهيز");
  await expect(page.getByTestId("order-next")).toHaveText("جاهز");
  // Only the first tab's move was written.
  await expect(history(page)).toHaveCount(2);
  await other.close();
});
