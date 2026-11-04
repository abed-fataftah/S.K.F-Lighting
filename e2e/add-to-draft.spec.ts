import { expect as baseExpect, test, type Page, type TestInfo } from "@playwright/test";
import { createCustomer, removeTestAccounts, signInCustomer, uniqueEmail } from "./accounts";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-3, AC-5 to AC-11, AC-14, AC-15 (spec 0021). Add to draft from the catalog on
// a phone sized (390) and a computer sized (1280) right to left screen, as an electrician: from a
// search card into an existing draft and open it; from the product page with its option and
// quantity prefilled, again to merge, then past 999; with no drafts, name one in the sheet. A
// customer, the owner, and a signed out visitor see no button. axe runs on a category page with
// the card buttons and on the open sheet.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();
const sql = accounts ? localSql() : (null as never);

const PASSWORD = "add to draft 123";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start) and the dev seed");
  test.setTimeout(120_000);
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

type SizedProduct = {
  readonly slug: string;
  readonly code: string;
  readonly name: string;
  readonly variantId: string;
  readonly size: string;
  readonly colour: string | null;
  readonly hasColours: boolean;
  readonly categoryPath: string;
};

/** A listed product with sizes and 2 to 40 live options, and one of its sellable options. */
async function sizedProduct(): Promise<SizedProduct> {
  const [row] = await sql<
    {
      slug: string;
      code: string;
      name: string;
      variant_id: string;
      size_label: string;
      colour: string | null;
      has_colours: boolean;
      main_slug: string;
    }[]
  >`
    select p.slug, p.code, p.name, v.id as variant_id, v.size_label, k.name as colour,
      exists (select 1 from product_variants x where x.product_id = p.id
        and x.archived_at is null and x.colour_id is not null) as has_colours,
      coalesce(m.slug, c.slug) as main_slug
    from products p
    join categories c on c.id = p.category_id
    left join categories m on m.id = c.parent_id
    join product_variants v on v.product_id = p.id and v.archived_at is null and v.is_available
    left join colours k on k.id = v.colour_id
    where p.status = 'active' and p.is_available and c.is_visible and coalesce(m.is_visible, true)
      and v.size_label is not null
      and (select count(*) from product_variants x
        where x.product_id = p.id and x.archived_at is null) between 2 and 40
    order by p.code, v.sort, v.id limit 1`;
  if (!row) throw new Error("No sized product: run pnpm db:seed first");
  return {
    slug: row.slug,
    code: row.code,
    name: row.name,
    variantId: row.variant_id,
    size: row.size_label,
    colour: row.colour,
    hasColours: row.has_colours,
    categoryPath: `/c/${encodeURIComponent(row.main_slug)}`,
  };
}

const productPath = (product: SizedProduct, variantId?: string) =>
  `/p/${encodeURIComponent(product.slug)}${variantId ? `?v=${variantId}` : ""}`;

async function signInAs(page: Page, role: "electrician" | "customer") {
  const email = uniqueEmail(`atd-${role}`);
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

/** A draft as quick order makes it: a name and one empty line. */
async function insertDraft(userId: string, name: string) {
  const [draft] = await sql<{ id: string }[]>`
    insert into drafts (owner_user_id, name) values (${userId}, ${name}) returning id`;
  await sql`insert into draft_lines (draft_id, sort) values (${draft.id}, 0)`;
  return draft.id;
}

const sheet = (page: Page) => page.getByTestId("draft-picker");

async function chooseOption(page: Page, product: SizedProduct) {
  await sheet(page).getByLabel("الحجم").selectOption({ label: product.size });
  if (product.hasColours) {
    await sheet(page)
      .getByLabel("اللون")
      .selectOption({ label: product.colour ?? "بدون لون" });
  }
}

test("from a card, an electrician adds into an existing draft and opens it", async ({
  page,
}, testInfo) => {
  const product = await sizedProduct();
  const userId = await signInAs(page, "electrician");
  await insertDraft(userId, "site a");

  // AC-3, AC-14: the corner button on a category page's cards.
  await page.goto(product.categoryPath);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("card-add-to-draft").first()).toBeVisible();
  await checkA11y(page, testInfo);

  await page.goto(`/search?q=${encodeURIComponent(product.code)}`);
  await page.waitForLoadState("networkidle");
  const card = page.getByTestId("product-card").filter({ hasText: product.name }).first();
  const button = card.getByRole("button", { name: `أضف إلى مسودة: ${product.name}` });
  await button.click();
  await expect(page).toHaveURL(/\/search/);

  // AC-4, AC-7: the product, then the newest draft chosen.
  await expect(sheet(page).getByRole("heading", { name: "أضف إلى مسودة" })).toBeVisible();
  await expect(sheet(page)).toContainText(product.code);
  await expect(sheet(page).getByRole("radio", { name: /site a/ })).toBeChecked();
  await expect(sheet(page).getByTestId("draft-picker-quantity")).toHaveValue("1");

  // AC-8: nothing chosen yet is refused inline.
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByText("اختر الحجم واللون.")).toBeVisible();
  await expect(sheet(page).getByLabel("الحجم")).toBeFocused();

  await chooseOption(page, product);
  await expect(sheet(page).getByTestId("draft-picker-price")).toContainText("سعر الوحدة");
  await sheet(page).getByTestId("draft-picker-quantity").fill("abc");
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByText("أدخل كمية من 1 إلى 999.")).toBeVisible();
  await sheet(page).getByTestId("draft-picker-quantity").fill("٢");
  await checkA11y(page, testInfo);

  // AC-10: where it landed, focus on the status heading.
  await sheet(page).getByTestId("draft-picker-confirm").click();
  const added = sheet(page).getByTestId("draft-picker-added");
  await expect(added).toContainText("أُضيف إلى «site a»");
  await expect(added).toContainText("السطر 2 · الكمية 2");
  await expect(added.getByRole("heading")).toBeFocused();
  await checkA11y(page, testInfo);

  await sheet(page).getByRole("link", { name: "فتح المسودة" }).click();
  // The quick order route may compile on first visit in dev.
  await page.waitForURL(/\/account\/quick-order\?draft=/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("quick-order-line")).toHaveCount(2);
  await expect(page.getByLabel("الكود أو اسم المنتج").nth(1)).toHaveValue(product.name);
  await expect(page.getByTestId("line-quantity").nth(1)).toHaveValue("2");
});

