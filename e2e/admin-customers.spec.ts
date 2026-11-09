import {
  expect as baseExpect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  createCustomer,
  fillCart,
  removeTestAccounts,
  sellableVariant,
  signInCustomer,
  uniqueEmail,
} from "./accounts";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { insertOrder, uniquePhone } from "./orders";
import { ownIpHeaders } from "./own-ip";

// covers: AC-1 to AC-14, AC-16, AC-18 (spec 0019). The customers section on a phone sized (390) and
// a computer sized (1280) right to left screen, signed in as the owner at aal2: find an account by
// phone in Arabic digits and by email, open it, promote it and see the user's own page and next
// order follow, demote it, fix the phone, try to remove it with an open order, then remove it for
// real. WhatsApp is never reached.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

const PASSWORD = "customers pass 123";
const NAME = "مروان عيسى";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const inArabicDigits = (text: string) => text.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(300_000);
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
  await page
    .context()
    .route("https://wa.me/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );
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

async function newPage(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext({
    ...testInfo.project.use,
    extraHTTPHeaders: ownIpHeaders(),
  });
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "" }),
  );
  return context.newPage();
}

async function searchFor(page: Page, text: string) {
  await page.getByRole("searchbox", { name: "بحث" }).fill(text);
  await page.getByTestId("customer-search").getByRole("button", { name: "بحث" }).click();
}

async function confirmRole(page: Page, label: string, testInfo: TestInfo) {
  await page.getByTestId("customer-role-change").click();
  const dialog = page.getByTestId("customer-role-dialog");
  await expect(dialog).toContainText(label);
  await expect(dialog).toContainText("يسري التغيير عند فتح الصفحة التالية.");
  await checkA11y(page, testInfo);
  await dialog.getByTestId("customer-role-confirm").click();
  await expect(dialog).toBeHidden();
}

