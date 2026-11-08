import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { buildSearchText } from "../src/features/catalog/search-text";
import { createCustomer, removeTestAccounts, signInCustomer, uniqueEmail } from "./accounts";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-4, AC-6 to AC-13, AC-15, AC-16, AC-18, AC-20 (spec 0020). Quick order on a
// phone sized (390) and a computer sized (1280) right to left screen, as an electrician: name a
// draft, find a product by its code, set the quantity, fill the customer, pick up, and send to
// the W5 page; build 30 lines and send with delivery; a duplicate, remove and undo; the drafts
// list; a switch to customer and back; and the redirects for a customer and a signed out
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

/**
 * A sellable product with exactly one option, so choosing it settles the line. Only the dev seed's
 * (`DEMO-`) and this spec's own (`QO-`): other specs insert products without search keys, run
 * alongside, and leave some behind when a cleanup fails, so the search would never find them.
 */
async function singleOptionProduct() {
  const [row] = await sql<{ code: string; name: string; price: number }[]>`
    select p.code, p.name, min(v.price)::int as price from products p
    join product_variants v on v.product_id = p.id and v.archived_at is null
    join categories c on c.id = p.category_id
    left join categories m on m.id = c.parent_id
    where p.status = 'active' and p.is_available and c.is_visible and coalesce(m.is_visible, true)
      and (p.code like 'DEMO-%' or p.code like 'QO-%')
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
  // The pathname: the sign in page's own `?next=/account` already ends in "/account".
  await page.waitForURL((url) => url.pathname === "/account");
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

  // AC-5: the name autosaves from the draft page.
  await card.getByTestId("open-draft").click();
  await expect(page.getByTestId("draft-name")).toHaveValue("site b");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("draft-name").fill("site c");
  await page.getByTestId("draft-name").blur();
  await expect(saveStatus(page)).toHaveText("تم الحفظ");
  await page.getByText("فتح مسودة").click();
  await expect(card).toContainText("site c");

  await page.getByRole("button", { name: "حذف المسودة site c" }).click();
  await expect(page.getByTestId("delete-draft-dialog")).toContainText("حذف المسودة «site c»؟");
  await checkA11y(page, testInfo);
  await page.getByTestId("delete-draft-confirm").click();
  await expect(page.getByTestId("draft-deleted")).toHaveText("تم حذف المسودة.");
  await expect(page.getByTestId("draft-card")).toHaveCount(0);
});

const findSingleOption = (count: number) =>
  sql<{ code: string; name: string }[]>`
    select p.code, p.name from products p
    join product_variants v on v.product_id = p.id and v.archived_at is null
    join categories c on c.id = p.category_id
    left join categories m on m.id = c.parent_id
    where p.status = 'active' and p.is_available and c.is_visible and coalesce(m.is_visible, true)
      and (p.code like 'DEMO-%' or p.code like 'QO-%')
    group by p.id having count(*) = 1 and bool_and(v.is_available)
    order by p.code limit ${count}`;

/**
 * `count` sellable products with exactly one option each, so choosing one settles its line. The dev
 * seed holds one (spec 0002 AC-12), so a fresh database gets the rest here, in their own category.
 */
async function singleOptionProducts(count: number) {
  const found = await findSingleOption(count);
  const missing = count - found.length;
  if (missing > 0) {
    const tag = Date.now().toString(36).toUpperCase();
    const [category] = await sql<{ id: string }[]>`
      insert into categories (name, slug) values (${`طلب سريع ${tag}`}, ${`qo-${tag.toLowerCase()}`})
      returning id`;
    for (let i = 0; i < missing; i++) {
      const code = `QO-${tag}-${String(i).padStart(2, "0")}`;
      const name = `سبوت سقف ${tag} ${i}`;
      const [product] = await sql<{ id: string }[]>`
        insert into products (category_id, code, name, slug, search_text)
        values (${category.id}, ${code}, ${name}, ${code.toLowerCase()}, ${buildSearchText(name, code, [])})
        returning id`;
      await sql`
        insert into product_variants (product_id, price, is_default, sort)
        values (${product.id}, ${2_000 + i * 100}, true, 0)`;
    }
  }
  return missing > 0 ? findSingleOption(count) : found;
}

async function newDraftNamed(page: Page, name: string) {
  await page.goto("/account/quick-order");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("draft-name").fill(name);
  await page.getByTestId("draft-name").press("Enter");
  await expect(page).toHaveURL(/\/account\/quick-order\?draft=/);
  await page.waitForLoadState("networkidle");
}

const lineAt = (page: Page, index: number) => page.getByTestId("quick-order-line").nth(index);

/** Finds the product by its code on that line, picks it, and sets the quantity. */
async function fillLine(page: Page, index: number, code: string, quantity: string) {
  const line = lineAt(page, index);
  const field = line.getByLabel("الكود أو اسم المنتج");
  await expect(field).toBeEnabled();
  await field.fill(code);
  await page.getByTestId("quick-order-suggestion").first().click();
  await line.getByTestId("line-quantity").fill(quantity);
  await line.getByTestId("line-quantity").press("Enter");
}

test("an electrician builds 30 lines, is held at 30 and by an empty quantity, and sends with delivery", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  const chosen = await singleOptionProducts(30);
  const userId = await signInAs(page, "electrician");
  await newDraftNamed(page, `thirty ${testInfo.project.name}`);

  // AC-9: thirty lines by search, no product page opened.
  for (const [index, product] of chosen.entries()) {
    if (index > 0) {
      await page.getByTestId("add-line").click();
      await expect(page.getByTestId("quick-order-line")).toHaveCount(index + 1);
    }
    await fillLine(page, index, product.code, String(index + 1));
  }
  await expect(page.getByTestId("line-counter")).toHaveText("30 / 30");
  await expect(page.getByTestId("add-line")).toBeDisabled();
  await expect(saveStatus(page)).toHaveText("تم الحفظ");
  expect(page.url()).toContain("/account/quick-order");

  // AC-8, AC-13: an empty quantity blocks sending and takes the focus.
  const fifth = lineAt(page, 4).getByTestId("line-quantity");
  await fifth.fill("");
  await fifth.press("Enter");
  await expect(page.getByTestId("draft-excluded")).toContainText("سطر واحد");

  // AC-10: the customer card with delivery.
  const customer = page.getByTestId("customer-card");
  await page.getByTestId("fill-mine").click();
  await customer.getByText("توصيل", { exact: true }).click();
  await page.getByLabel("المنطقة").selectOption({ index: 1 });
  await page.getByLabel("المدينة أو البلدة").fill("رام الله");
  await page.getByLabel("العنوان بالتفصيل").fill("شارع الإرسال، عمارة 4");
  await page.getByTestId("send-draft").click();
  await expect(lineAt(page, 4).getByText("أدخل الكمية لهذا السطر.")).toBeVisible();
  await expect(fifth).toBeFocused();
  await expect(fifth).toHaveAttribute("aria-invalid", "true");
  expect(await sql`select 1 from orders where placed_by_user_id = ${userId}`).toHaveLength(0);

  await fifth.fill("5");
  await fifth.press("Enter");
  await expect(saveStatus(page)).toHaveText("تم الحفظ");

  // AC-12: everything is kept on the server.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("line-counter")).toHaveText("30 / 30");
  await expect(fifth).toHaveValue("5");
  await expect(page.getByLabel("المدينة أو البلدة")).toHaveValue("رام الله");

  await page.getByTestId("send-draft").click();
  await page.waitForURL(/^https:\/\/wa\.me\//, { timeout: 30_000 });
  const text = new URL(page.url()).searchParams.get("text") ?? "";
  expect(text.split("\n")[1]).toBe("الكهربائي: سامي حداد");

  // AC-13: thirty lines in draft order, from a delivery order typed electrician.
  const [order] = await sql<{ id: string; order_number: string; placed_by_role: string }[]>`
    select id, order_number, placed_by_role from orders
    where placed_by_user_id = ${userId} and fulfilment = 'delivery'`;
  expect(order.placed_by_role).toBe("electrician");
  const lines = await sql<{ product_code: string; quantity: number }[]>`
    select product_code, quantity from order_lines where order_id = ${order.id} order by sort`;
  expect(lines.map((line) => line.product_code)).toEqual(chosen.map((product) => product.code));
  expect(lines.map((line) => line.quantity)).toEqual(chosen.map((_, i) => i + 1));

  // The order is in My Orders like any other.
  await page.goto("/account/orders");
  await expect(page.getByTestId("my-orders")).toContainText(order.order_number);
});

test("a line refuses a duplicate option, and a removed line comes back on undo", async ({
  page,
}, testInfo) => {
  const [first, second] = await singleOptionProducts(2);
  await signInAs(page, "electrician");
  await newDraftNamed(page, `lines ${testInfo.project.name}`);

  await fillLine(page, 0, first.code, "2");
  await page.getByTestId("add-line").click();
  await expect(page.getByTestId("quick-order-line")).toHaveCount(2);

  // AC-7, AC-21: with the list open, axe checks the line's input and the list only (Base UI hides
  // the page behind); the page itself is checked with the list closed.
  const field = lineAt(page, 1).getByLabel("الكود أو اسم المنتج");
  await expect(field).toBeEnabled();
  await field.fill(first.code);
  await expect(page.getByTestId("quick-order-suggestion").first()).toBeVisible();
  const fieldId = await field.getAttribute("id");
  await expectNoAxeViolations(page, [`[id="${fieldId}"]`, "[data-slot=combobox-content]"]);
  await field.press("Escape");
  await expect(page.getByTestId("quick-order-suggestion")).toHaveCount(0);
  await checkA11y(page, testInfo);
  await field.fill("");
  await field.fill(first.code);
  await expect(page.getByTestId("quick-order-suggestion").first()).toBeVisible();

  // AC-8: the same option on a second line is refused, with a way to the first.
  await page.getByTestId("quick-order-suggestion").first().click();
  const duplicate = lineAt(page, 1).getByTestId("line-duplicate");
  await expect(duplicate).toContainText("هذا الخيار موجود في السطر 1");
  await duplicate.getByRole("button", { name: "انتقل إلى السطر 1" }).click();
  await expect(lineAt(page, 0).getByTestId("line-quantity")).toBeFocused();

  await fillLine(page, 1, second.code, "4");
  await expect(saveStatus(page)).toHaveText("تم الحفظ");

  // AC-9: remove the first line, then undo it back into its place.
  await page.getByRole("button", { name: "حذف السطر 1" }).click();
  await expect(page.getByTestId("quick-order-line")).toHaveCount(1);
  await expect(page.getByTestId("line-removed")).toContainText("تم حذف السطر 1");
  await page.getByTestId("undo-remove").click();
  await expect(page.getByTestId("quick-order-line")).toHaveCount(2);
  await expect(lineAt(page, 0).getByLabel("الكود أو اسم المنتج")).toHaveValue(first.name);
  await expect(lineAt(page, 0).getByTestId("line-quantity")).toHaveValue("2");
  await expect(saveStatus(page)).toHaveText("تم الحفظ");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(lineAt(page, 0).getByLabel("الكود أو اسم المنتج")).toHaveValue(first.name);
  await expect(lineAt(page, 1).getByLabel("الكود أو اسم المنتج")).toHaveValue(second.name);
});

test("a save made offline waits, blocks sending, and lands when back online", async ({
  page,
}, testInfo) => {
  const [product] = await singleOptionProducts(1);
  await signInAs(page, "electrician");
  await newDraftNamed(page, `offline ${testInfo.project.name}`);
  await fillLine(page, 0, product.code, "2");
  await expect(saveStatus(page)).toHaveText("تم الحفظ");

  // AC-12: the value stays on the page, the status says so, and sending waits for it.
  const quantity = page.getByTestId("line-quantity");
  await page.context().setOffline(true);
  await quantity.fill("7");
  await quantity.press("Enter");
  await expect(saveStatus(page)).toContainText("تعذّر الحفظ");
  await expect(page.getByTestId("save-retry")).toBeVisible();
  await expect(quantity).toHaveValue("7");
  await page.getByTestId("send-draft").click();
  await expect(page.getByTestId("send-notice")).toHaveText("احفظ التغييرات أولاً.");

  await page.context().setOffline(false);
  await expect(saveStatus(page)).toHaveText("تم الحفظ");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(quantity).toHaveValue("7");
});

test("drafts wait out a switch to customer and come back with the role", async ({ page }) => {
  const userId = await signInAs(page, "electrician");
  await sql`insert into drafts (owner_user_id, name) values (${userId}, 'kept draft')`;

  // AC-18: while a customer, the drafts are out of reach but not deleted.
  await sql`update profiles set role = 'customer' where id = ${userId}`;
  await page.goto("/account/drafts");
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId("electrician-tools")).toHaveCount(0);

  await sql`update profiles set role = 'electrician' where id = ${userId}`;
  await page.goto("/account/drafts");
  await expect(page.getByTestId("draft-card")).toContainText("kept draft");
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