test("from the product page, the sheet starts at the page's choice, merges, and stops at 999", async ({
  page,
}) => {
  const product = await sizedProduct();
  const userId = await signInAs(page, "electrician");
  await insertDraft(userId, "site b");

  await page.goto(productPath(product, product.variantId));
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "زيادة الكمية" }).click();

  // AC-2, AC-5, AC-6: the page's option and the stepper's 2.
  await page.getByTestId("product-add-to-draft").click();
  await expect(sheet(page).getByTestId("draft-picker-quantity")).toHaveValue("2");
  await expect(sheet(page).getByLabel("الحجم").locator("option:checked")).toHaveText(product.size);
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByTestId("draft-picker-added")).toContainText("السطر 2 · الكمية 2");
  await sheet(page).getByRole("button", { name: "متابعة التسوق" }).click();
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByTestId("product-add-to-draft")).toBeFocused();

  // AC-8: the same option again grows its line.
  await page.getByTestId("product-add-to-draft").click();
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByTestId("draft-picker-added")).toContainText(
    "السطر 2 · الكمية الآن 4",
  );
  await sheet(page).getByRole("button", { name: "متابعة التسوق" }).click();

  // AC-11: past 999 is refused, the typed quantity stays, and nothing changes.
  await page.getByTestId("product-add-to-draft").click();
  await sheet(page).getByTestId("draft-picker-quantity").fill("999");
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByTestId("draft-picker-refusal")).toHaveText(
    "هذا الخيار في السطر 2 بكمية 4. لا يمكن أن تتجاوز الكمية 999.",
  );
  await expect(sheet(page).getByTestId("draft-picker-quantity")).toHaveValue("999");
  const lines = await sql<{ quantity: number | null }[]>`
    select l.quantity from draft_lines l join drafts d on d.id = l.draft_id
    where d.owner_user_id = ${userId} and l.variant_id = ${product.variantId}`;
  expect(lines.map((line) => line.quantity)).toEqual([4]);

  // Escape closes it and focus returns to the button.
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await expect(page.getByTestId("product-add-to-draft")).toBeFocused();
});

test("with no drafts, an electrician names a new one in the sheet", async ({ page }) => {
  const product = await sizedProduct();
  const userId = await signInAs(page, "electrician");

  await page.goto(productPath(product, product.variantId));
  await page.waitForLoadState("networkidle");
  await page.getByTestId("product-add-to-draft").click();

  // AC-7: only the new draft row, already chosen, with its field.
  await expect(sheet(page).getByRole("radio")).toHaveCount(1);
  await expect(sheet(page).getByRole("radio", { name: "+ مسودة جديدة" })).toBeChecked();
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByText("اكتب اسماً من حرفين على الأقل.")).toBeVisible();
  await expect(sheet(page).getByTestId("draft-picker-name")).toBeFocused();

  // AC-9: the draft holds exactly that line.
  await sheet(page).getByTestId("draft-picker-name").fill("موقع جديد");
  await sheet(page).getByTestId("draft-picker-confirm").click();
  await expect(sheet(page).getByTestId("draft-picker-added")).toContainText(
    "أُضيف إلى «موقع جديد»",
  );
  await expect(sheet(page).getByTestId("draft-picker-added")).toContainText("السطر 1 · الكمية 1");
  const lines = await sql<{ name: string; quantity: number }[]>`
    select d.name, l.quantity from drafts d join draft_lines l on l.draft_id = d.id
    where d.owner_user_id = ${userId}`;
  expect(lines).toEqual([{ name: "موقع جديد", quantity: 1 }]);
});

async function expectNoDraftButtons(page: Page, product: SizedProduct) {
  await page.goto(productPath(product));
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("add-to-cart")).toBeVisible();
  await expect(page.getByRole("button", { name: /أضف إلى مسودة/ })).toHaveCount(0);
  await page.goto(`/search?q=${encodeURIComponent(product.code)}`);
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await expect(page.getByTestId("card-add-to-draft")).toHaveCount(0);
}

test("a signed out visitor, a customer, and the owner see no add to draft button", async ({
  page,
}) => {
  test.skip(!accounts, "needs the local Supabase");
  const product = await sizedProduct();
  await expectNoDraftButtons(page, product);

  await signInAs(page, "customer");
  await expectNoDraftButtons(page, product);

  await page.context().clearCookies();
  await signInAdmin(page, accounts!);
  await expectNoDraftButtons(page, product);
});
