import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { cancelAsCustomer, insertOrder, uniquePhone, type InsertedOrder } from "./orders";

// covers: AC-3 to AC-17, AC-19 (spec 0014). The owner runs orders from the dashboard on a phone
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

const unseenInDb = async () =>
  Number(
    (
      await sql<{ count: string }[]>`
        select count(distinct order_id) as count from order_events
        where type in ('created', 'cancelled') and seen_at is null`
    )[0].count,
  );

/** The sidebar count, read from the الطلبات link's name (the badge itself stops at +99). */
async function sidebarCount(page: Page) {
  const link = page.getByRole("navigation", { name: "لوحة التحكم" }).getByRole("link", {
    name: /^الطلبات/,
  });
  const name = (await link.getAttribute("aria-label")) ?? "";
  return Number(/الطلبات، ([\d,]+) لم تُفتح/.exec(name)?.[1]?.replace(/,/g, "") ?? 0);
}

// Under `next dev` the 50 row list renders for about 2 seconds, past the count's 1.5 second limit,
// so the sidebar shows no badge there by design (spec 0014 AC-15). The count is checked on workerd.
const onWorkers = process.env.E2E_TARGET === "preview" || !!process.env.CI;

/** The count the page shows lies between the database counts read around its render. */
async function expectSidebarMatches(page: Page, render: () => Promise<void>) {
  const low = await unseenInDb();
  await render();
  if (!onWorkers) return;
  const high = await unseenInDb();
  const shown = await sidebarCount(page);
  expect(shown).toBeGreaterThanOrEqual(Math.min(low, high));
  expect(shown).toBeLessThanOrEqual(Math.max(low, high));
}

