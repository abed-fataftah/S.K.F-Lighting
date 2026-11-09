import {
  expect as baseExpect,
  test,
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
import { cancelAsCustomer, insertOrder, uniquePhone, type InsertedOrder } from "./orders";
import { ownIp } from "./own-ip";

// covers: AC-1 to AC-17 (spec 0015). A guest looks an order up with its number and
// phone, written a different way each time, and follows it on a phone sized (390) and a computer
// sized (1280) right to left screen. Orders are written straight to the local database the way
// checkout writes them, so these flows spend none of the order allowance.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const onWorkers = process.env.E2E_TARGET === "preview" || !!process.env.CI;
const sql = accounts ? localSql() : (null as never);

// What `insertOrder` saves as the customer's name and address; none may reach the page or console.
const PERSONAL = /زبون لوحة التحكم|بناية 12|\+970/;
const NOT_FOUND = "لم نجد طلباً بهذه البيانات. تأكد من الرقمين وحاول مرة أخرى.";
let logged: string[] = [];

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(120_000);
  await page.context().setExtraHTTPHeaders({ "cf-connecting-ip": ownIp() });
  await usePhoneWidth(page, testInfo);
  logged = [];
  page.on("console", (message) => logged.push(message.text()));
});

test.afterEach(() => {
  expect(logged.filter((text) => PERSONAL.test(text) || text.includes("599123456"))).toEqual([]);
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

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const inArabicDigits = (text: string) =>
  text.replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);

const fab = (page: Page) => page.getByRole("link", { name: "واتساب", exact: true });

async function linkText(link: Locator): Promise<string> {
  const href = new URL((await link.getAttribute("href"))!);
  expect(href.origin).toBe("https://wa.me");
  return href.searchParams.get("text") ?? "";
}

/** Sends the form and waits for the action's answer, so the next try starts from its result. */
async function lookUp(page: Page, number: string, phone: string) {
  // A click while the page hydrates can be dropped; the form then also works without JavaScript.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("رقم الطلب").fill(number);
  await page.getByLabel("رقم الهاتف").fill(phone);
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByTestId("lookup-submit").click();
  await answered;
}

/** Opening the order cold is a real 307 to the lookup with the number, sent before streaming (AC-7). */
async function expectColdRedirect(page: Page, order: InsertedOrder) {
  const response = await page.request.get(`/orders/${order.number}`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const location = new URL(response.headers()["location"], "http://shop.test");
  expect(location.pathname + location.search).toBe(`/orders/track?number=${order.number}`);
}

/** Nothing personal is in the HTML (AC-13), and the page is never cached or indexed. */
async function expectPrivatePage(page: Page, order: InsertedOrder, national: string) {
  const response = await page.request.get(`/orders/${order.number}`, { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toMatch(/no-store/);
  // `next dev` sends a bare no-store; the build adds `private`.
  if (onWorkers) expect(response.headers()["cache-control"]).toMatch(/private/);
  const html = await response.text();
  expect(html).not.toMatch(PERSONAL);
  expect(html).not.toContain(national);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
}

test("a guest looks up a delivery order and follows it to cancelled", async ({
  page,
}, testInfo) => {
  const phone = uniquePhone();
  const order = await insertOrder(sql, { fulfilment: "delivery", national: phone.national });

  // AC-7: cold, the page sends the guest to the lookup with the number filled.
  await expectColdRedirect(page, order);
  await page.goto(`/orders/${order.number}`);
  await expect(page).toHaveURL(`/orders/track?number=${order.number}`);
  await expect(page.getByLabel("رقم الطلب")).toHaveValue(order.number);

  // AC-2, AC-3, AC-4: no dash in the number, the phone in international form.
  await lookUp(page, order.number.replace("-", ""), `+970${phone.national}`);
  await expect(page).toHaveURL(`/orders/${order.number}`);
  const cookies = await page.context().cookies();
  const tracked = cookies.find((cookie) => cookie.name === "skf_tracked");
  expect(tracked?.httpOnly).toBe(true);
  expect(tracked?.sameSite).toBe("Lax");
  expect(JSON.parse(decodeURIComponent(tracked!.value))).toEqual([order.id]);

  // AC-8: the header with the zone, and no address anywhere (AC-10, AC-13).
  await expect(page.getByTestId("order-heading")).toHaveText(`طلب ${order.number}`);
  await expect(page.getByTestId("order-heading").locator("bdi[dir=ltr]")).toHaveText(order.number);
  await expect(page.getByTestId("order-status")).toHaveText("تم استلام الطلب");
  await expect(page.getByTestId("order-meta")).toContainText("· توصيل إلى ");
  await expect(page.getByTestId("summary-receive")).toContainText("توصيل إلى ");
  await expect(page.locator("main")).not.toContainText(PERSONAL);
  await expectPrivatePage(page, order, phone.national);
  expect(logged.join("\n")).not.toContain(phone.national);

  // AC-9: the delivery path, with "تم استلام الطلب" current.
  const steps = page.getByTestId("timeline-step");
  await expect(steps).toHaveCount(5);
  await expect(steps.first()).toHaveAttribute("aria-current", "step");
  await expect(steps.first()).toContainText("الحالة الحالية");
  await expect(steps.nth(2)).toContainText("جاهز للتوصيل");
  await expect(steps.nth(3)).toContainText("خرج للتوصيل");

  // AC-11, AC-12: nothing paid yet; the green button and the float both send W7.
  await expect(page.getByTestId("order-payment")).toContainText("الدفع عند الاستلام");
  await expect(page.getByTestId("order-payment")).toContainText("لم يُسجَّل دفع");
  const contact = page.getByTestId("order-contact");
  await expect(contact).toHaveText("تواصل معنا عبر واتساب");
  await expect(contact).toHaveAttribute("target", "_blank");
  await expect(contact).toHaveAttribute("rel", "noopener");
  const w7 = `مرحباً، بخصوص الطلب رقم ${order.number}.`;
  expect(await linkText(contact)).toBe(w7);
  expect(await linkText(fab(page))).toBe(w7);
  // Spec 0016 AC-2: a new order offers the customer's own cancel.
  await expect(page.getByTestId("customer-cancel")).toHaveText("إلغاء الطلب");
  await checkA11y(page, testInfo);

  // AC-16: a status the owner sets shows on the next load.
  await sql`update orders set status = 'out_for_delivery' where id = ${order.id}`;
  await page.reload();
  await expect(page.getByTestId("order-status")).toHaveText("خرج للتوصيل");
  await expect(steps.nth(3)).toHaveAttribute("aria-current", "step");
  await expect(page.locator('[data-testid="timeline-step"][data-state="done"]')).toHaveCount(3);

  // AC-9, AC-11: cancelled is one line, the "ملغي" badge, and no payment badge.
  await cancelAsCustomer(sql, order);
  await page.reload();
  await expect(page.getByTestId("order-status")).toHaveText("ملغي");
  // Spec 0016 AC-7: the customer's own cancel, with its time.
  await expect(page.getByTestId("timeline-cancelled")).toContainText("ألغيت هذا الطلب في ");
  await expect(steps).toHaveCount(0);
  await expect(page.getByTestId("order-payment")).not.toContainText("لم يُسجَّل دفع");
  await checkA11y(page, testInfo);
});

test("a guest looks up a pickup order in Arabic digits and sees the pickup path", async ({
  page,
}, testInfo) => {
  const phone = uniquePhone();
  const order = await insertOrder(sql, { fulfilment: "pickup", national: phone.national });

  await page.goto("/orders/track");
  await lookUp(page, inArabicDigits(order.number), phone.shown);
  await expect(page).toHaveURL(`/orders/${order.number}`);

  await expect(page.getByTestId("order-meta")).toContainText("· استلام من المعرض");
  const steps = page.getByTestId("timeline-step");
  await expect(steps).toHaveText([/تم استلام الطلب/, /قيد التجهيز/, /جاهز للاستلام/, /تم التسليم/]);
  await expect(page.locator("main")).not.toContainText(PERSONAL);

  // AC-11: a part payment the owner recorded.
  await sql`update orders set amount_paid = 100 where id = ${order.id}`;
  await page.reload();
  await expect(page.getByTestId("order-payment")).toContainText("دفعة جزئية");
  await checkA11y(page, testInfo);
});

test("the lookup page, its misses, and its format errors", async ({ page }, testInfo) => {
  const phone = uniquePhone();
  const order = await insertOrder(sql, { fulfilment: "pickup", national: phone.national });

  // AC-1: the page as designed, with no sign in link, and the float on W1.
  await page.goto("/orders/track");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("تتبّع طلبك");
  await expect(page.getByText("أدخل رقم الطلب ورقم الهاتف الذي استخدمته عند الطلب.")).toBeVisible();
  const number = page.getByLabel("رقم الطلب");
  await expect(number).toHaveAttribute("dir", "ltr");
  await expect(number).toHaveAttribute("inputmode", "numeric");
  await expect(number).toHaveAttribute("placeholder", "26-00123");
  await expect(page.getByLabel("رقم الهاتف")).toHaveAttribute("type", "tel");
  await expect(page.getByText("عدد المحاولات محدود لحماية بيانات الطلبات.")).toBeVisible();
  await expect(page.getByText(/سجّل الدخول/)).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await linkText(fab(page))).toBe("مرحباً S.K.F lighting، أريد الاستفسار.");
  await checkA11y(page, testInfo);

  // AC-5: a wrong phone, a wrong number, and an unknown number get the same box, values kept.
  const box = page.getByTestId("lookup-error");
  const misses = [
    [order.number, "0598000001"],
    [order.number.replace(/\d$/, (d) => String((Number(d) + 1) % 10)), phone.local],
    ["99-99999", phone.local],
  ] as const;
  for (const [typedNumber, typedPhone] of misses) {
    await lookUp(page, typedNumber, typedPhone);
    await expect(box).toHaveText(NOT_FOUND);
    await expect(box).toHaveAttribute("role", "alert");
    await expect(page).toHaveURL("/orders/track");
    await expect(page.getByLabel("رقم الطلب")).toHaveValue(typedNumber);
    await expect(page.getByLabel("رقم الهاتف")).toHaveValue(typedPhone);
  }
  expect((await page.context().cookies()).some((c) => c.name === "skf_tracked")).toBe(false);
  await checkA11y(page, testInfo);

  // Format errors sit under their field.
  await lookUp(page, "26/00042", "123");
  await expect(page.getByText("اكتب رقم الطلب كما وصلك، مثل 26-00123.")).toBeVisible();
  await expect(page.getByText("اكتب رقم جوال صحيحًا، مثل 0599123456")).toBeVisible();
  await expect(page.getByLabel("رقم الطلب")).toBeFocused();
  await expect(box).toHaveCount(0);
});

test("a sixth quick try is slowed down, a match included", async ({ page }, testInfo) => {
  const phone = uniquePhone();
  const order = await insertOrder(sql, { fulfilment: "pickup", national: phone.national });
  await page.goto("/orders/track");
  const box = page.getByTestId("lookup-error");
  for (let i = 1; i <= 5; i += 1) {
    await lookUp(page, order.number, "0598000001");
    await expect(box).toHaveText(NOT_FOUND);
    await expect(page.getByLabel("رقم الهاتف")).toHaveValue("0598000001");
  }
  // AC-6: the right pair is refused too while limited, and nothing is unlocked.
  await lookUp(page, order.number, phone.local);
  await expect(box).toHaveText(
    "تجاوزت عدد المحاولات المسموح. حاول لاحقاً أو تواصل معنا عبر واتساب.",
  );
  await expect(page).toHaveURL("/orders/track");
  expect((await page.context().cookies()).some((c) => c.name === "skf_tracked")).toBe(false);
  await checkA11y(page, testInfo);
});

test("a broken or unknown order address goes to the plain lookup, never a 404", async ({
  page,
}) => {
  for (const path of ["/orders/%E0%A4%A", "/orders/abc"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"], "http://shop.test").pathname).toBe(
      "/orders/track",
    );
    expect(new URL(response.headers()["location"], "http://shop.test").search).toBe("");
  }
  const response = await page.request.get("/orders/99-99999", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
});

test("the confirmation page and the footer lead to the order page and the lookup", async ({
  page,
  context,
}) => {
  // AC-14: the placer's skf_placed cookie opens the order page too.
  const order = await insertOrder(sql, { fulfilment: "pickup" });
  await context.addCookies([
    {
      name: "skf_placed",
      value: encodeURIComponent(JSON.stringify([order.id])),
      url: test.info().project.use.baseURL!,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`/checkout/done/${order.number}`);
  const buttons = page.locator(
    '[data-testid="open-whatsapp"], [data-testid="continue-order"], a:has-text("العودة للتسوق")',
  );
  await expect(buttons).toHaveText([/لم يفتح واتساب/, "متابعة الطلب", "العودة للتسوق"]);
  // A click while the page hydrates can be dropped.
  await page.waitForLoadState("networkidle");
  await page.getByTestId("continue-order").click();
  await expect(page).toHaveURL(`/orders/${order.number}`);
  await expect(page.getByTestId("order-heading")).toHaveText(`طلب ${order.number}`);

  // AC-15: the footer link comes before the policy links.
  const footerLinks = page.locator("footer nav a");
  await expect(footerLinks.first()).toHaveText("تتبّع طلبك");
  await page.waitForLoadState("networkidle");
  await footerLinks.first().click();
  await expect(page).toHaveURL("/orders/track");
});

test("a signed in owner opening a customer order link lands on the dashboard order", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const order = await insertOrder(sql, { fulfilment: "pickup" });
  await signInAdmin(page, accounts!);
  await page.goto(`/orders/${order.number}`);
  await expect(page).toHaveURL(`/admin/orders/${order.number}`);
  await expect(page.getByTestId("order-status-card")).toBeVisible();

  // AC-16 through the dashboard: the owner moves it, and the guest sees it on reload.
  const guest = await page
    .context()
    .browser()!
    .newPage({
      extraHTTPHeaders: { "cf-connecting-ip": ownIp() },
    });
  await guest.goto("/orders/track");
  await lookUp(guest, order.number, "0599123456");
  await expect(guest).toHaveURL(`/orders/${order.number}`);
  await expect(guest.getByTestId("order-status")).toHaveText("تم استلام الطلب");
  await page.getByTestId("order-next").click();
  await expect(page.getByTestId("order-header-status")).toHaveText("قيد التجهيز");
  await guest.reload();
  await expect(guest.getByTestId("order-status")).toHaveText("قيد التجهيز");
  await guest.close();
});
