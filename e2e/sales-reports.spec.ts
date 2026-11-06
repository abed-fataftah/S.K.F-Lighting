import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import {
  addDaysToKey,
  formatDayKey,
  formatNumber,
  shopDateKey,
  shopDayStart,
} from "../src/lib/format";
import { formatPrice } from "../src/lib/money";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { cancelAsCustomer, insertOrder, recordPayment } from "./orders";

// covers: AC-1 to AC-9, AC-13, AC-14 (spec 0024). On a phone sized (390) and a computer sized
// (1280) right to left screen the owner opens the report on this month, switches to the last 7
// days, picks a custom range with orders in it and downloads its CSV, enters a range that ends
// before it starts, and opens an empty period. A signed out visitor gets neither page nor file.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

// Each project owns a past month no other flow writes to, so its numbers are exact; January 2003
// stays empty for the empty period.
const WINDOWS = {
  phone: { from: "2003-05-01", to: "2003-05-31" },
  desktop: { from: "2003-07-01", to: "2003-07-31" },
} as const;
const EMPTY = { from: "2003-01-01", to: "2003-01-31" };

const windowOf = (testInfo: TestInfo) =>
  testInfo.project.name === "phone" ? WINDOWS.phone : WINDOWS.desktop;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
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

const kpi = (page: Page, name: "sales" | "orders" | "average" | "collected") =>
  page.getByTestId(`kpi-${name}-value`);

/** The counting rule written out again, independently of the app, for live periods. */
async function expectedFor(days: { readonly from: string; readonly to: string }) {
  const [row] = await sql<{ orders: string; sales: string }[]>`
    select count(*) filter (where status <> 'cancelled') as orders,
      coalesce(sum(total) filter (where status <> 'cancelled'), 0) as sales
    from orders
    where placed_at >= ${shopDayStart(days.from)}
      and placed_at < ${shopDayStart(addDaysToKey(days.to, 1))}`;
  return { orders: Number(row.orders), sales: Number(row.sales) };
}

/** Reloads until the page's two main numbers match the database (other flows add orders). */
async function expectLiveNumbers(page: Page, days: { readonly from: string; readonly to: string }) {
  await expect(async () => {
    await page.reload();
    const expected = await expectedFor(days);
    await baseExpect(kpi(page, "orders")).toHaveText(formatNumber(expected.orders));
    await baseExpect(kpi(page, "sales")).toHaveText(formatPrice(expected.sales));
  }).toPass({ timeout: 30_000 });
}

/** Three orders in `days`: delivery partly paid, pickup paid in full, and one cancelled. */
async function seedWindow(days: { readonly from: string; readonly to: string }) {
  // Clear what an earlier run left in this window, so the numbers stay exact.
  await sql`
    delete from orders
    where placed_at >= ${shopDayStart(days.from)}
      and placed_at < ${shopDayStart(addDaysToKey(days.to, 1))}`;
  const at = (key: string, hour: number) =>
    new Date(shopDayStart(key).getTime() + hour * 3_600_000);
  const delivery = await insertOrder(sql, {
    fulfilment: "delivery",
    status: "preparing",
    placedAt: at(addDaysToKey(days.from, 2), 10),
    name: '=HYPERLINK("x")',
  });
  const pickup = await insertOrder(sql, {
    status: "ready",
    placedAt: at(addDaysToKey(days.from, 9), 15),
    role: "electrician",
  });
  const cancelled = await insertOrder(sql, { placedAt: at(addDaysToKey(days.from, 12), 9) });
  await cancelAsCustomer(sql, cancelled);
  const totals = await sql<{ id: string; total: number; delivery_fee: number }[]>`
    select id, total, delivery_fee from orders where id in ${sql([delivery.id, pickup.id])}`;
  const total = (id: string) => totals.find((row) => row.id === id)!;
  await recordPayment(sql, delivery, 1_000);
  await recordPayment(sql, pickup, total(pickup.id).total);
  const [product] = await sql<{ name: string; code: string }[]>`
    select p.name, p.code from order_lines l join products p on p.id = l.product_id
    where l.order_id = ${pickup.id}`;
  const sales = total(delivery.id).total + total(pickup.id).total;
  return {
    delivery,
    pickup,
    cancelled,
    product,
    sales,
    deliveryFee: total(delivery.id).delivery_fee,
    collected: 1_000 + total(pickup.id).total,
  };
}

