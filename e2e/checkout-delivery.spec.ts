import { expect as baseExpect, test, type Page } from "@playwright/test";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { ownIpHeaders } from "./own-ip";

// covers: AC-6, AC-7, AC-8, AC-10, AC-12 (spec 0012). Checkout on the dev seed (`pnpm db:seed`),
// phone sized and right to left. The WhatsApp text is built from the saved order, so its fee and
// total prove what was saved. Three orders in all, to stay under the 5 a minute limit on workerd.

const expect = baseExpect.configure({ timeout: 15_000 });

// The two zones the migrations seed (drizzle/0001), in `sort` order.
const ZONES = [
  { name: "الضفة الغربية", fee: "₪20" },
  { name: "الداخل (مناطق 48)", fee: "₪70" },
] as const;

const NAME = "أحمد يوسف";
const PHONE = "0599123456";
const CITY = "رام الله";
const ADDRESS = "شارع الإرسال، بناية 12";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the checkout flows run on the phone project");
  test.setTimeout(120_000);
  await page.context().setExtraHTTPHeaders(ownIpHeaders());
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

async function openCheckout(page: Page) {
  await page.goto("/");
  await page.getByTestId("home-products").getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1, name: "إتمام الطلب" })).toBeVisible();
}

const summaryFee = (page: Page) => page.locator("dl > div", { hasText: "التوصيل" }).locator("dd");

const errorOf = (page: Page, field: string) => page.locator(`#checkout-${field}-error`);

