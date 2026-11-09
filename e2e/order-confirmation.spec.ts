import {
  expect as baseExpect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { ownIpHeaders } from "./own-ip";

// covers: AC-2 to AC-13 (spec 0013). The confirmation page after a real order on the dev seed
// (`pnpm db:seed`), on a phone (390) and a computer (1280). Two orders a project, to stay under the
// 5 a minute limit on workerd. W5 is built from the saved order, so it proves the saved amounts.

const expect = baseExpect.configure({ timeout: 15_000 });

const NAME = "سلمى حداد";
const PHONE = "0599123456";
const CITY = "بيت لحم";
const ADDRESS = "شارع المهد، قرب الكنيسة";
const NOTES = "اتصل قبل الوصول\nالطابق الثاني";
const ZONE = "الضفة الغربية";

test.beforeEach(async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

async function productSlug(code: string): Promise<string | null> {
  const sql = localSql();
  try {
    const [row] = await sql<{ slug: string }[]>`select slug from products where code = ${code}`;
    return row?.slug ?? null;
  } finally {
    await sql.end();
  }
}

async function shopAddress(): Promise<string | null> {
  const sql = localSql();
  try {
    const [row] = await sql<{ address: string | null }[]>`select address from shop_settings`;
    return row?.address?.trim() || null;
  } finally {
    await sql.end();
  }
}

/** Sends the order, catching the one time hand off, and returns the W5 text and the order number. */
async function placeOrder(page: Page): Promise<{ text: string; number: string }> {
  const whatsapp = page.waitForRequest(/https:\/\/wa\.me\//);
  await page.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  await page.getByTestId("place-order").click();
  const text = new URL((await whatsapp).url()).searchParams.get("text") ?? "";
  const number = /طلب جديد رقم (\d{2}-\d{5,})/.exec(text)?.[1];
  expect(number).toBeTruthy();
  return { text, number: number! };
}

const fab = (page: Page) => page.getByRole("link", { name: "واتساب", exact: true });

async function linkText(link: Locator): Promise<string> {
  const href = new URL((await link.getAttribute("href"))!);
  expect(href.origin).toBe("https://wa.me");
  return href.searchParams.get("text") ?? "";
}

/** The float and the green button: wa.me links in a new tab, W7 and W5 (AC-9 to AC-11). */
async function expectWhatsAppLinks(page: Page, number: string, w5: string) {
  for (const link of [fab(page), page.getByTestId("open-whatsapp")]) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener");
  }
  expect(await linkText(fab(page))).toBe(`مرحباً، بخصوص الطلب رقم ${number}.`);
  expect(await linkText(page.getByTestId("open-whatsapp"))).toBe(w5);
}

/** Copy puts the plain number on the clipboard and the live region reads it (AC-4). */
async function expectCopy(page: Page, context: BrowserContext, number: string) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const status = page.getByTestId("copy-status");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveText("");
  const copy = page.getByRole("button", { name: "نسخ رقم الطلب" });
  await copy.click();
  await expect(status).toHaveText("تم نسخ رقم الطلب");
  await expect(copy).toBeFocused();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(number);
}

const storageKeys = (page: Page) =>
  page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);

