import {
  expect as baseExpect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { insertOrder, recordPayment, uniquePhone, type InsertedOrder } from "./orders";

// covers: AC-2 to AC-11 (spec 0016). A customer cancels their own order from its page on a phone
// sized (390) and a computer sized (1280) right to left screen, and the owner sees it flagged in
// the dashboard. WhatsApp is never reached: `wa.me` is answered with an empty page.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

const REASON = "وجدت الثريا أرخص في مكان آخر";
// What `insertOrder` saves as the customer's details, and the reason; none may reach the console.
const PERSONAL = /زبون لوحة التحكم|بناية 12|شارع فيصل|\+970|599123456|وجدت الثريا/;
let logged: string[] = [];

const octet = () => 1 + Math.floor(Math.random() * 250);
const ownIp = () => `198.18.${octet()}.${octet()}`;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
  await page.context().setExtraHTTPHeaders({ "cf-connecting-ip": ownIp() });
  await page
    .context()
    .route("https://wa.me/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );
  await usePhoneWidth(page, testInfo);
  logged = [];
  page.on("console", (message) => logged.push(message.text()));
});

test.afterEach(() => {
  expect(logged.filter((text) => PERSONAL.test(text))).toEqual([]);
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

const w6 = (order: InsertedOrder) => `مرحباً، ألغيت الطلب رقم ${order.number} من الموقع.`;
const w6Request = (order: InsertedOrder) => `مرحباً، أريد إلغاء الطلب رقم ${order.number}.`;

async function linkText(link: Locator): Promise<string> {
  const href = new URL((await link.getAttribute("href"))!);
  expect(href.origin).toBe("https://wa.me");
  return href.searchParams.get("text") ?? "";
}

/** This browser placed the order: its id in `skf_placed`, as checkout leaves it. */
async function holdPlaced(context: BrowserContext, order: InsertedOrder) {
  await context.addCookies([
    {
      name: "skf_placed",
      value: encodeURIComponent(JSON.stringify([order.id])),
      url: test.info().project.use.baseURL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function openOrderPage(page: Page, order: InsertedOrder) {
  await page.goto(`/orders/${order.number}`);
  await expect(page.getByTestId("order-heading")).toHaveText(`طلب ${order.number}`);
  // The button shows after hydration (AC-2); a click before it can be dropped.
  await page.waitForLoadState("networkidle");
}

const cancelButton = (page: Page) => page.getByTestId("customer-cancel");
const dialog = (page: Page) => page.getByTestId("customer-cancel-dialog");
const badge = (page: Page) => page.getByTestId("order-status");

async function confirmCancel(page: Page, reason?: string) {
  await cancelButton(page).click();
  if (reason) await page.getByLabel("سبب الإلغاء (اختياري)").fill(reason);
  await page.getByTestId("customer-cancel-confirm").click();
}

/** The hand off: one navigation to wa.me with W6 (AC-5). */
async function expectHandOff(page: Page, order: InsertedOrder) {
  await page.waitForURL(/^https:\/\/wa\.me\//);
  expect(new URL(page.url()).searchParams.get("text")).toBe(w6(order));
}

test("a placed delivery order is cancelled with a reason, tells the shop, and is flagged", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const order = await insertOrder(sql, { fulfilment: "delivery" });
  await holdPlaced(page.context(), order);
  await openOrderPage(page, order);

  // AC-2: the outline button sits last, below the contact button.
  await expect(cancelButton(page)).toHaveText("إلغاء الطلب");
  await expect(page.getByTestId("cancel-blocked")).toHaveCount(0);

  // AC-3: the dialog, and تراجع changes nothing.
  await cancelButton(page).click();
  await expect(dialog(page).getByRole("heading")).toHaveText(`إلغاء الطلب ${order.number}؟`);
  await expect(dialog(page).getByRole("heading").locator("bdi[dir=ltr]")).toHaveText(order.number);
  await expect(dialog(page)).toContainText("سيُلغى الطلب فوراً، ولا يمكن التراجع عن الإلغاء.");
  await expect(page.getByLabel("سبب الإلغاء (اختياري)")).toHaveAttribute("maxlength", "300");
  await checkA11y(page, testInfo);
  await dialog(page).getByRole("button", { name: "تراجع" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(badge(page)).toHaveText("تم استلام الطلب");

  // AC-4, AC-5: the cancel, then WhatsApp once with W6.
  await confirmCancel(page, `  ${REASON}  `);
  await expectHandOff(page, order);

  // AC-7: back on the page, the cancelled view.
  await page.goBack();
  await expect(page).toHaveURL(`/orders/${order.number}`);
  await expect(badge(page)).toHaveText("ملغي");
  await expect(page.getByTestId("timeline-cancelled")).toContainText("ألغيت هذا الطلب في ");
  await expect(page.getByTestId("timeline-cancelled").locator("time")).toHaveAttribute(
    "datetime",
    /^\d{4}-\d\d-\d\dT/,
  );
  const contact = page.getByTestId("order-contact");
  await expect(contact).toHaveText("أخبرنا بالإلغاء عبر واتساب");
  expect(await linkText(contact)).toBe(w6(order));
  await expect(cancelButton(page)).toHaveCount(0);
  await expect(page.getByTestId("cancel-blocked")).toHaveCount(0);
  // AC-10: the reason never reaches the customer's page.
  await expect(page.locator("body")).not.toContainText("وجدت الثريا");
  await checkA11y(page, testInfo);

  // AC-9: the dashboard flags it, with the reason and the history line.
  await signInAdmin(page, accounts!, "/admin/orders");
  await page.goto("/admin/orders");
  const row = page.getByTestId(`order-row-${order.number}`);
  await expect(row.getByTestId("order-unseen")).toBeVisible();
  await expect(row).toContainText("ألغاه العميل");
  await row.getByRole("link", { name: order.number }).click();
  const info = page.getByTestId("order-cancelled-info");
  await expect(info).toContainText("بواسطة العميل");
  await expect(info).toContainText(`السبب: ${REASON}`);
  await expect(page.getByTestId("order-history").getByRole("listitem").last()).toContainText(
    "أُلغي الطلب بواسطة العميل",
  );
  await page.goto("/admin/orders");
  await expect(row.getByTestId("order-unseen")).toHaveCount(0);
});

test("a looked up pickup order at ready is cancelled from a fresh browser", async ({
  page,
}, testInfo) => {
  const phone = uniquePhone();
  const order = await insertOrder(sql, {
    fulfilment: "pickup",
    status: "ready",
    national: phone.national,
  });

  // Only `skf_tracked`: the lookup unlocks the order (spec 0015 AC-4).
  await page.goto(`/orders/track?number=${order.number}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("رقم الهاتف").fill(phone.local);
  await page.getByTestId("lookup-submit").click();
  await expect(page).toHaveURL(`/orders/${order.number}`);
  await page.waitForLoadState("networkidle");
  await expect(badge(page)).toHaveText("جاهز للاستلام");

  await confirmCancel(page);
  await expectHandOff(page, order);
  await page.goBack();
  await expect(badge(page)).toHaveText("ملغي");
  await expect(page.getByTestId("order-contact")).toHaveText("أخبرنا بالإلغاء عبر واتساب");
  await checkA11y(page, testInfo);

  const [row] = await sql<{ cancelled_by: string; cancel_reason: string | null }[]>`
    select cancelled_by, cancel_reason from orders where id = ${order.id}`;
  expect(row).toEqual({ cancelled_by: "guest", cancel_reason: null });
});

test("a shipped order and a paid order offer a WhatsApp request instead", async ({
  page,
}, testInfo) => {
  const shipped = await insertOrder(sql, { fulfilment: "delivery", status: "out_for_delivery" });
  const paid = await insertOrder(sql, { fulfilment: "pickup", status: "preparing" });
  // Below the total: the seed's cheapest product is ₪15, and a payment never exceeds the total.
  await recordPayment(sql, paid, 1_000);
  await page.context().addCookies([
    {
      name: "skf_placed",
      value: encodeURIComponent(JSON.stringify([shipped.id, paid.id])),
      url: test.info().project.use.baseURL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // AC-8: the note and the request button, server rendered.
  await openOrderPage(page, shipped);
  const blocked = page.getByTestId("cancel-blocked");
  await expect(blocked).toContainText("طلبك في الطريق إليك. لإلغائه الآن تواصل معنا عبر واتساب.");
  const request = page.getByTestId("cancel-request");
  await expect(request).toHaveText("طلب الإلغاء عبر واتساب");
  await expect(request).toHaveAttribute("target", "_blank");
  await expect(request).toHaveAttribute("rel", "noopener");
  expect(await linkText(request)).toBe(w6Request(shipped));
  await expect(cancelButton(page)).toHaveCount(0);
  await checkA11y(page, testInfo);

  await openOrderPage(page, paid);
  await expect(page.getByTestId("cancel-blocked")).toContainText(
    "سجّلنا دفعة على هذا الطلب، لذا يتم إلغاؤه عبر واتساب.",
  );
  expect(await linkText(page.getByTestId("cancel-request"))).toBe(w6Request(paid));
  await expect(cancelButton(page)).toHaveCount(0);

  // Nothing is saved by the request.
  const statuses = await sql<{ status: string }[]>`
    select status::text from orders where id in (${shipped.id}, ${paid.id}) order by 1`;
  expect(statuses.map((row) => row.status)).toEqual(["out_for_delivery", "preparing"]);
});

test("a cancel after the owner moved the order shows the change, then the shipped note", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const order = await insertOrder(sql, { fulfilment: "delivery" });
  const owner = await page.context().browser()!.newPage();
  await signInAdmin(owner, accounts!, `/admin/orders/${order.number}`);
  await expect(owner.getByTestId("order-status-card")).toBeVisible();

  await holdPlaced(page.context(), order);
  await openOrderPage(page, order);

  // The owner starts preparing while the guest still sees "new": still cancellable (AC-6).
  await owner.getByTestId("order-next").click();
  await expect(owner.getByTestId("order-status-badge")).toHaveText("قيد التجهيز");
  await confirmCancel(page, REASON);
  const problem = page.getByTestId("customer-cancel-problem");
  await expect(problem).toHaveText("تغيّرت حالة الطلب. حدّثنا الصفحة لتظهر الحالة الحالية.");
  await expect(problem).toHaveAttribute("role", "alert");
  await expect(badge(page)).toHaveText("قيد التجهيز");
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByLabel("سبب الإلغاء (اختياري)")).toHaveValue(REASON);

  // The owner sends it out for delivery; the guest's next try is refused and the dialog goes.
  await owner.getByTestId("order-more").click();
  await owner.getByRole("menuitem", { name: /قيد التوصيل/ }).click();
  await expect(owner.getByTestId("order-status-badge")).toHaveText("قيد التوصيل");
  await page.getByTestId("customer-cancel-confirm").click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByTestId("cancel-blocked")).toContainText("طلبك في الطريق إليك.");
  await expect(badge(page)).toHaveText("خرج للتوصيل");
  await expect(badge(page)).toBeFocused();
  expect(page.url()).not.toMatch(/wa\.me/);

  // Nothing was written by either refused try.
  const [row] = await sql<{ status: string; cancel_reason: string | null }[]>`
    select status, cancel_reason from orders where id = ${order.id}`;
  expect(row).toEqual({ status: "out_for_delivery", cancel_reason: null });
  await owner.close();
});