test("this month opens by default and agrees with the database", async ({ page }, testInfo) => {
  await insertOrder(sql);
  await signInAdmin(page, accounts!, "/admin/reports");
  await expect(page.getByRole("heading", { level: 1, name: "التقارير" })).toBeVisible();
  await expect(page).toHaveTitle(/التقارير/);
  const chip = page.getByRole("link", { name: "هذا الشهر" });
  await expect(chip).toHaveAttribute("aria-current", "page");

  const today = shopDateKey(new Date());
  const month = { from: `${today.slice(0, 8)}01`, to: today };
  const line = page.getByTestId("reports-range-line");
  await expect(line).toHaveText(
    month.from === month.to
      ? formatDayKey(month.from)
      : `من ${formatDayKey(month.from)} إلى ${formatDayKey(month.to)}`,
  );
  await expectLiveNumbers(page, month);
  await expect(page.getByTestId("reports-export")).toHaveAttribute(
    "href",
    `/admin/reports/export?from=${month.from}&to=${month.to}`,
  );
  await checkA11y(page, testInfo);

  // The last 7 days: the address, the line, and the numbers change.
  await page.getByRole("link", { name: "آخر 7 أيام" }).click();
  await expect(page).toHaveURL(/\/admin\/reports\?range=7d$/);
  await expect(page.getByRole("link", { name: "آخر 7 أيام" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const week = { from: addDaysToKey(today, -6), to: today };
  await expect(line).toHaveText(`من ${formatDayKey(week.from)} إلى ${formatDayKey(week.to)}`);
  await expectLiveNumbers(page, week);
});

test("a custom range shows its numbers, chart, best sellers, and CSV", async ({
  page,
}, testInfo) => {
  const days = windowOf(testInfo);
  const seeded = await seedWindow(days);
  await signInAdmin(page, accounts!, "/admin/reports?range=custom");

  // The chip opens on this month, prefilled, with no error.
  const form = page.getByTestId("reports-custom-form");
  await expect(form.getByLabel("من", { exact: true })).toHaveValue(
    `${shopDateKey(new Date()).slice(0, 8)}01`,
  );
  await form.getByLabel("من", { exact: true }).fill(days.from);
  await form.getByLabel("إلى", { exact: true }).fill(days.to);
  await form.getByTestId("reports-show").click();
  await expect(page).toHaveURL(
    new RegExp(`/admin/reports\\?range=custom&from=${days.from}&to=${days.to}$`),
  );
  await expect(page.getByTestId("reports-range-line")).toHaveText(
    `من ${formatDayKey(days.from)} إلى ${formatDayKey(days.to)}`,
  );

  await expect(kpi(page, "sales")).toHaveText(formatPrice(seeded.sales));
  await expect(page.getByTestId("kpi-sales-note")).toHaveText(
    `منها رسوم توصيل ${formatPrice(seeded.deliveryFee)}`,
  );
  await expect(kpi(page, "orders")).toHaveText("2");
  await expect(page.getByTestId("kpi-orders-note")).toHaveText("وأُلغي طلب واحد");
  await expect(kpi(page, "average")).toHaveText(
    formatPrice(Math.floor((2 * seeded.sales + 2) / 4)),
  );
  await expect(kpi(page, "collected")).toHaveText(formatPrice(seeded.collected));
  await expect(page.getByTestId("kpi-collected-note")).toHaveText(
    `المتبقي ${formatPrice(seeded.sales - seeded.collected)}`,
  );

  // One bar a day; two of them hold sales; the picture states the totals.
  const chart = page.getByTestId("reports-chart");
  await expect(chart.getByRole("heading", { name: "المبيعات حسب اليوم" })).toBeVisible();
  await expect(chart.getByTestId("reports-bar")).toHaveCount(31);
  await expect(chart.getByRole("img")).toHaveAttribute(
    "aria-label",
    `المبيعات ${formatPrice(seeded.sales)} في طلبين، من ${formatDayKey(days.from)} إلى ${formatDayKey(days.to)}`,
  );
  await expect(
    chart.getByRole("table", { name: "المبيعات حسب اليوم" }).getByRole("row"),
  ).toHaveCount(32);

  const top = page.getByRole("table", { name: "الأكثر مبيعاً" });
  await expect(top.getByRole("link", { name: seeded.product.name })).toBeVisible();
  await expect(top).toContainText(seeded.product.code);
  await checkA11y(page, testInfo);

  // The CSV: every order of the period, the cancelled one too, a guarded name, plain shekels.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("reports-export").click(),
  ]);
  expect(download.suggestedFilename()).toBe(`skf-sales-${days.from}-to-${days.to}.csv`);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const file = Buffer.concat(chunks).toString("utf8");
  expect(file.startsWith("\uFEFFرقم الطلب,التاريخ,الوقت,الحالة,يُحتسب في المبيعات,")).toBe(true);
  const lines = file.slice(1).split("\r\n");
  expect(lines).toHaveLength(5); // header, three orders, and the last line end
  expect(lines[1].split(",").slice(0, 2)).toEqual([
    seeded.delivery.number,
    addDaysToKey(days.from, 2),
  ]);
  expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
  expect(lines[2]).toContain(",نعم,كهربائي,");
  expect(lines[3].startsWith(`${seeded.cancelled.number},`)).toBe(true);
  expect(lines[3]).toContain(",ملغي,لا,");
  expect(lines[3].endsWith(",")).toBe(true);
});

test("a range that ends before it starts shows the error with this month", async ({
  page,
}, testInfo) => {
  await signInAdmin(page, accounts!, "/admin/reports?range=custom&from=2003-05-10&to=2003-05-02");
  const from = page.getByLabel("من", { exact: true });
  await expect(from).toHaveAttribute("aria-invalid", "true");
  await expect(from).toHaveValue("2003-05-10");
  await expect(page.getByLabel("إلى", { exact: true })).toHaveValue("2003-05-02");
  await expect(page.getByText("تاريخ البداية بعد تاريخ النهاية.")).toBeVisible();
  const today = shopDateKey(new Date());
  const monthStart = `${today.slice(0, 8)}01`;
  await expect(page.getByTestId("reports-range-line")).toHaveText(
    monthStart === today
      ? formatDayKey(today)
      : `من ${formatDayKey(monthStart)} إلى ${formatDayKey(today)}`,
  );
  await expect(page.getByTestId("reports-export")).toHaveAttribute(
    "href",
    `/admin/reports/export?from=${monthStart}&to=${today}`,
  );
  await checkA11y(page, testInfo);
});

test("an empty period shows the empty card and still exports", async ({ page }, testInfo) => {
  await signInAdmin(
    page,
    accounts!,
    `/admin/reports?range=custom&from=${EMPTY.from}&to=${EMPTY.to}`,
  );
  await expect(page.getByTestId("reports-empty")).toHaveText("لا توجد طلبات في هذه الفترة.");
  await expect(kpi(page, "sales")).toHaveText("₪0");
  await expect(kpi(page, "orders")).toHaveText("0");
  await expect(kpi(page, "average")).toHaveText("—");
  await expect(kpi(page, "collected")).toHaveText("₪0");
  await expect(page.getByTestId("reports-chart")).toHaveCount(0);
  await expect(page.getByTestId("reports-export")).toBeEnabled();
  await checkA11y(page, testInfo);

  // The keyboard reaches every chip, the form, and the export.
  await page.getByRole("link", { name: "اليوم", exact: true }).focus();
  for (const name of ["آخر 7 أيام", "آخر 30 يوماً", "هذا الشهر", "فترة مخصصة"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("من", { exact: true })).toBeFocused();
});

test("a signed out visitor gets neither the report nor the file", async ({ page, request }) => {
  const response = await request.get("/admin/reports/export?from=2003-05-01&to=2003-05-31", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe("/admin/reports");

  await page.goto("/admin/reports");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Freports/);
});
