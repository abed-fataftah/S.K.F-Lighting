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
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { cancelAsCustomer, insertOrder, recordPayment, uniquePhone } from "./orders";

// covers: AC-1 to AC-11 (spec 0018). My Orders on a phone sized (390) and a computer sized (1280)
// right to left screen: the sign in round trip, a real signed in order beside an older one, the
// money line as payments are recorded, another account's empty list, 21 orders in two steps, and
// the links that lead here. WhatsApp is never reached.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

const PASSWORD = "orders pass 123";
const NAME = "ليلى عمر";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
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

async function newContext(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(testInfo.project.use);
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "" }),
  );
  return context;
}

/** Typed before hydration, the sign in form would submit natively instead of through the action. */
async function signIn(page: Page, email: string) {
  await page.waitForLoadState("networkidle");
  await signInCustomer(page, email, PASSWORD);
}

const cards = (page: Page) => page.getByTestId("my-order");
const card = (page: Page, number: string) =>
  cards(page).filter({ has: page.getByTestId("my-order-number").getByText(number) });

test("a signed out visitor signs in, lands back here, and finds the links both ways", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail("orders-empty");
  await createCustomer(sql, { email, password: PASSWORD, name: NAME });

  // AC-1: signed out goes to sign in and comes back.
  await page.goto("/account/orders");
  await expect(page).toHaveURL(/\/account\/sign-in\?next=%2Faccount%2Forders$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/account\/orders$/, { timeout: 30_000 });
  await expect(page).toHaveTitle("طلباتي | S.K.F للإنارة");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("طلباتي");

  // AC-6: a new account sees the empty card.
  await expect(page.getByRole("heading", { name: "لا توجد طلبات بعد" })).toBeVisible();
  await expect(page.getByText("عند إرسال أول طلب سيظهر هنا.")).toBeVisible();
  await expect(page.getByRole("link", { name: "تصفّح الأقسام" })).toHaveAttribute("href", "/c");
  await expect(cards(page)).toHaveCount(0);
  await checkA11y(page, testInfo);

  // AC-7: the links both ways, by keyboard too.
  const toProfile = page.getByTestId("profile-link");
  await expect(toProfile).toHaveText("بياناتي وكلمة المرور");
  await toProfile.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByTestId("orders-link").click();
  await expect(page).toHaveURL(/\/account\/orders$/);

  // AC-8: the account tab goes to My Orders and stays current here.
  const tab = page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "حسابي" });
  await expect(tab).toHaveAttribute("href", "/account/orders");
  await expect(tab).toHaveAttribute("aria-current", "page");
});

