import { expect as baseExpect, test, type Page } from "@playwright/test";
import { formatDate } from "../src/lib/format";
import { adminAccounts, loadLocalEnv, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { ownIpHeaders } from "./own-ip";

// covers: AC-1 to AC-8, AC-10, AC-11, AC-15 (spec 0025). On a phone sized right to left screen the
// owner saves a WhatsApp number and every storefront link follows (and the env number comes back
// when none is saved); changes a zone fee, which Home and checkout follow, while a checkout opened
// before the change is refused with the fresh total and the placed order keeps its fee; pauses
// every zone, so checkout offers pickup only; adds zones up to the limit; and edits a policy with
// a preview, then a second tab's save is refused as stale. A visitor is sent to sign in. These
// settings are shared by every flow, so this file runs alone after the others
// (playwright.config.ts) and puts everything back as it found it.

loadLocalEnv();
const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const ENV_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const tag = Date.now().toString(36);

const WEST = "الضفة الغربية";
const INSIDE = "الداخل (مناطق 48)";

test.describe.configure({ mode: "serial" });

type Snapshot = {
  readonly settings: Record<string, unknown>;
  readonly zones: readonly Record<string, unknown>[];
  readonly pages: readonly Record<string, unknown>[];
};
let snapshot: Snapshot | null = null;

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    const [settings] = await sql`select whatsapp_number, contact_phone, address from shop_settings`;
    const zones = await sql`select id, name, short_name, fee, is_active, sort from delivery_zones`;
    const pages = await sql`select slug, title, body, version, updated_at from pages`;
    snapshot = { settings, zones, pages };
    await sql`update shop_settings set whatsapp_number = null`;
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts || !snapshot) return;
  const sql = localSql();
  try {
    const { settings, zones, pages } = snapshot;
    await sql`update shop_settings set ${sql(settings, "whatsapp_number", "contact_phone", "address")}`;
    const keep = zones.map((zone) => zone.id as string);
    await sql`delete from delivery_zones where id not in ${sql(keep)}`;
    for (const zone of zones) {
      await sql`update delivery_zones set ${sql(zone, "name", "short_name", "fee", "is_active", "sort")}
        where id = ${zone.id as string}`;
    }
    for (const page of pages) {
      await sql`update pages set ${sql(page, "title", "body", "version", "updated_at")}
        where slug = ${page.slug as string}`;
    }
  } finally {
    await sql.end();
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(240_000);
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

async function runSql<T>(work: (sql: ReturnType<typeof localSql>) => Promise<T>): Promise<T> {
  const sql = localSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

/** Every `wa.me` number on the page, from links that are rendered (the menu sheet is closed). */
async function whatsappNumbers(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator('a[href^="https://wa.me/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  return [...new Set(hrefs.map((href) => new URL(href).pathname.slice(1)))];
}

/**
 * Loads `path` until every link carries `number`. A read slower than 1.5 seconds falls back to the
 * env number by design (AC-4), and the dev server is slow on a route's first compile.
 */
async function expectLinksOn(page: Page, path: string, number: string, openMenu = false) {
  await expect(async () => {
    await page.goto(path);
    if (openMenu) await page.getByRole("button", { name: "القائمة" }).click();
    baseExpect(await whatsappNumbers(page), path).toEqual([number]);
  }).toPass({ timeout: 60_000 });
}

const zoneForm = (page: Page, name: string) => page.getByRole("form", { name: `منطقة ${name}` });

async function openSettings(page: Page) {
  await signInAdmin(page, accounts!, "/admin/settings");
  await expect(page.getByRole("heading", { level: 1, name: "إعدادات المتجر" })).toBeVisible();
}

async function openCheckoutWithItem(page: Page) {
  await page.goto("/");
  await page.getByTestId("home-products").getByRole("link").first().click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "إتمام الطلب" })).toBeVisible();
}

const summaryFee = (page: Page) => page.locator("dl > div", { hasText: "التوصيل" }).locator("dd");

test("a visitor who is not signed in is sent to sign in", async ({ page }) => {
  for (const path of ["/admin/settings", "/admin/settings/policies/terms"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login/);
  }
});

