import { execSync } from "node:child_process";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import {
  adminAccounts,
  enterCode,
  serviceClient,
  signInAdmin,
  signInWithPassword,
} from "./admin-auth";
import { expectNoAxeViolations, expectTouchTargets, usePhoneWidth } from "./a11y";

// covers: AC-1 (spec 0004). Dashboard sign in on a phone sized right to left screen, against the
// accounts `admin-setup.ts` made on the local Supabase.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the dashboard sign in runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  test.setTimeout(120_000);
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
}

test("a signed out visitor is sent to sign in, keeping where they were going", async ({ page }) => {
  await page.goto("/admin/orders?page=2");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders%3Fpage%3D2$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await checkA11y(page);
});

test("a customer's correct password is refused with the same message as a wrong one", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await signInWithPassword(page, accounts!.customerEmail, accounts!.password);
  const refusal = page.locator("#admin-login-banner");
  await expect(refusal).toBeVisible();
  const customerText = await refusal.textContent();
  await expect(page).toHaveURL(/\/admin\/login$/);

  await signInWithPassword(page, accounts!.admin.email, "not-the-password");
  await expect(refusal).toHaveText(customerText ?? "");

  // The refused customer was signed out again: the dashboard still sends them to sign in.
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("after the password alone the dashboard stays shut until a correct code", async ({ page }) => {
  await page.goto("/admin/login");
  await signInWithPassword(page, accounts!.admin.email, accounts!.password);
  await expect(page).toHaveURL(/\/admin\/mfa$/);
  await checkA11y(page);

  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/mfa\?next=%2Fadmin%2Forders$/);

  await page.getByLabel("الرمز من التطبيق").fill("000000");
  await page.getByTestId("admin-totp-submit").click();
  await expect(page.locator("#admin-totp-banner")).toBeVisible();
  await expect(page.getByLabel("الرمز من التطبيق")).toBeFocused();

  // A fresh page, so the helper reads only the outcome of the next code.
  await page.reload();

  await enterCode(page, accounts!.admin.secret, /\/admin\/orders$/);
});

test("a correct code goes to the page asked for, and sign out ends the session", async ({
  page,
}) => {
  await signInAdmin(page, accounts!, "/admin/products/new");
  await expect(page).toHaveURL(/\/admin\/products\/new$/);

  await page.getByTestId("admin-sign-out").click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login\?next=/);
});

test("an unsafe next falls back to the orders list", async ({ page }) => {
  await signInAdmin(page, accounts!, "//evil.com");
  await expect(page).toHaveURL(/\/admin\/orders$/);
});

test("setup shows a QR code and key, makes one factor however often it restarts, and the reset script removes it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin/login");
  await signInWithPassword(page, accounts!.enrollEmail, accounts!.password);
  await expect(page).toHaveURL(/\/admin\/mfa$/);

  // Start and reload three times before finishing: each start replaces the unverified factor.
  for (let i = 0; i < 3; i += 1) {
    await page.getByTestId("admin-enroll-start").click();
    await expect(page.getByTestId("totp-secret")).toBeVisible();
    await page.reload();
  }
  await page.getByTestId("admin-enroll-start").click();
  await expect(page.getByRole("img", { name: /QR/ })).toBeVisible();
  await checkA11y(page);
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await enterCode(page, secret, /\/admin\/orders$/);

  const supabase = serviceClient();
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((candidate) => candidate.email === accounts!.enrollEmail)!;
  const factors = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
  expect(factors.data?.factors.map((factor) => factor.status)).toEqual(["verified"]);

  // `pnpm admin:mfa-reset` removes the factor and signs the owner out everywhere.
  execSync(`pnpm admin:mfa-reset ${accounts!.enrollEmail}`, { stdio: "pipe" });
  const after = await supabase.auth.admin.mfa.listFactors({ userId: user.id });
  expect(after.data?.factors).toEqual([]);
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
});