test("a delivery order shows its rows, address, notes, and saved totals, and every link names it", async ({
  page,
  context,
  browser,
}) => {
  const slug = await productSlug("DEMO-3");
  test.skip(!slug, "needs the dev seed (pnpm db:seed)");

  // AC-12: the console never sees the customer's details.
  const logged: string[] = [];
  page.on("console", (message) => logged.push(message.text()));

  await page.goto(`/p/${encodeURIComponent(slug!)}`);
  await page.getByRole("group", { name: "الحجم" }).getByRole("button", { name: /^كبير/ }).click();
  await page.getByRole("group", { name: "اللون" }).getByRole("button", { name: /أسود/ }).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();

  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "إتمام الطلب" })).toBeVisible();
  const keysBefore = await storageKeys(page);
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("رقم الهاتف").fill(PHONE);
  await page.getByLabel("المدينة أو البلدة").fill(CITY);
  await page.getByLabel("العنوان بالتفصيل").fill(ADDRESS);
  await page.getByLabel("ملاحظات (اختياري)").fill(NOTES);
  const { text, number } = await placeOrder(page);

  await page.goto(`/checkout/done/${number}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();

  // AC-2: the summary comes after the buttons.
  const summary = page.getByTestId("order-summary");
  const below = await page
    .getByTestId("open-whatsapp")
    .evaluate(
      (button, card) =>
        !!(button.compareDocumentPosition(card!) & Node.DOCUMENT_POSITION_FOLLOWING),
      await summary.elementHandle(),
    );
  expect(below).toBe(true);
  await expect(summary.getByRole("heading", { level: 2, name: "ملخص الطلب" })).toBeVisible();

  // AC-3: the number, the phone as typed, left to right, and the keep note.
  await expect(page.getByTestId("order-number")).toHaveText(number);
  await expect(page.getByTestId("order-phone")).toHaveText(`الهاتف: ${PHONE}`);
  await expect(page.getByTestId("order-phone").locator("bdi[dir=ltr]")).toHaveText(PHONE);
  await expect(page.getByText("احتفظ برقم الطلب ورقم الهاتف لمتابعة الطلب.")).toBeVisible();

  // AC-5 to AC-8, against W5, which is built from the saved order.
  const lines = summary.getByTestId("summary-line");
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText("أباجورة طاولة حديثة");
  await expect(lines.first()).toContainText("كبير · أسود · الكمية 1");
  await expect(summary.getByTestId("summary-receive")).toContainText(`توصيل إلى ${ZONE}`);
  await expect(summary.getByTestId("summary-receive")).toContainText(`${CITY}، ${ADDRESS}`);
  await expect(summary.getByTestId("summary-notes").locator("p")).toHaveText(NOTES, {
    useInnerText: true,
  });
  const fee = /التوصيل: (\S+)/.exec(text)?.[1];
  const total = /الإجمالي: (\S+)/.exec(text)?.[1];
  await expect(summary.getByTestId("summary-fee")).toHaveText(fee!);
  await expect(summary.getByTestId("summary-total")).toHaveText(total!);
  await expect(lines.first()).toContainText(/₪260/);
  await expect(summary.getByTestId("summary-subtotal")).toHaveText("₪260");

  await expectWhatsAppLinks(page, number, text);
  await expectCopy(page, context, number);
  await checkA11y(page);

  // AC-12: only the hand off mark is new in storage, and no customer detail reached the console.
  const added = (await storageKeys(page)).filter((key) => !keysBefore.includes(key));
  expect(added.every((key) => key.startsWith("skf-wa-"))).toBe(true);
  for (const value of [NAME, PHONE, CITY, ADDRESS, "اتصل قبل الوصول"]) {
    expect(logged.join("\n")).not.toContain(value);
  }

  // AC-9: elsewhere the float sends W1. Another browser gets the root not found page, which sits
  // outside the shop layout, so it has no float at all (spec 0013 expected W7 there).
  await page.goto("/");
  expect(await linkText(fab(page))).toBe("مرحباً S.K.F lighting، أريد الاستفسار.");
  const other = await browser.newPage();
  const response = await other.goto(`/checkout/done/${number}`);
  expect(response?.status()).toBe(404);
  await expect(other.getByText("الصفحة غير موجودة")).toBeVisible();
  await expect(fab(other)).toHaveCount(0);
  await other.close();
});

test("an unknown number and a broken segment get the not found page, with no float", async ({
  page,
}) => {
  // AC-2, AC-9, AC-13: both are a 404 on the root not found page, never a 500.
  for (const segment of ["99-99999", "%E0%A4%A"]) {
    const response = await page.goto(`/checkout/done/${segment}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("الصفحة غير موجودة")).toBeVisible();
    await expect(fab(page)).toHaveCount(0);
  }
});

test("a pickup order shows pickup at the shop with no fee", async ({ page, context }) => {
  const slug = await productSlug("DEMO-1");
  test.skip(!slug, "needs the dev seed (pnpm db:seed)");
  const address = await shopAddress();

  await page.goto(`/p/${encodeURIComponent(slug!)}`);
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("رقم الهاتف").fill(PHONE);
  const { text, number } = await placeOrder(page);

  await page.goto(`/checkout/done/${number}`);
  const summary = page.getByTestId("order-summary");
  await expect(summary.getByTestId("summary-line")).toHaveCount(1);
  await expect(summary.getByTestId("summary-line").first()).toContainText("الكمية 1");
  const receive = summary.getByTestId("summary-receive");
  await expect(receive).toContainText("استلام من المعرض");
  if (address) await expect(receive).toContainText(address);
  else await expect(receive.locator("p")).toHaveCount(1);
  await expect(summary.getByTestId("summary-notes")).toHaveCount(0);
  await expect(summary.getByTestId("summary-fee")).toHaveText("بدون رسوم");
  await expect(summary.getByTestId("summary-total")).toHaveText(/الإجمالي: (\S+)/.exec(text)![1]);
  await expect(page.getByTestId("order-phone")).toHaveText(`الهاتف: ${PHONE}`);

  await expectWhatsAppLinks(page, number, text);
  await expectCopy(page, context, number);
  await checkA11y(page);

  // A rejected write says so; without the Clipboard API there is no button, only the empty region.
  const refused = await context.newPage();
  await refused.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  });
  await refused.goto(`/checkout/done/${number}`);
  await refused.getByRole("button", { name: "نسخ رقم الطلب" }).click();
  await expect(refused.getByTestId("copy-status")).toHaveText("تعذّر النسخ");
  await refused.close();

  const bare = await context.newPage();
  await bare.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "clipboard", { get: () => undefined });
  });
  await bare.goto(`/checkout/done/${number}`);
  await expect(bare.getByTestId("order-number")).toHaveText(number);
  await expect(bare.getByTestId("copy-status")).toHaveText("");
  await expect(bare.getByRole("button", { name: "نسخ رقم الطلب" })).toHaveCount(0);
  await bare.close();
});
