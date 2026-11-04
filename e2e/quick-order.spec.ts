import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { createCustomer, removeTestAccounts, signInCustomer, uniqueEmail } from "./accounts";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-10, AC-13, AC-15 (spec 0020). Quick order
// on a phone sized (390) and a computer sized (1280) right to left screen, as an electrician:
// name a draft, find a product by its code, set the quantity, fill the customer, pick up, and
// send to the W5 page; the drafts list; and the redirects for a customer and a signed out
// visitor. WhatsApp is never reached.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

const PASSWORD = "quick order 123";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(180_000);
  await page
    .context()
    .route("https://wa.me/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "" }),
    );
  await usePhoneWidth(page, testInfo);
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

/** A sellable product with exactly one option, so choosing it settles the line. */
async function singleOptionProduct() {
  const [row] = await sql<{ code: string; name: string; price: number }[]>`
    select p.code, p.name, min(v.price)::int as price from products p
    join product_variants v on v.product_id = p.id and v.archived_at is null
    join categories c on c.id = p.category_id
    left join categories m on m.id = c.parent_id
    where p.status = 'active' and p.is_available and c.is_visible and coalesce(m.is_visible, true)
    group by p.id having count(*) = 1 and bool_and(v.is_available)
    order by p.code limit 1`;
  if (!row) throw new Error("No single option product: run pnpm db:seed first");
  return row;
}

async function signInAs(page: Page, role: "electrician" | "customer") {
  const email = uniqueEmail(`qo-${role}`);
  const id = await createCustomer(sql, {
    email,
    password: PASSWORD,
    name: "سامي حداد",
    phone: "0599111222",
  });
  if (role === "electrician") await sql`update profiles set role = 'electrician' where id = ${id}`;
  await page.goto("/account/sign-in?next=/account");
  await page.waitForLoadState("networkidle");
  await signInCustomer(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/account$/);
  return id;
}

const saveStatus = (page: Page) => page.getByTestId("save-status");

test("an electrician builds a draft and sends it to the W5 page", async ({ page }, testInfo) => {
  const product = await singleOptionProduct();
  const userId = await signInAs(page, "electrician");

  await page.getByTestId("quick-order-link").click();
  await expect(page).toHaveURL(/\/account\/quick-order$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("draft-name")).toBeFocused();
  await checkA11y(page, testInfo);

  // A name that is too short is refused under the field.
  await page.getByTestId("draft-name").fill("a");
  await page.getByTestId("draft-name").press("Enter");
  await expect(page.getByText("اكتب اسماً من حرفين على الأقل.")).toBeVisible();

  await page.getByTestId("draft-name").fill(`ali / mo ${testInfo.project.name}`);
  await page.getByTestId("draft-name").press("Enter");
  await expect(page).toHaveURL(/\/account\/quick-order\?draft=/);
  await expect(page.getByTestId("quick-order-line")).toHaveCount(1);
  // Typed before hydration, the code would never reach the combobox.
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("line-counter")).toHaveText("1 / 30");

  // Find the product by its code; one option settles the line.
  await page.getByLabel("الكود أو اسم المنتج").fill(product.code);
  await page.getByTestId("quick-order-suggestion").first().click();
  await expect(page.getByLabel("الكود أو اسم المنتج")).toHaveValue(product.name);
  await page.getByTestId("line-quantity").fill("٣");
  await page.getByTestId("line-quantity").press("Enter");
  await expect(page.getByTestId("line-quantity")).toHaveValue("3");
  await expect(page.getByTestId("line-total")).not.toHaveText("—");

  // Sending with no customer marks the fields, nothing is sent.
  await page.getByTestId("send-draft").click();
  await expect(page.getByLabel("الاسم الكامل")).toHaveAttribute("aria-invalid", "true");

  await page.getByTestId("fill-mine").click();
  await expect(page.getByLabel("الاسم الكامل")).toHaveValue("سامي حداد");
  await page.getByText("استلام من المعرض").click();
  await expect(saveStatus(page)).toHaveText("تم الحفظ");
  await checkA11y(page, testInfo);

  // Everything is kept on the server.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("الكود أو اسم المنتج")).toHaveValue(product.name);
  await expect(page.getByTestId("line-quantity")).toHaveValue("3");
  await expect(page.getByLabel("الاسم الكامل")).toHaveValue("سامي حداد");

  // AC-13, AC-16: the W5 page hands off to WhatsApp, naming the electrician.
  await page.getByTestId("send-draft").click();
  await page.waitForURL(/^https:\/\/wa\.me\//, { timeout: 30_000 });
  const text = new URL(page.url()).searchParams.get("text") ?? "";
  expect(text.split("\n")[1]).toBe("الكهربائي: سامي حداد");

  const [order] = await sql<{ id: string; placed_by_role: string; fulfilment: string }[]>`
    select id, placed_by_role, fulfilment from orders where placed_by_user_id = ${userId}`;
  expect(order).toMatchObject({ placed_by_role: "electrician", fulfilment: "pickup" });
  const lines = await sql<{ quantity: number }[]>`
    select quantity from order_lines where order_id = ${order.id}`;
  expect(lines.map((l) => l.quantity)).toEqual([3]);
  const left = await sql`select 1 from drafts where owner_user_id = ${userId}`;
  expect(left).toHaveLength(0);
});

test("the drafts list opens and deletes a draft", async ({ page }, testInfo) => {
  await signInAs(page, "electrician");
  await page.getByTestId("drafts-link").click();
  await expect(page).toHaveURL(/\/account\/drafts$/);
  await expect(page.getByText("لا توجد مسودات")).toBeVisible();
  await checkA11y(page, testInfo);

  await page.getByTestId("new-draft").click();
  await page.getByTestId("draft-name").fill("site b");
  await page.getByTestId("draft-name").press("Enter");
  await expect(page).toHaveURL(/\?draft=/);

  await page.getByText("فتح مسودة").click();
  const card = page.getByTestId("draft-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("site b");
  await expect(card).toContainText("سطر واحد");
  await checkA11y(page, testInfo);

  await card.getByTestId("open-draft").click();
  await expect(page.getByTestId("draft-name")).toHaveValue("site b");
  await page.goBack();

  await page.getByRole("button", { name: "حذف المسودة site b" }).click();
  await expect(page.getByTestId("delete-draft-dialog")).toContainText("حذف المسودة «site b»؟");
  await checkA11y(page, testInfo);
  await page.getByTestId("delete-draft-confirm").click();
  await expect(page.getByTestId("draft-deleted")).toHaveText("تم حذف المسودة.");
  await expect(page.getByTestId("draft-card")).toHaveCount(0);
});

test("a customer and a signed out visitor never reach quick order", async ({ page }) => {
  await page.goto("/account/quick-order");
  await expect(page).toHaveURL(/\/account\/sign-in\?next=%2Faccount%2Fquick-order/);

  await signInAs(page, "customer");
  await expect(page.getByTestId("electrician-tools")).toHaveCount(0);
  await page.goto("/account/drafts");
  await expect(page).toHaveURL(/\/account$/);
  const response = await page.request.get("/api/quick-order/products?q=test");
  expect(response.status()).toBe(403);
});