test("a customer follows their orders, what is still owed, and opens one", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  const email = uniqueEmail("orders-mine");
  const otherEmail = uniqueEmail("orders-other");
  const phone = uniquePhone();
  const userId = await createCustomer(sql, {
    email,
    password: PASSWORD,
    name: NAME,
    phone: phone.local,
  });
  await createCustomer(sql, { email: otherEmail, password: PASSWORD, name: "سامي خليل" });
  const older = await insertOrder(sql, {
    userId,
    national: phone.national,
    placedAt: new Date(Date.now() - 60 * 60 * 1000),
  });

  // AC-8: sign in with no next lands on My Orders.
  await page.goto("/account/sign-in");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/account\/orders$/, { timeout: 30_000 });

  // A real signed in checkout.
  await fillCart(page, testInfo.project.use.baseURL!, await sellableVariant(sql));
  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("place-order").click();
  await page.waitForURL(/^https:\/\/wa\.me\//, { timeout: 30_000 });
  const [placed] = await sql<{ id: string; order_number: string; total: number }[]>`
    select id, order_number, total from orders where placed_by_user_id = ${userId}
    order by placed_at desc limit 1`;
  const newer = { id: placed.id, number: placed.order_number };

  // AC-2, AC-3: from the account tab, both orders newest first.
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "التنقل الرئيسي" })
    .getByRole("link", { name: "حسابي" })
    .click();
  await expect(page).toHaveURL(/\/account\/orders$/);
  await expect(page.getByTestId("my-order-number")).toHaveText([newer.number, older.number]);
  const first = card(page, newer.number);
  await expect(first.getByText("جديد")).toBeVisible();
  await expect(first.getByTestId("my-order-meta")).toContainText("منتج واحد");
  await expect(first.getByTestId("my-order-meta")).toContainText(/\d{1,2}\/\d{1,2}\/\d{4}/);
  await expect(first.getByTestId("my-order-total")).toContainText("₪");
  // AC-4: no payment recorded yet, no money line.
  await expect(page.getByTestId("my-order-money")).toHaveCount(0);
  await checkA11y(page, testInfo);

  // AC-4: part paid, then fully paid; a cancelled order shows only the money owed back (spec
  // 0023 AC-13).
  await recordPayment(sql, newer, placed.total - 1_000);
  await page.reload();
  await expect(first.getByTestId("my-order-money")).toHaveText("المتبقي ₪10");
  await recordPayment(sql, newer, placed.total);
  await page.reload();
  await expect(first.getByTestId("my-order-money")).toHaveText("مدفوع");
  await recordPayment(sql, older, 1_000);
  await cancelAsCustomer(sql, older);
  await page.reload();
  const cancelled = card(page, older.number);
  await expect(cancelled.getByText("ملغي")).toBeVisible();
  await expect(cancelled.getByTestId("my-order-money")).toHaveText("مبلغ يُعاد إليك ₪10");

  // AC-3: the card opens its order page.
  await page.getByRole("link", { name: `عرض الطلب ${newer.number}` }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${newer.number}$`));
  await expect(page.getByTestId("order-heading")).toHaveText(`طلب ${newer.number}`);

  // AC-2: another account sees only its own (none).
  const otherContext = await newContext(browser, testInfo);
  const other = await otherContext.newPage();
  await usePhoneWidth(other, testInfo);
  await other.goto("/account/sign-in?next=%2Faccount%2Forders");
  await signIn(other, otherEmail);
  await expect(other).toHaveURL(/\/account\/orders$/, { timeout: 30_000 });
  await expect(other.getByRole("heading", { name: "لا توجد طلبات بعد" })).toBeVisible();
  await expect(other.getByText(newer.number)).toHaveCount(0);
  await expect(other.getByText(older.number)).toHaveCount(0);
  await otherContext.close();
});

test("21 orders load in two steps and jump to the first new card", async ({ page }, testInfo) => {
  const email = uniqueEmail("orders-many");
  const userId = await createCustomer(sql, { email, password: PASSWORD, name: NAME });
  const start = Date.now() - 2 * 60 * 60 * 1000;
  const orders = [];
  for (let i = 0; i < 21; i++) {
    orders.push(await insertOrder(sql, { userId, placedAt: new Date(start + i * 60_000) }));
  }

  await page.goto("/account/sign-in?next=%2Faccount%2Forders");
  await signIn(page, email);
  await expect(page).toHaveURL(/\/account\/orders$/, { timeout: 30_000 });

  // AC-5: 20 cards, the count line, and the link.
  await expect(cards(page)).toHaveCount(20);
  await expect(page.getByTestId("my-order-number").first()).toHaveText(orders[20].number);
  await expect(page.getByTestId("my-orders-shown")).toHaveText("تم عرض 20 من 21 طلب");
  await checkA11y(page, testInfo);

  await page.getByTestId("my-orders-more").click();
  await expect(page).toHaveURL(/\/account\/orders\?page=2#o-21$/);
  await expect(cards(page)).toHaveCount(21);
  await expect(page.locator("#o-21")).toBeInViewport();
  await expect(page.locator("#o-21").getByTestId("my-order-number")).toHaveText(orders[0].number);
  await expect(page.getByTestId("my-orders-more")).toHaveCount(0);
  await expect(page.getByTestId("my-orders-shown")).toHaveCount(0);

  // AC-5: a bad or past the end page still renders.
  await page.goto("/account/orders?page=abc");
  await expect(cards(page)).toHaveCount(20);
  await page.goto("/account/orders?page=9");
  await expect(cards(page)).toHaveCount(21);
  await expect(page.getByTestId("my-orders-more")).toHaveCount(0);
});