test("the owner finds, promotes, edits, and removes a registered account", async ({
  page,
  browser,
}, testInfo) => {
  const email = uniqueEmail("customers");
  const phone = uniquePhone();
  const userId = await createCustomer(sql, {
    email,
    password: PASSWORD,
    name: NAME,
    phone: phone.local,
  });
  const first = await insertOrder(sql, {
    userId,
    role: "customer",
    national: phone.national,
    name: NAME,
    placedAt: new Date(Date.now() - 60 * 60 * 1000),
  });

  // AC-1, AC-2: the list from the sidebar, newest first.
  await signInAdmin(page, accounts!, "/admin/customers");
  await expect(page).toHaveURL(/\/admin\/customers$/);
  await expect(page).toHaveTitle("العملاء | S.K.F للإنارة");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("العملاء");
  const row = page.getByTestId(`customer-row-${userId}`);
  await expect(row).toContainText(NAME);
  await expect(row).toContainText("عميل");
  await checkA11y(page, testInfo);

  // AC-3: by phone in Arabic digits, by email in another case, and a partial number refused.
  await searchFor(page, inArabicDigits(phone.local));
  const results = page.getByTestId("customer-search-table");
  await expect(results.getByTestId(`customer-row-${userId}`)).toBeVisible();
  await expect(results.locator("tbody tr")).toHaveCount(1);
  await page.getByTestId("customer-search-clear").click();
  await searchFor(page, email.toUpperCase());
  await expect(results.getByTestId(`customer-row-${userId}`)).toBeVisible();
  await searchFor(page, "0599");
  await expect(page.getByText("اكتب اسماً أو بريداً أو رقم هاتف كاملاً.")).toBeVisible();
  expect(page.url()).not.toContain("0599");

  // AC-4 to AC-6: the customer's page.
  await page.goto(`/admin/customers/${userId}`);
  await expect(page.getByTestId("customer-name")).toHaveText(NAME);
  const details = page.getByTestId("customer-details");
  await expect(details).toContainText(email);
  await expect(details).toContainText(phone.local);
  await expect(page.getByTestId("customer-total-orders")).toHaveText("1");
  await expect(page.getByTestId(`customer-order-${first.number}`)).toContainText("جديد");
  await expect(page.getByTestId("customer-contact")).toHaveAttribute(
    "href",
    new RegExp(`^https://wa\\.me/970${phone.national}\\?text=`),
  );
  await expect(page.getByTestId("customer-history")).toContainText("لا توجد تغييرات بعد.");
  await checkA11y(page, testInfo);

  // AC-7: promote to electrician.
  await confirmRole(page, `تحويل ${NAME} إلى كهربائي؟`, testInfo);
  await expect(page.getByTestId("role-done")).toHaveText("تم تحويل الحساب إلى كهربائي.");
  await expect(page.getByTestId("customer-role")).toHaveText("كهربائي");
  await expect(page.getByTestId("customer-history")).toContainText("تحويل من عميل إلى كهربائي");

  // AC-8, AC-9: the user's next page load shows the badge, and their next order is كهربائي.
  const customer = await newPage(browser, testInfo);
  await customer.goto("/account/sign-in?next=%2Faccount");
  await customer.waitForLoadState("networkidle");
  await signInCustomer(customer, email, PASSWORD);
  await expect(customer).toHaveURL(/\/account$/, { timeout: 30_000 });
  await expect(customer.getByTestId("electrician-badge")).toHaveText("حساب كهربائي");
  await fillCart(customer, testInfo.project.use.baseURL!, await sellableVariant(sql));
  await customer.goto("/checkout");
  await customer.waitForLoadState("networkidle");
  await customer.getByTestId("place-order").click();
  await customer.waitForURL(/^https:\/\/wa\.me\//, { timeout: 30_000 });
  const placed = await sql<{ order_number: string; placed_by_role: string }[]>`
    select order_number, placed_by_role from orders where placed_by_user_id = ${userId}
    order by placed_at desc`;
  expect(placed.map((order) => order.placed_by_role)).toEqual(["electrician", "customer"]);

  // AC-7: demote back; the badge goes on the user's next load.
  await page.reload();
  await confirmRole(page, `تحويل ${NAME} إلى عميل؟`, testInfo);
  await expect(page.getByTestId("customer-role")).toHaveText("عميل");
  await customer.goto("/account");
  await expect(customer.getByTestId("electrician-badge")).toHaveCount(0);

  // AC-10, AC-13: fix the phone and see the history line.
  const newPhone = uniquePhone();
  await page.getByTestId("customer-edit").click();
  const dialog = page.getByTestId("customer-edit-dialog");
  await expect(dialog.getByLabel("الاسم")).toHaveValue(NAME);
  await dialog.getByLabel("الهاتف").fill("0222");
  await dialog.getByTestId("customer-edit-save").click();
  await expect(dialog.getByLabel("الهاتف")).toBeFocused();
  await checkA11y(page, testInfo);
  await dialog.getByLabel("الهاتف").fill(newPhone.local);
  await dialog.getByTestId("customer-edit-save").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("details-saved")).toHaveText("تم حفظ البيانات.");
  await expect(details).toContainText(newPhone.local);
  await expect(page.getByTestId("customer-history-line").first()).toContainText("تعديل الهاتف");

  // AC-14: the order page links back here.
  await page.goto(`/admin/orders/${first.number}`);
  await page.getByTestId("order-view-customer").click();
  await expect(page).toHaveURL(new RegExp(`/admin/customers/${userId}$`));

  // AC-11: open orders block the removal.
  await page.getByTestId("customer-remove").click();
  const remove = page.getByTestId("customer-remove-dialog");
  await expect(remove).toContainText("تبقى طلباته السابقة في لوحة التحكم دون ربط بحساب.");
  await checkA11y(page, testInfo);
  await remove.getByTestId("customer-remove-confirm").click();
  await expect(remove.getByTestId("customer-remove-problem")).toHaveText(
    "لا يمكن الحذف: لدى العميل طلبات لم تُسلَّم أو تُلغَ بعد.",
  );
  await remove.getByRole("button", { name: "تراجع" }).click();

  // Delivered and fully paid, the removal goes through and the orders stay unlinked.
  await sql`update orders set status = 'delivered', delivered_at = now(), amount_paid = total
    where placed_by_user_id = ${userId}`;
  await page.reload();
  await page.getByTestId("customer-remove").click();
  await remove.getByTestId("customer-remove-confirm").click();
  await expect(page).toHaveURL(/\/admin\/customers\?notice=removed$/, { timeout: 30_000 });
  await expect(page.getByTestId("customer-removed")).toHaveText("تم حذف الحساب.");
  await expect(page.getByTestId(`customer-row-${userId}`)).toHaveCount(0);
  const [gone] = await sql<{ count: number }[]>`
    select count(*)::int as count from auth.users where id = ${userId}`;
  expect(gone.count).toBe(0);
  await page.goto(`/admin/orders/${first.number}`);
  await expect(page.getByTestId("admin-order-total")).toBeVisible();
  await expect(page.getByTestId("order-view-customer")).toHaveCount(0);
  const [account] = await sql<{ fields: string[] | null; type: string }[]>`
    select type, fields from account_events where profile_id = ${userId} and type = 'removed'`;
  expect(account.type).toBe("removed");

  await customer.context().close();
});

test("a signed out visitor and a customer never see the customers section", async ({
  page,
  browser,
}, testInfo) => {
  // AC-1: signed out goes to the owner's sign in.
  await page.goto("/admin/customers");
  await expect(page).toHaveURL(/\/admin\/login/);

  // AC-1: a signed in customer too.
  const email = uniqueEmail("customers-no");
  await createCustomer(sql, { email, password: PASSWORD, name: NAME });
  const customer = await newPage(browser, testInfo);
  await customer.goto("/account/sign-in?next=%2Faccount");
  await customer.waitForLoadState("networkidle");
  await signInCustomer(customer, email, PASSWORD);
  await expect(customer).toHaveURL(/\/account$/, { timeout: 30_000 });
  await customer.goto("/admin/customers");
  await expect(customer).toHaveURL(/\/admin\/login/);
  await customer.context().close();
});