/** Sends the order and returns the WhatsApp text the confirmation hands off with. */
async function sendAndReadWhatsApp(page: Page): Promise<string> {
  const whatsapp = page.waitForRequest(/https:\/\/wa\.me\//);
  await page.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  await page.getByTestId("place-order").click();
  return new URL((await whatsapp).url()).searchParams.get("text") ?? "";
}

test("a pickup order asks only for name and phone and keeps no details in the browser", async ({
  page,
  context,
}) => {
  await openCheckout(page);
  // AC-10: the hints that let the phone's own autofill fill the form.
  await expect(page.getByLabel("الاسم الكامل")).toHaveAttribute("autocomplete", "name");
  const phone = page.getByLabel("رقم الهاتف");
  await expect(phone).toHaveAttribute("type", "tel");
  await expect(phone).toHaveAttribute("autocomplete", "tel");
  await expect(page.getByLabel("المدينة أو البلدة")).toHaveCount(0);
  await expect(summaryFee(page)).toHaveText("بدون رسوم");
  await checkA11y(page);

  await page.getByLabel("الاسم الكامل").fill(NAME);
  await phone.fill(PHONE);
  const total = (await page.getByTestId("checkout-total").textContent())?.trim();
  const text = await sendAndReadWhatsApp(page);
  expect(text).toContain("الاستلام: استلام من المعرض");
  expect(text).not.toContain("التوصيل:");
  expect(text).toContain(`الإجمالي: ${total}`);

  // Nothing the customer typed stays in browser storage or cookies (spec 0004). The handoff left
  // for wa.me, so come back to the shop's own origin to read its storage.
  const number = /طلب جديد رقم (\d{2}-\d{5})/.exec(text)?.[1];
  await page.goto(`/checkout/done/${number}`);
  await expect(page.getByTestId("order-number")).toHaveText(number!);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  const cookies = JSON.stringify(await context.cookies());
  for (const typed of [NAME, encodeURIComponent(NAME), PHONE]) {
    expect(stored).not.toContain(typed);
    expect(cookies).not.toContain(typed);
  }
});

test("unrealistic entries are refused, clear live as they are fixed, and the order goes through", async ({
  page,
}) => {
  await openCheckout(page);
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await expect(page.getByLabel("المدينة أو البلدة")).toHaveAttribute(
    "autocomplete",
    "address-level2",
  );
  await expect(page.getByLabel("العنوان بالتفصيل")).toHaveAttribute(
    "autocomplete",
    "street-address",
  );
  // The first zone is preselected and its fee is in the summary (AC-6).
  await expect(page.getByRole("radio", { name: new RegExp(ZONES[0].name) })).toBeChecked();
  await expect(summaryFee(page)).toHaveText(ZONES[0].fee);
  await checkA11y(page);

  const name = page.getByLabel("الاسم الكامل");
  const phone = page.getByLabel("رقم الهاتف");
  const city = page.getByLabel("المدينة أو البلدة");
  const address = page.getByLabel("العنوان بالتفصيل");

  // Before the first send, a bad value shows nothing, even after leaving the field.
  await name.fill("أحمد");
  await phone.fill(PHONE);
  await city.fill("رام الله 2");
  await address.fill("12345");
  await address.blur();
  await expect(page.locator("[data-slot=field-error]")).toHaveCount(0);

  await page.getByTestId("place-order").click();
  await expect(name).toBeFocused();
  await expect(errorOf(page, "name")).toHaveText("اكتب الاسم الكامل: الاسم الأول واسم العائلة");
  await expect(errorOf(page, "city")).toHaveText("استخدم الحروف فقط، بدون أرقام أو رموز");
  await expect(errorOf(page, "address")).toHaveText(
    "اكتب العنوان بالكلمات، مثل اسم الشارع وأقرب معلم",
  );
  // Errors from a send are announced and linked to their fields (AC-9).
  await expect(errorOf(page, "name")).toHaveAttribute("role", "alert");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", "checkout-name-error");
  await checkA11y(page);

  // Fixing the name clears its error while typing, without moving focus.
  await name.fill(NAME);
  await expect(errorOf(page, "name")).toHaveCount(0);
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();

  // A new phone error waits until the customer leaves the field, and is not an alert.
  await phone.fill("059");
  await expect(errorOf(page, "phone")).toHaveCount(0);
  await phone.blur();
  await expect(errorOf(page, "phone")).toHaveText("اكتب رقم جوال صحيحًا، مثل 0599123456");
  await expect(errorOf(page, "phone")).not.toHaveAttribute("role", "alert");
  await expect(phone).toHaveAttribute("aria-describedby", "checkout-phone-error");
  await checkA11y(page);

  await phone.fill(PHONE);
  await expect(errorOf(page, "phone")).toHaveCount(0);
  await city.fill(CITY);
  await expect(errorOf(page, "city")).toHaveCount(0);
  await address.fill(ADDRESS);
  await expect(errorOf(page, "address")).toHaveCount(0);

  const total = (await page.getByTestId("checkout-total").textContent())?.trim();
  const text = await sendAndReadWhatsApp(page);
  expect(text).toContain(`الاستلام: توصيل إلى ${ZONES[0].name}، ${CITY}، ${ADDRESS}`);
  expect(text).toContain(`التوصيل: ${ZONES[0].fee}`);
  expect(text).toContain(`الإجمالي: ${total}`);
});

test("switching to pickup and back clears the delivery errors", async ({ page }) => {
  await openCheckout(page);
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("رقم الهاتف").fill(PHONE);
  await page.getByTestId("place-order").click();
  await expect(errorOf(page, "city")).toBeVisible();
  await expect(errorOf(page, "address")).toBeVisible();

  await page.getByRole("radio", { name: /استلام/ }).click();
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await expect(page.getByLabel("المدينة أو البلدة")).toBeVisible();
  await expect(errorOf(page, "city")).toHaveCount(0);
  await expect(errorOf(page, "address")).toHaveCount(0);
});

test("the second zone adds its own fee and the saved order matches the summary", async ({
  page,
}) => {
  await openCheckout(page);
  const pickupTotal = (await page.getByTestId("checkout-total").textContent())?.trim();
  await page.getByRole("radio", { name: /توصيل/ }).click();
  await page
    .getByRole("radio", { name: new RegExp(ZONES[1].name.replace(/[()]/g, "\\$&")) })
    .click();
  await expect(summaryFee(page)).toHaveText(ZONES[1].fee);
  await expect(page.getByTestId("checkout-total")).not.toHaveText(pickupTotal ?? "");

  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("رقم الهاتف").fill(PHONE);
  await page.getByLabel("المدينة أو البلدة").fill("Kafr Qasim");
  await page.getByLabel("العنوان بالتفصيل").fill("قرب المسجد الكبير");
  const total = (await page.getByTestId("checkout-total").textContent())?.trim();
  const text = await sendAndReadWhatsApp(page);
  expect(text).toContain(`توصيل إلى ${ZONES[1].name}`);
  expect(text).toContain(`التوصيل: ${ZONES[1].fee}`);
  expect(text).toContain(`الإجمالي: ${total}`);
});

test("a filled trap field saves nothing and shows the save failed notice", async ({ page }) => {
  await openCheckout(page);
  const trap = page.locator("input[name=company_fax_2]");
  await expect(trap).toHaveAttribute("tabindex", "-1");
  await expect(trap).toHaveAttribute("autocomplete", "off");
  const wrapper = trap.locator("..");
  await expect(wrapper).toHaveAttribute("inert", "");
  await expect(wrapper).toHaveAttribute("aria-hidden", "true");
  await expect(wrapper).not.toHaveCSS("display", "none");

  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("رقم الهاتف").fill(PHONE);
  // A bot writes the value straight in; a person cannot reach the inert field.
  await trap.evaluate((input: HTMLInputElement) => {
    input.value = "555 1234";
  });
  let handedOff = false;
  page.on("request", (request) => {
    if (/wa\.me/.test(request.url())) handedOff = true;
  });
  await page.getByTestId("place-order").click();
  await expect(page.locator("#checkout-banner")).toHaveText("تعذّر حفظ الطلب. حاول مرة أخرى.");
  await expect(page).toHaveURL(/\/checkout$/);
  expect(handedOff).toBe(false);
  await checkA11y(page);

  // The cart is still there: no order took it.
  await page.goto("/cart");
  await expect(page.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(1);
});
