import {
  expect as baseExpect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  createCustomer,
  fillCart,
  removeTestAccounts,
  resetLinkFor,
  sellableVariant,
  signInCustomer,
  uniqueEmail,
} from "./accounts";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";
import { uniquePhone } from "./orders";

// covers: AC-1 to AC-18 (spec 0017). Customer accounts on a phone sized (390) and a computer sized
// (1280) right to left screen: register, sign out and in, a taken email, a reset through the local
// mail catcher, a password change, and a signed in checkout whose order follows the account to its
// page and its cancel, while another account still gets the lookup. WhatsApp is never reached.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

const NAME = "سارة يوسف";
const PASSWORD = "first pass 123";
const NEW_PASSWORD = "second pass 456";
let logged: string[] = [];
let personal: RegExp = /$^/;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
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
  // AC-17: nothing the customer typed reaches the browser console either.
  expect(logged.filter((text) => personal.test(text))).toEqual([]);
});

test.afterAll(async () => {
  if (!accounts) return;
  await removeTestAccounts(sql);
  await sql.end();
});

async function checkA11y(page: Page, testInfo: TestInfo) {
  await expectNoAxeViolations(page);
  if (testInfo.project.name === "phone") {
    await expectTouchTargets(page);
    await expectNoSidewaysScroll(page);
  }
}

const heading = (page: Page) => page.getByTestId("sign-in-heading");

async function newContext(browser: Browser, testInfo: TestInfo) {
  const context = await browser.newContext(testInfo.project.use);
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "" }),
  );
  return context;
}

test("a visitor registers, lands on the account page, signs out, and signs back in", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail("register");
  const phone = uniquePhone();
  personal = new RegExp([email, phone.local, NAME, PASSWORD].join("|"));

  // AC-9, AC-1: a signed out visitor is sent to sign in, which opens on the login form.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/sign-in\?next=%2Faccount$/);
  await expect(heading(page)).toHaveText("تسجيل الدخول");
  await expect(page.getByTestId("tab-login")).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByTestId("guest-card").getByRole("link", { name: "المتابعة كضيف" }),
  ).toHaveAttribute("href", "/cart");
  await expect(
    page.getByTestId("guest-card").getByRole("link", { name: "تتبّع طلب" }),
  ).toHaveAttribute("href", "/orders/track");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await checkA11y(page, testInfo);

  // AC-1: the tab switches in place and rewrites ?tab with no navigation.
  await page.getByTestId("tab-register").click();
  await expect(heading(page)).toHaveText("إنشاء حساب");
  await expect(page).toHaveURL(/\/account\/sign-in\?tab=register&next=%2Faccount$/);
  await expect(page.getByTestId("tab-register")).toHaveAttribute("aria-pressed", "true");
  await checkA11y(page, testInfo);

  // AC-3: refused fields keep what was typed, except the password, and focus the first error.
  await page.getByLabel("الاسم الكامل").fill("سارة");
  await page.getByLabel("رقم الهاتف").fill(phone.local);
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("short");
  await page.getByTestId("register-submit").click();
  await expect(page.getByLabel("الاسم الكامل")).toBeFocused();
  await expect(page.locator("#register-name-error")).toHaveAttribute("role", "alert");
  await expect(page.locator("#register-password-error")).toContainText("الحد الأدنى");
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveValue(email);
  await expect(page.getByLabel("كلمة المرور")).toHaveValue("");

  // AC-2: a valid submit signs the visitor in and goes to next (/account).
  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("كلمة المرور").fill(PASSWORD);
  await page.getByTestId("register-submit").click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("حسابي");
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveValue(email);
  await expect(page.getByLabel("الاسم الكامل")).toHaveValue(NAME);
  await expect(page.getByLabel("رقم الهاتف")).toHaveValue(phone.local);
  await expect(page.getByTestId("phone-missing")).toHaveCount(0);
  await checkA11y(page, testInfo);

  // AC-4: the new account is a customer, and the dashboard stays closed to it.
  const [profile] = await sql<{ role: string; phone_e164: string }[]>`
    select p.role, p.phone_e164 from profiles p join auth.users u on u.id = p.id
    where u.email = ${email}`;
  expect(profile).toEqual({ role: "customer", phone_e164: `+970${phone.national}` });
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);

  // AC-9: the profile form saves a new name.
  await page.goto("/account");
  await page.getByLabel("الاسم الكامل").fill("سارة محمود");
  await page.getByTestId("profile-submit").click();
  await expect(page.getByTestId("profile-saved")).toHaveText("تم حفظ بياناتك.");
  await page.reload();
  await expect(page.getByLabel("الاسم الكامل")).toHaveValue("سارة محمود");

  // AC-11: sign out goes home and ends the session in this browser.
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/sign-in/);

  // AC-5: a wrong password and the right one.
  await signInCustomer(page, email, "not the password");
  const banner = page.getByTestId("login-banner");
  await expect(banner).toHaveText("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
  await expect(banner).toBeFocused();
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveValue(email);
  await expect(page.getByLabel("كلمة المرور")).toHaveValue("");
  await page.getByLabel("كلمة المرور").fill(PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });

  // AC-1: already signed in, the sign in page moves on to next.
  await page.goto("/account/sign-in?next=%2Fcart");
  await expect(page).toHaveURL(/\/cart$/);
});