test("the saved WhatsApp number reaches every storefront link, and env comes back without one", async ({
  page,
}) => {
  await openSettings(page);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "بيانات التواصل",
    "رسوم التوصيل",
    "صفحات السياسات",
  ]);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const field = page.getByLabel("رقم واتساب");
  // None saved yet: the field shows the number in use, the env fallback (AC-2).
  await expect(field).toHaveValue(ENV_NUMBER);
  await expect(field).toHaveAttribute("dir", "ltr");
  await expect(field).toHaveAttribute("inputmode", "tel");
  await checkA11y(page);

  await field.fill("0599 765 432");
  await page.getByTestId("settings-contact-save").click();
  await expect(page.locator("#contact-whatsappNumber-error")).toHaveText(
    "أضف رمز الدولة في البداية، مثل 970.",
  );
  await expect(field).toBeFocused();

  await field.fill("+٩٧٠ 599-765-432");
  await page.getByTestId("settings-contact-save").click();
  await expect(page.getByText("تم حفظ الإعدادات.")).toBeVisible();
  await expect(field).toHaveValue("970599765432");
  const [saved] = await runSql((sql) => sql`select whatsapp_number from shop_settings`);
  expect(saved.whatsapp_number).toBe("970599765432");

  // AC-3: the next load of each storefront page uses it in every link.
  await page.goto("/");
  const product = await page
    .getByTestId("home-products")
    .getByRole("link")
    .first()
    .getAttribute("href");
  for (const path of ["/", product!, "/c", "/cart", "/policies/terms"]) {
    await expectLinksOn(page, path, "970599765432");
  }
  await expectLinksOn(page, "/", "970599765432", true);

  // AC-4: with no number saved, every link uses the env number again.
  await runSql((sql) => sql`update shop_settings set whatsapp_number = null`);
  await expectLinksOn(page, "/", ENV_NUMBER);
});

