import { expect as baseExpect, test, type Page } from "@playwright/test";
import { formatDate } from "../src/lib/format";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-8, AC-9, AC-12, AC-13, AC-14 (spec 0025). On a phone sized (390) and a computer sized
// right to left screen a customer reads each policy page from the footer and the menu, moves
// between them with the tabs, and asks a question on WhatsApp; another slug is a 404. On the phone
// the checkout line links the terms and the return policy in a new tab. Nothing here writes, so it
// runs beside the other flows; the editing flows live in shop-settings.spec.ts.

const expect = baseExpect.configure({ timeout: 15_000 });

const POLICIES = [
  { slug: "privacy", tab: "سياسة الخصوصية" },
  { slug: "terms", tab: "الشروط والأحكام" },
  { slug: "returns", tab: "سياسة الإرجاع" },
] as const;

test.beforeEach(async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await usePhoneWidth(page, testInfo);
});

async function storedPage(slug: string) {
  const sql = localSql();
  try {
    const [row] = await sql<{ title: string; updated_at: Date }[]>`
      select title, updated_at from pages where slug = ${slug}`;
    return row;
  } finally {
    await sql.end();
  }
}

const tabs = (page: Page) =>
  page.getByRole("navigation", { name: "السياسات", exact: true }).getByRole("link");

test("each policy page shows its title, tabs, date, text, and a WhatsApp question card", async ({
  page,
}, testInfo) => {
  for (const policy of POLICIES) {
    const stored = await storedPage(policy.slug);
    await page.goto(`/policies/${policy.slug}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(stored.title);
    await expect(page).toHaveTitle(`${stored.title} | S.K.F للإنارة`);
    await expect(tabs(page)).toHaveText(POLICIES.map((p) => p.tab));
    await expect(tabs(page).and(page.locator("[aria-current=page]"))).toHaveText(policy.tab);
    await expect(page.getByTestId("policy-updated")).toHaveText(
      `آخر تحديث: ${formatDate(stored.updated_at)}`,
    );
    // The starter drafts are written with ## headings: they come out as h2, never a second h1.
    await expect(
      page.getByTestId("policy-body").getByRole("heading", { level: 2 }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

    const whatsapp = page.getByTestId("policy-whatsapp");
    await expect(whatsapp).toHaveText("تواصل معنا عبر واتساب");
    const href = new URL((await whatsapp.getAttribute("href"))!);
    expect(href.hostname).toBe("wa.me");
    expect(href.searchParams.get("text")).toBe("مرحباً، عندي سؤال عن سياسات المتجر.");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await expectNoAxeViolations(page);
    if (testInfo.project.name === "phone") {
      await expectTouchTargets(page);
      await expectNoSidewaysScroll(page);
    }
  }

  // The returns draft carries the rules AC-14 asks for.
  await page.goto("/policies/returns");
  const body = page.getByTestId("policy-body");
  await expect(body).toContainText("خلال 7 أيام من تاريخ التوصيل");
  await expect(body).toContainText("علبته الأصلية");
  await expect(body).toContainText("رقم طلبك على واتساب");
});

test("the tabs move between the pages, and another slug is a 404", async ({ page }) => {
  await page.goto("/policies/privacy");
  await tabs(page).filter({ hasText: "سياسة الإرجاع" }).click();
  await expect(page).toHaveURL(/\/policies\/returns$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("سياسة الإرجاع");

  const response = await page.goto("/policies/about");
  expect(response?.status()).toBe(404);
});

test("the footer and the menu reach all three pages", async ({ page }) => {
  for (const policy of POLICIES) {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "روابط السياسات" })
      .getByRole("link", { name: policy.tab })
      .click();
    await expect(page).toHaveURL(new RegExp(`/policies/${policy.slug}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  await page.goto("/");
  await page.getByRole("button", { name: "القائمة" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "الشروط والأحكام" }).click();
  await expect(page).toHaveURL(/\/policies\/terms$/);
});

test("checkout links the terms and the return policy in a new tab", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the checkout flows run on the phone project");
  await page.goto("/");
  await page.getByTestId("home-products").getByRole("link").first().click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("link", { name: "عرض السلة" })).toBeVisible();
  await page.goto("/checkout");

  const line = page.getByTestId("checkout-policy-line");
  await expect(line).toHaveText(
    "بإرسال طلبك فإنك توافق على الشروط والأحكام (تفتح في نافذة جديدة) وسياسة الإرجاع (تفتح في نافذة جديدة).",
  );
  for (const [name, path] of [
    ["الشروط والأحكام (تفتح في نافذة جديدة)", "/policies/terms"],
    ["سياسة الإرجاع (تفتح في نافذة جديدة)", "/policies/returns"],
  ] as const) {
    const link = line.getByRole("link", { name });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", path);
  }

  // The form stays as typed: the policy opens beside it.
  await page.getByLabel("الاسم الكامل").fill("أحمد يوسف");
  const opened = page.waitForEvent("popup");
  await line.getByRole("link", { name: /سياسة الإرجاع/ }).click();
  const popup = await opened;
  await expect(popup.getByRole("heading", { level: 1 })).toHaveText("سياسة الإرجاع");
  await popup.close();
  await expect(page.getByLabel("الاسم الكامل")).toHaveValue("أحمد يوسف");
});