test("a taken email offers sign in and reset with the email carried over", async ({
  page,
}, testInfo) => {
  const email = uniqueEmail("taken");
  personal = new RegExp([email, PASSWORD].join("|"));
  await createCustomer(sql, { email, password: PASSWORD, name: NAME });

  await page.goto("/account/sign-in?tab=register");
  await expect(heading(page)).toHaveText("إنشاء حساب");
  await page.getByLabel("الاسم الكامل").fill(NAME);
  await page.getByLabel("رقم الهاتف").fill(uniquePhone().local);
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور").fill("another pass 789");
  await page.getByTestId("register-submit").click();

  // AC-3: the box takes focus and offers the other two forms.
  const banner = page.getByTestId("register-banner");
  await expect(banner).toContainText("هذا البريد مسجّل مسبقاً.");
  await expect(banner).toBeFocused();
  await checkA11y(page, testInfo);

  await banner.getByRole("button", { name: "تسجيل الدخول" }).click();
  await expect(heading(page)).toHaveText("تسجيل الدخول");
  await expect(heading(page)).toBeFocused();
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveValue(email);
  expect(page.url()).not.toContain("skf.test");

  // AC-6: an unsafe next lands on the account page.
  await page.goto(`/account/sign-in?next=${encodeURIComponent("//evil.example")}`);
  await signInCustomer(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
});

test("a forgotten password is reset through the emailed link", async ({ page }, testInfo) => {
  const email = uniqueEmail("reset");
  personal = new RegExp([email, PASSWORD, NEW_PASSWORD].join("|"));
  await createCustomer(sql, { email, password: PASSWORD, name: NAME });

  // AC-7: the reset form from "نسيت كلمة المرور؟", with no tabs.
  await page.goto("/account/sign-in");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByTestId("login-forgot").click();
  await expect(heading(page)).toHaveText("استعادة كلمة المرور");
  await expect(page).toHaveURL(/\/account\/sign-in\?tab=reset$/);
  await expect(page.getByTestId("tab-login")).toHaveCount(0);
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveValue(email);
  await checkA11y(page, testInfo);
  await page.getByTestId("reset-submit").click();
  await expect(page.getByTestId("reset-sent")).toHaveText("أرسلنا رابط الاستعادة إلى بريدك.");

  // An email with no account gets the same answer.
  await page.getByLabel("البريد الإلكتروني").fill(uniqueEmail("nobody"));
  await page.getByTestId("reset-submit").click();
  await expect(page.getByTestId("reset-sent")).toBeVisible();

  // AC-8: opening the link uses nothing up; "متابعة" does.
  const link = await resetLinkFor(email);
  expect(link).toMatch(/\/auth\/confirm\?token_hash=[^&]+&type=recovery$/);
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("استعادة كلمة المرور");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await checkA11y(page, testInfo);
  await page.reload();
  await page.getByTestId("confirm-recovery").click();
  await expect(page).toHaveURL(/\/account\/reset-password$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("كلمة مرور جديدة");
  await checkA11y(page, testInfo);

  await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("تأكيد كلمة المرور الجديدة").fill("does not match");
  await page.getByTestId("set-password-submit").click();
  await expect(page.locator("#set-password-confirm-error")).toHaveText(
    "كلمتا المرور غير متطابقتين.",
  );
  await expect(page.getByLabel("تأكيد كلمة المرور الجديدة")).toBeFocused();

  await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("تأكيد كلمة المرور الجديدة").fill(NEW_PASSWORD);
  await page.getByTestId("set-password-submit").click();
  await expect(page).toHaveURL(/\/account\?notice=password_set$/, { timeout: 30_000 });
  await expect(page.getByTestId("password-set")).toHaveText("تم تعيين كلمة المرور الجديدة.");

  // The link is used: opening it again lands on the expired message, until a new send.
  await page.goto(link);
  await page.getByTestId("confirm-recovery").click();
  await expect(page).toHaveURL(/\/account\/sign-in\?tab=reset&error=link_expired$/);
  // Still signed in from the reset, so the page moves on; sign out and look again.
  await page.goto("/account");
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account/sign-in?tab=reset&error=link_expired");
  await expect(page.getByTestId("reset-expired")).toHaveText(
    "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطاً جديداً.",
  );
  await checkA11y(page, testInfo);

  // The new password signs in; the old one no longer does.
  await page.goto("/account/sign-in");
  await signInCustomer(page, email, PASSWORD);
  await expect(page.getByTestId("login-banner")).toBeVisible();
  await page.getByLabel("كلمة المرور").fill(NEW_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
});

test("a signed in customer changes their password", async ({ page }, testInfo) => {
  const email = uniqueEmail("change");
  personal = new RegExp([email, PASSWORD, NEW_PASSWORD].join("|"));
  await createCustomer(sql, { email, password: PASSWORD, name: NAME });

  await page.goto("/account/sign-in?next=%2Faccount");
  await signInCustomer(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
  // AC-9: no phone on the profile yet.
  await expect(page.getByTestId("phone-missing")).toContainText("أضف رقم هاتفك");

  const current = page.getByLabel("كلمة المرور الحالية");
  const fresh = page.getByLabel("كلمة المرور الجديدة", { exact: true });
  const confirm = page.getByLabel("تأكيد كلمة المرور الجديدة");

  // AC-10: a wrong current password, under its field.
  await current.fill("wrong current pass");
  await fresh.fill(NEW_PASSWORD);
  await confirm.fill(NEW_PASSWORD);
  await page.getByTestId("change-password-submit").click();
  await expect(page.locator("#change-password-current-error")).toHaveText(
    "كلمة المرور الحالية غير صحيحة.",
  );
  await expect(current).toBeFocused();
  await expect(fresh).toHaveValue("");

  await current.fill(PASSWORD);
  await fresh.fill(NEW_PASSWORD);
  await confirm.fill(NEW_PASSWORD);
  await page.getByTestId("change-password-submit").click();
  await expect(page.getByTestId("change-password-done")).toHaveText("تم تغيير كلمة المرور.");
  await expect(current).toHaveValue("");
  await checkA11y(page, testInfo);

  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/account/sign-in");
  await signInCustomer(page, email, NEW_PASSWORD);
  await expect(page).toHaveURL(/\/account$/, { timeout: 30_000 });
});

test("a signed in order follows the account to its page and its cancel", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(300_000);
  const email = uniqueEmail("owner");
  const otherEmail = uniqueEmail("other");
  const phone = uniquePhone();
  personal = new RegExp([email, otherEmail, phone.local, NAME, PASSWORD].join("|"));
  const userId = await createCustomer(sql, {
    email,
    password: PASSWORD,
    name: NAME,
    phone: phone.local,
  });
  await createCustomer(sql, { email: otherEmail, password: PASSWORD, name: "علي حسن" });
  const baseURL = testInfo.project.use.baseURL!;

  // AC-13: signed in, checkout starts with the profile's name and phone.
  await fillCart(page, baseURL, await sellableVariant(sql));
  await page.goto("/account/sign-in?next=%2Fcheckout");
  await signInCustomer(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/checkout$/, { timeout: 30_000 });
  await expect(page.getByLabel("الاسم الكامل")).toHaveValue(NAME);
  await expect(page.getByLabel("رقم الهاتف")).toHaveValue(phone.local);
  await page.getByTestId("place-order").click();
  await page.waitForURL(/^https:\/\/wa\.me\//, { timeout: 30_000 });
  const [order] = await sql<
    { order_number: string; placed_by_role: string; actor_kind: string; actor_user_id: string }[]
  >`
    select o.order_number, o.placed_by_role, e.actor_kind, e.actor_user_id
    from orders o join order_events e on e.order_id = o.id and e.type = 'created'
    where o.placed_by_user_id = ${userId}`;
  expect(order).toMatchObject({
    placed_by_role: "customer",
    actor_kind: "customer",
    actor_user_id: userId,
  });
  const number = order.order_number;

  // The owner sees it as a customer (عميل) order in the dashboard.
  const ownerContext = await newContext(browser, testInfo);
  const owner = await ownerContext.newPage();
  await signInAdmin(owner, accounts!, "/admin/orders");
  const row = owner.getByTestId(`order-row-${number}`);
  await expect(row).toContainText("عميل");
  await expect(row).toContainText(NAME);
  await ownerContext.close();

  // AC-14: a new browser signed in to the same account opens the page with no cookie or lookup.
  const sameContext = await newContext(browser, testInfo);
  const same = await sameContext.newPage();
  await usePhoneWidth(same, testInfo);
  await same.goto("/account/sign-in");
  await signInCustomer(same, email, PASSWORD);
  await expect(same).toHaveURL(/\/account$/, { timeout: 30_000 });
  await same.goto(`/orders/${number}`);
  await expect(same).toHaveURL(`${baseURL}/orders/${number}`);
  await expect(same.getByTestId("order-heading")).toHaveText(`طلب ${number}`);
  expect((await sameContext.cookies()).map((cookie) => cookie.name)).not.toContain("skf_tracked");

  // AC-15: the owner cancels it there.
  await same.getByTestId("customer-cancel").click();
  await same.getByTestId("customer-cancel-confirm").click();
  await same.waitForURL(/^https:\/\/wa\.me\//);
  const [cancelled] = await sql<{ status: string; cancelled_by: string }[]>`
    select status, cancelled_by from orders where order_number = ${number}`;
  expect(cancelled).toEqual({ status: "cancelled", cancelled_by: "guest" });
  await sameContext.close();

  // Another signed in account lands on the lookup with the number filled.
  const otherContext = await newContext(browser, testInfo);
  const other = await otherContext.newPage();
  await other.goto("/account/sign-in");
  await signInCustomer(other, otherEmail, PASSWORD);
  await expect(other).toHaveURL(/\/account$/, { timeout: 30_000 });
  await other.goto(`/orders/${number}`);
  await expect(other).toHaveURL(`${baseURL}/orders/track?number=${number}`);
  await otherContext.close();
});
