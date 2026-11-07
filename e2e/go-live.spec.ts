import { devices, expect as baseExpect, test, type Page } from "@playwright/test";
import { routes } from "../src/lib/routes";
import { expectNoAxeViolations, usePhoneWidth } from "./a11y";
import { adminAccounts } from "./admin-auth";
import { seededChandelier, type SeededProduct } from "./categories";
import { localSql } from "./local-db";
import { uniquePhone } from "./orders";

// covers: AC-15 (spec 0028). The seven launch pages pass axe (WCAG 2.1 A and AA, zero violations)
// on a phone sized right to left screen, on every CI run: home, a category, a product, search, the
// cart and checkout with that product added through the real button, and the order page opened
// from a fresh browser through the real lookup form. The same pages `pnpm launch:check` measures.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

// The order and lookup limits count per IP, and every local request shares one: this flow sends
// its own, so it never spends another flow's allowance.
const octet = () => 1 + Math.floor(Math.random() * 250);
const ownIp = () => `198.18.${octet()}.${octet()}`;

let seeded: SeededProduct;

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    seeded = await seededChandelier(sql);
  } finally {
    await sql.end();
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the launch pages are checked on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  // Seven pages with an axe pass each, an order, and a second browser; the dev server also
  // compiles each page on its first visit.
  test.setTimeout(240_000);
  await page.context().setExtraHTTPHeaders({ "cf-connecting-ip": ownIp() });
  await usePhoneWidth(page, testInfo);
});

/** Places the cart as a pickup order and gives back its number, from the WhatsApp hand off. */
async function placeOrder(page: Page, phone: string): Promise<string> {
  await page.getByLabel("الاسم الكامل").fill("زبون الإطلاق");
  await page.getByLabel("رقم الهاتف").fill(phone);
  await page.route(/https:\/\/wa\.me\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>wa</title>" }),
  );
  const whatsapp = page.waitForRequest(/https:\/\/wa\.me\//);
  await page.getByTestId("place-order").click();
  const text = new URL((await whatsapp).url()).searchParams.get("text") ?? "";
  const number = /طلب جديد رقم (\d{2}-\d{5})/.exec(text)?.[1];
  expect(number).toBeTruthy();
  return number!;
}

test("the seven launch pages pass axe on a phone", async ({ page, browser }, testInfo) => {
  await page.goto(routes.home);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto(routes.category(seeded.category));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAxeViolations(page);

  // A word from the product's own name, so the results page is never the empty state.
  const word = seeded.name.split(" ")[0]!;
  await page.goto(routes.search(word));
  await expect(page.getByTestId("search-count")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto(routes.product(seeded.product));
  await expect(page.getByRole("heading", { level: 1, name: seeded.name })).toBeVisible();
  await expectNoAxeViolations(page);
  // A click while the page hydrates can be dropped.
  await page.waitForLoadState("networkidle");
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();

  await page.goto(routes.cart);
  await expect(page.getByTestId("cart-lines").getByRole("listitem")).toHaveCount(1);
  await expectNoAxeViolations(page);

  await page.goto(routes.checkout);
  await expect(page.getByTestId("place-order")).toBeVisible();
  await expectNoAxeViolations(page);

  const phone = uniquePhone();
  const number = await placeOrder(page, phone.local);

  // A fresh browser, the way a customer opens the order from the WhatsApp link later.
  const other = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: testInfo.project.use.baseURL,
    extraHTTPHeaders: { "cf-connecting-ip": ownIp() },
  });
  try {
    const fresh = await other.newPage();
    await usePhoneWidth(fresh, testInfo);
    await fresh.goto(routes.orderTrack);
    await fresh.waitForLoadState("networkidle");
    await fresh.getByLabel("رقم الطلب").fill(number);
    await fresh.getByLabel("رقم الهاتف").fill(phone.local);
    await fresh.getByTestId("lookup-submit").click();
    await expect(fresh).toHaveURL(new RegExp(`${routes.order(number)}$`));
    await expect(fresh.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(fresh);
  } finally {
    await other.close();
  }
});