test("a new order shows its dot and the count within a minute, and opening it clears both", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signInAdmin(page, accounts!, "/admin/orders");
  await page.clock.install();
  await expectSidebarMatches(page, async () => {
    await page.goto("/admin/orders");
    await expect(page.getByTestId("admin-orders")).toBeVisible();
  });

  const order = await insertOrder(sql);
  const row = page.getByTestId(`order-row-${order.number}`);
  await expect(row).toHaveCount(0);
  // No reload: the minute passes and the list refreshes itself. The page may still be hydrating
  // when the first minute passes, so the minute is passed again until the refresher has started.
  await expect(async () => {
    await page.clock.fastForward(61_000);
    await expect(row.getByTestId("order-unseen")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await expect(row.getByTestId("order-unseen")).toHaveText("لم يُفتح");
  if (onWorkers) {
    await expect(page.getByTestId("orders-unseen-count")).toBeVisible();
    expect(await sidebarCount(page)).toBeGreaterThan(0);
  }
  await expect(page.getByText("الطلبات التي لم تفتحها بعد مميّزة بنقطة صفراء.")).toBeVisible();
  await checkA11y(page, testInfo);

  await row.getByRole("link", { name: order.number }).click();
  await expect(page.getByTestId("order-status-card")).toBeVisible();
  // Back to the list by link, not a reload: the dot and the count update at once.
  await expectSidebarMatches(page, async () => {
    await page.getByRole("link", { name: "العودة للطلبات" }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(row.getByTestId("order-unseen")).toHaveCount(0);
  });
});

test("an order its customer cancelled shows the dot and ألغاه العميل", async ({ page }) => {
  test.setTimeout(180_000);
  const order = await insertOrder(sql, { status: "preparing" });
  await signInAdmin(page, accounts!, `/admin/orders/${order.number}`);
  await expect(page.getByTestId("order-status-card")).toBeVisible();
  await cancelAsCustomer(sql, order);

  await page.goto("/admin/orders");
  const row = page.getByTestId(`order-row-${order.number}`);
  await expect(row.getByTestId("order-unseen")).toBeVisible();
  await expect(row).toContainText("ملغي");
  await expect(row).toContainText("ألغاه العميل");

  await row.getByRole("link", { name: order.number }).click();
  await expect(page.getByTestId("order-cancelled-info")).toContainText("بواسطة العميل");
  await expect(history(page).last()).toContainText("أُلغي الطلب بواسطة العميل");
  await page.goto("/admin/orders");
  await expect(row.getByTestId("order-unseen")).toHaveCount(0);
  await expect(row).toContainText("ألغاه العميل");
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

/** `DD/MM/YYYY` of a date key, as formatDate shows a shop day. */
const shown = (key: string) => key.split("-").reverse().join("/");

/** Today's shop date key, the way the server reads it. */
const shopToday = async () =>
  (
    await sql<{ key: string }[]>`
      select to_char(now() at time zone 'Asia/Hebron', 'YYYY-MM-DD') as key`
  )[0].key;

test("the status, unseen, date, type, and method filters narrow the list and survive reload and back", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const ready = await insertOrder(sql, {
    role: "electrician",
    status: "ready",
    fulfilment: "delivery",
  });
  const fresh = await insertOrder(sql, { role: "electrician" });
  const lastWeek = await insertOrder(sql, { role: "electrician", placedAt: daysAgo(3) });
  const lastMonth = await insertOrder(sql, { role: "electrician", placedAt: daysAgo(40) });
  const guest = await insertOrder(sql, { role: null });
  const rowOf = (order: InsertedOrder) => page.getByTestId(`order-row-${order.number}`);
  const chip = (name: string) =>
    page.getByTestId("order-filters").getByRole("link", { name, exact: true });

  await signInAdmin(page, accounts!, "/admin/orders?type=electrician");
  await expect(rowOf(fresh)).toBeVisible();
  await expect(rowOf(fresh)).toContainText("كهربائي");
  await expect(rowOf(guest)).toHaveCount(0);

  // A status chip, then reload and back.
  await chip("جاهز").click();
  await expect(page).toHaveURL(/\/admin\/orders\?status=ready&type=electrician$/);
  await expect(rowOf(ready)).toBeVisible();
  await expect(rowOf(fresh)).toHaveCount(0);
  await page.reload();
  await expect(rowOf(ready)).toBeVisible();
  await expect(chip("جاهز")).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/orders\?type=electrician$/);
  await expect(rowOf(fresh)).toBeVisible();

  // The unseen toggle combines with the type.
  await openOrder(page, fresh);
  await page.goto("/admin/orders?type=electrician");
  await chip("لم تُفتح").click();
  await expect(page).toHaveURL(/unseen=1/);
  await expect(rowOf(lastWeek)).toBeVisible();
  await expect(rowOf(fresh)).toHaveCount(0);

  // Date presets.
  await page.goto("/admin/orders?type=electrician");
  await chip("اليوم").click();
  await expect(page).toHaveURL(/range=today/);
  await expect(rowOf(ready)).toBeVisible();
  await expect(rowOf(lastWeek)).toHaveCount(0);
  await chip("آخر 7 أيام").click();
  await expect(rowOf(lastWeek)).toBeVisible();
  await expect(rowOf(lastMonth)).toHaveCount(0);
  await page.reload();
  await expect(rowOf(lastWeek)).toBeVisible();

  // A custom range with only a start: "من <from>".
  const start = new Date(`${await shopToday()}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 5);
  const from = start.toISOString().slice(0, 10);
  await chip("كل الأيام").click();
  await expect(page).toHaveURL(/\/admin\/orders\?type=electrician$/);
  await expect(page.getByLabel("إلى", { exact: true })).toHaveValue("");
  await page.getByLabel("من", { exact: true }).fill(from);
  await page.getByTestId("orders-apply").click();
  await expect(page).toHaveURL(new RegExp(`from=${from}`));
  await expect(page.getByTestId("orders-range-line")).toHaveText(`من ${shown(from)}`);
  await expect(rowOf(lastWeek)).toBeVisible();
  await expect(rowOf(lastMonth)).toHaveCount(0);
  await checkA11y(page, testInfo);

  // The selects, through the one apply button.
  await page.goto("/admin/orders");
  await page.getByLabel("النوع").selectOption({ label: "كهربائي" });
  await page.getByLabel("الاستلام").selectOption({ label: "توصيل" });
  await page.getByTestId("orders-apply").click();
  await expect(page).toHaveURL(/type=electrician&method=delivery/);
  await expect(page).not.toHaveURL(/page=/);
  await expect(rowOf(ready)).toBeVisible();
  await expect(rowOf(fresh)).toHaveCount(0);
  await page.getByLabel("النوع").selectOption({ label: "عميل" });
  await page.getByLabel("الاستلام").selectOption({ label: "الكل" });
  await page.getByTestId("orders-apply").click();
  await expect(rowOf(guest)).toBeVisible();
  await expect(rowOf(guest)).toContainText("عميل");
  await expect(rowOf(ready)).toHaveCount(0);
});

test("filters that match nothing show the empty card, and a page past the last goes to page 1", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await signInAdmin(page, accounts!, "/admin/orders?status=ready&type=electrician&to=2001-01-01");
  const empty = page.getByTestId("orders-filtered-empty");
  await expect(empty).toContainText("لا توجد طلبات تطابق هذه الفلاتر.");
  await expect(page.getByTestId("orders-range-line")).toHaveText("حتى 01/01/2001");
  await checkA11y(page, testInfo);
  await empty.getByRole("link", { name: "مسح الفلاتر" }).click();
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.getByTestId("admin-orders")).toBeVisible();

  await page.goto("/admin/orders?type=electrician&page=999");
  await expect(page).toHaveURL(/\/admin\/orders\?type=electrician$/);
  await expect(page.getByTestId("admin-orders")).toBeVisible();
});

test("search opens an order by number or short number, and lists a phone's orders by POST", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const phone = uniquePhone();
  const first = await insertOrder(sql, { national: phone.national, name: "ريم سعادة" });
  const second = await insertOrder(sql, { national: phone.national, status: "preparing" });
  const logged: string[] = [];
  page.on("console", (message) => logged.push(message.text()));
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));

  await signInAdmin(page, accounts!, "/admin/orders");
  await page.waitForLoadState("networkidle");
  const field = page.getByRole("searchbox", { name: "بحث" });

  await field.fill(first.number);
  await page.getByTestId("order-search").getByRole("button", { name: "بحث" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${first.number}$`));

  await page.goto("/admin/orders");
  // Typed before hydration, the form would submit natively instead of through the action.
  await page.waitForLoadState("networkidle");
  await field.fill(String(Number(second.number.split("-")[1])));
  await field.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${second.number}$`));

  await page.goto("/admin/orders");
  // Typed before hydration, the form would submit natively instead of through the action.
  await page.waitForLoadState("networkidle");
  await field.fill("26-99999");
  await field.press("Enter");
  await expect(page.getByText("لا يوجد طلب بهذا الرقم.")).toBeVisible();
  await field.fill("مصباح");
  await field.press("Enter");
  await expect(page.getByText("اكتب رقم طلب أو رقم هاتف صحيحاً.")).toBeVisible();

  await field.fill(phone.shown);
  await field.press("Enter");
  const results = page.getByTestId("order-search-results");
  await expect(results.getByRole("heading", { name: "نتائج البحث عن هذا الرقم" })).toBeFocused();
  await expect(results.getByTestId(`order-row-${second.number}`)).toBeVisible();
  await expect(results.getByTestId(`order-row-${first.number}`)).toBeVisible();
  await expect(results.locator("[data-testid^=order-row-]")).toHaveCount(2);
  await expect(page.getByTestId("order-filters")).toHaveCount(0);
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await checkA11y(page, testInfo);

  await results.getByRole("button", { name: "مسح البحث" }).click();
  await expect(page.getByTestId("order-filters")).toBeVisible();
  await field.fill(uniquePhone().local);
  await field.press("Enter");
  await expect(page.getByText("لا توجد طلبات لهذا الرقم.")).toBeVisible();

  // The phone never reached an address, and nothing personal reached the console.
  expect(urls.filter((url) => url.includes(phone.national))).toEqual([]);
  expect(
    logged.filter((text) => /ريم|سعادة|\+970/.test(text) || text.includes(phone.national)),
  ).toEqual([]);
});