test("a fee change shows on Home and checkout, a stale checkout is refused, and orders keep their fee", async ({
  page,
}) => {
  await openSettings(page);
  const west = zoneForm(page, WEST);
  const fee = west.getByLabel("الرسوم (₪)");
  await expect(fee).toHaveValue("20");

  await fee.fill("12.5");
  await west.getByTestId("zone-save").click();
  await expect(west.getByText("أدخل رسوماً بالشيكل من 0 إلى 500، بدون كسور.")).toBeVisible();
  await expect(fee).toBeFocused();

  // A name another zone uses (AC-5).
  const name = west.getByLabel("اسم المنطقة");
  await name.fill(INSIDE);
  await fee.fill("٢٥");
  await west.getByTestId("zone-save").click();
  await expect(west.getByText("يوجد منطقة بهذا الاسم.")).toBeVisible();
  await name.fill(WEST);
  await west.getByTestId("zone-save").click();
  await expect(west.getByText("تم الحفظ.")).toBeVisible();
  await expect(fee).toHaveValue("25");

  await page.goto("/");
  await expect(page.getByText("توصيل: الضفة ₪25 · الداخل ₪70")).toBeVisible();
  await expect(page.getByTestId("home-trust")).toContainText("₪25");

  await openCheckoutWithItem(page);
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await expect(page.getByRole("radio", { name: new RegExp(WEST) })).toBeChecked();
  await expect(summaryFee(page)).toHaveText("₪25");
  await page.getByLabel("الاسم الكامل").fill("أحمد يوسف");
  await page.getByLabel("رقم الهاتف").fill("0599123456");
  await page.getByLabel("المدينة أو البلدة").fill("رام الله");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع الإرسال، بناية 12");

  // AC-7: the fee changes while this checkout is open; the send is refused with the fresh total.
  await runSql((sql) => sql`update delivery_zones set fee = 3000 where name = ${WEST}`);
  await page.getByTestId("place-order").click();
  await expect(page.locator("#checkout-banner")).toContainText("الطلب تغيّر");
  await expect(summaryFee(page)).toHaveText("₪30");

  await page.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  const handoff = page.waitForRequest(/https:\/\/wa\.me\//);
  await page.getByTestId("place-order").click();
  const text = new URL((await handoff).url()).searchParams.get("text") ?? "";
  const number = /طلب جديد رقم (\d{2}-\d{5})/.exec(text)?.[1];
  expect(number).toBeTruthy();

  // A later fee change leaves the placed order as it was.
  await runSql((sql) => sql`update delivery_zones set fee = 2000 where name = ${WEST}`);
  const [order] = await runSql(
    (sql) =>
      sql`select delivery_fee, delivery_zone_name from orders where order_number = ${number!}`,
  );
  expect(order).toEqual({ delivery_fee: 3000, delivery_zone_name: WEST });
});

test("pausing every zone leaves pickup only, and zones can be added up to 10", async ({ page }) => {
  await openSettings(page);
  for (const name of [WEST, INSIDE]) {
    const form = zoneForm(page, name);
    await form.getByRole("switch", { name: `مفعّلة: ${name}` }).click();
    await expect(form.getByText("متوقفة")).toBeVisible();
  }
  await expect(page.getByTestId("zones-all-paused")).toHaveText(
    "التوصيل متوقف: كل المناطق غير مفعّلة، والاستلام من المعرض فقط متاح.",
  );
  const paused = await runSql(
    (sql) => sql`select count(*)::int as n from delivery_zones where is_active`,
  );
  expect(paused[0].n).toBe(0);

  await page.goto("/");
  await expect(page.getByText(/^توصيل:/)).toHaveCount(0);
  await expect(page.getByTestId("home-trust")).not.toContainText("₪20");
  await openCheckoutWithItem(page);
  await expect(page.getByText("التوصيل غير متاح حاليًا")).toBeVisible();
  await expect(page.getByLabel("المدينة أو البلدة")).toHaveCount(0);

  // A save that fails flips the switch back and says so (AC-6).
  await page.goto("/admin/settings");
  const west = zoneForm(page, WEST);
  await page.route("**/admin/settings", (route) =>
    route.request().method() === "POST" ? route.abort() : route.fallback(),
  );
  await west.getByRole("switch").click();
  await expect(west.getByText("تعذّر الحفظ. حاول مرة أخرى.")).toBeVisible();
  await expect(west.getByRole("switch")).not.toBeChecked();
  await page.unroute("**/admin/settings");

  for (const name of [WEST, INSIDE]) {
    const form = zoneForm(page, name);
    await form.getByRole("switch").click();
    await expect(form.getByText("مفعّلة", { exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("zones-all-paused")).toHaveCount(0);

  // Add one zone from the card; it lands active at the end of the list.
  await page.getByTestId("zone-add").click();
  const added = page.getByTestId("zone-new");
  await added.getByLabel("اسم المنطقة").fill(`القدس ${tag}`);
  await added.getByLabel("الاسم المختصر").fill("القدس");
  await added.getByLabel("الرسوم (₪)").fill("40");
  await added.getByTestId("zone-new-save").click();
  await expect(zoneForm(page, `القدس ${tag}`).getByLabel("الرسوم (₪)")).toHaveValue("40");
  await checkA11y(page);

  // Fill up to 10 zones, then the button is off and says why.
  await runSql(async (sql) => {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from delivery_zones`;
    for (let i = n; i < 10; i++) {
      await sql`insert into delivery_zones (name, short_name, fee, sort)
        values (${`منطقة ${tag} ${i}`}, ${`م${i}`}, 1000, ${100 + i})`;
    }
  });
  await page.reload();
  await expect(page.getByTestId("zone-row")).toHaveCount(10);
  await expect(page.getByTestId("zone-add")).toBeDisabled();
  await expect(page.getByText("الحد الأقصى 10 مناطق.")).toBeVisible();
});

test("the owner edits a policy with a preview, and a second tab's save is refused as stale", async ({
  page,
  context,
}) => {
  await openSettings(page);
  const row = page.getByTestId("policy-row-returns");
  await expect(row).toContainText("سياسة الإرجاع");
  await expect(row).toContainText("آخر تحديث: ");
  await row.getByRole("link", { name: "تعديل: سياسة الإرجاع" }).click();
  await expect(page).toHaveURL(/\/admin\/settings\/policies\/returns$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  // A second tab opens the same page now, with the version it loads.
  const other = await context.newPage();
  await usePhoneWidth(other, test.info());
  await other.goto("/admin/settings/policies/returns");
  await expect(other.getByTestId("policy-body-input")).toBeVisible();

  const body = page.getByTestId("policy-body-input");
  const text = `## عنوان تجربة ${tag}\nسطر أول\nسطر ثان\n\n<b>نص</b>`;
  await body.fill(text);
  await page.getByTestId("policy-mode-preview").click();
  const preview = page.getByTestId("policy-preview");
  await expect(
    preview.getByRole("heading", { level: 2, name: `عنوان تجربة ${tag}` }),
  ).toBeVisible();
  await expect(preview.locator("p br")).toHaveCount(1);
  await expect(preview).toContainText("<b>نص</b>");
  await checkA11y(page);
  await page.getByTestId("policy-mode-edit").click();
  await expect(body).toHaveValue(text);

  await page.getByTestId("policy-save").click();
  await expect(page.getByText("تم حفظ الصفحة.")).toBeVisible();
  // The same form saves again with the version the first save returned (AC-11).
  await body.fill(`${text}\n\n- بند ${tag}`);
  await page.getByTestId("policy-save").click();
  await expect(page.getByText("تم حفظ الصفحة.")).toBeVisible();

  // The second tab loaded the old version: refused, and its typed text stays.
  const stale = `## نسخة قديمة ${tag}`;
  await other.getByTestId("policy-body-input").fill(stale);
  await other.getByTestId("policy-save").click();
  await expect(other.getByTestId("policy-stale")).toHaveText(
    "عُدّلت هذه الصفحة من مكان آخر بعد أن فتحتها. انسخ نصك، ثم أعد تحميل الصفحة.",
  );
  await expect(other.getByTestId("policy-body-input")).toHaveValue(stale);

  // Unsaved changes ask before the tab closes.
  const asked = new Promise<string>((resolve) =>
    other.once("dialog", (dialog) => {
      resolve(dialog.type());
      void dialog.accept();
    }),
  );
  await other.close({ runBeforeUnload: true });
  expect(await asked).toBe("beforeunload");

  // The live page shows the new text and today's date.
  await page.goto("/policies/returns");
  await expect(page.getByTestId("policy-body")).toContainText(`عنوان تجربة ${tag}`);
  await expect(page.getByTestId("policy-body")).toContainText(`بند ${tag}`);
  await expect(page.getByTestId("policy-body")).not.toContainText("نسخة قديمة");
  await expect(page.getByTestId("policy-updated")).toHaveText(
    `آخر تحديث: ${formatDate(new Date())}`,
  );
});
