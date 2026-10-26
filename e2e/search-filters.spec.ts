import { expect as baseExpect, test, type Page } from "@playwright/test";
import type postgres from "postgres";
import { buildSearchText, sizeKey } from "../src/features/catalog/search-text";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-6, AC-8 to AC-14, AC-16 (spec 0010). On a phone sized right to left screen:
// the search prompt and its too short note; an Arabic name typed with other hamza and ta marbuta
// forms; an exact code first; load more on search; no results. On a category: the filters screen
// with its live count, size and colour applied, the address opened in a new page, one chip
// removed, clear all, and a filtered list with no match. Axe runs on the prompt, the results, the
// open filters screen, and a filtered category page. Rows go in with SQL, keys from the app's own
// pure rules, as a product save would write them.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "phone",
    "the search and filters flow runs on the phone project",
  );
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

const tag = Date.now().toString(36);
const TAG = tag.toUpperCase();
const CODE = `SF-${TAG}`;
const SLUG = `sf-e2e-${tag}`;
const GOLD = `ذهبي ${tag}`;
const BLACK = `أسود ${tag}`;
const GARDEN = `إنارة حديقة ${tag}`;
const LAMP = `مصباح ${tag}`;
const MORE = 26;

type Option = readonly [
  size: string | null,
  colour: "gold" | "black" | null,
  price: number,
  available: boolean,
];

async function insertProduct(
  sql: postgres.Sql,
  categoryId: string,
  colourIds: Record<"gold" | "black", string>,
  fields: { code: string; name: string; options: readonly Option[] },
) {
  const [product] = await sql<{ id: string }[]>`
    insert into products (category_id, code, name, slug, search_text)
    values (${categoryId}, ${fields.code}, ${fields.name}, ${fields.code.toLowerCase()},
            ${buildSearchText(fields.name, fields.code, [])})
    returning id`;
  for (const [sort, [size, colour, price, available]] of fields.options.entries()) {
    await sql`
      insert into product_variants
        (product_id, size_label, size_key, colour_id, price, is_available, is_default, sort)
      values (${product.id}, ${size}, ${sizeKey(size)}, ${colour ? colourIds[colour] : null},
              ${price}, ${available}, ${sort === 0}, ${sort})`;
  }
}

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    const [category] = await sql<{ id: string }[]>`
      insert into categories (name, slug) values (${`بحث وتصفية ${tag}`}, ${SLUG}) returning id`;
    const [gold] = await sql<{ id: string }[]>`
      insert into colours (name, hex, sort) values (${GOLD}, ${"#C9A227"}, 0) returning id`;
    const [black] = await sql<{ id: string }[]>`
      insert into colours (name, hex, sort) values (${BLACK}, ${"#111111"}, 1) returning id`;
    const [elsewhere] = await sql<{ id: string }[]>`
      insert into categories (name, slug) values (${`بحث ${tag}`}, ${`${SLUG}-search`}) returning id`;
    const colourIds = { gold: gold.id, black: black.id };
    const add = (fields: { code: string; name: string; options: readonly Option[] }) =>
      insertProduct(sql, category.id, colourIds, fields);
    const addElsewhere = (fields: { code: string; name: string; options: readonly Option[] }) =>
      insertProduct(sql, elsewhere.id, colourIds, fields);

    // The filter set: 60 cm and gold together on two products, one of them not sellable.
    await add({
      code: `${CODE}-A`,
      name: `ثريا ألف ${tag}`,
      options: [
        ["60 سم", "gold", 15_000, true],
        ["80 سم", "black", 25_000, true],
      ],
    });
    await add({
      code: `${CODE}-B`,
      name: `ثريا باء ${tag}`,
      options: [["60 سم", "black", 12_000, true]],
    });
    await add({
      code: `${CODE}-C`,
      name: `ثريا جيم ${tag}`,
      options: [["80 سم", "gold", 30_000, true]],
    });
    await add({
      code: `${CODE}-D`,
      name: `ثريا دال ${tag}`,
      options: [["60 سم", "gold", 18_000, false]],
    });

    // Search: a name with hamza and ta marbuta, an exact code (older) and a longer one (newer).
    await addElsewhere({ code: `${CODE}-G`, name: GARDEN, options: [[null, null, 9_000, true]] });
    await addElsewhere({
      code: `${CODE}-1`,
      name: `لمبة أولى ${tag}`,
      options: [[null, null, 5_000, true]],
    });
    await sql`update products set created_at = now() - interval '1 day' where code = ${`${CODE}-1`}`;
    await addElsewhere({
      code: `${CODE}-10`,
      name: `لمبة ثانية ${tag}`,
      options: [[null, null, 5_000, true]],
    });
    for (let i = 1; i <= MORE; i += 1) {
      await addElsewhere({
        code: `${CODE}-M${i}`,
        name: `${LAMP} ${i}`,
        options: [[null, null, 2_000, true]],
      });
    }
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}-%`}`;
    await sql`delete from colours where name in (${GOLD}, ${BLACK})`;
    await sql`delete from categories where slug in (${SLUG}, ${`${SLUG}-search`})`;
  } finally {
    await sql.end();
  }
});

const searchBox = (page: Page) => page.getByRole("searchbox", { name: "ابحث في المتجر" });

async function search(page: Page, text: string) {
  await searchBox(page).fill(text);
  await searchBox(page).press("Enter");
  await expect(page.getByTestId("search-count")).toContainText(text);
}

const cardNames = (page: Page, list: string) =>
  page.getByTestId(list).getByRole("heading", { level: 2 });

test("a customer searches by name and code, and pages through the results", async ({ page }) => {
  test.setTimeout(120_000);

  // The prompt: nothing read, the field focused (AC-1).
  await page.goto("/search");
  await expect(page.getByRole("heading", { level: 1, name: "البحث" })).toBeVisible();
  await expect(page.getByText("اكتب اسم المنتج أو الكود")).toBeVisible();
  await expect(searchBox(page)).toBeFocused();
  await checkA11y(page);

  await page.goto(`/search?q=${encodeURIComponent("ث")}`);
  await expect(page.getByTestId("search-too-short")).toHaveText("اكتب حرفين على الأقل");
  await expect(searchBox(page)).toHaveValue("ث");

  // Other hamza and ta marbuta forms find the name (AC-2, AC-3); the field keeps the query.
  await search(page, `انارة حديقه ${tag}`);
  await expect(page.getByRole("heading", { level: 1, name: "نتائج البحث" })).toBeVisible();
  await expect(page.getByTestId("search-count")).toContainText("1 نتيجة للبحث عن");
  await expect(cardNames(page, "search-products")).toHaveText([GARDEN]);
  await expect(searchBox(page)).toHaveValue(`انارة حديقه ${tag}`);
  await expect(searchBox(page)).not.toBeFocused();
  await checkA11y(page);

  // An exact code comes first, ahead of a newer product whose code only starts with it (AC-4).
  await search(page, `${CODE}-1`.toLowerCase());
  await expect(cardNames(page, "search-products").first()).toHaveText(`لمبة أولى ${tag}`);
  await expect(cardNames(page, "search-products")).toHaveCount(2);

  // Load more keeps the query and moves focus to the first new card (AC-5).
  await search(page, LAMP);
  await expect(page.getByTestId("search-shown")).toHaveText(`تم عرض 24 من ${MORE} نتيجة`);
  await page.getByTestId("search-more").click();
  await expect(page).toHaveURL(/page=2#p-25$/);
  await expect(cardNames(page, "search-products")).toHaveCount(MORE);
  await expect(page.locator("#p-25 h2 a")).toBeFocused();

  // The query chip goes back to the prompt.
  await page.getByRole("link", { name: `إزالة البحث ${LAMP}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: "البحث" })).toBeVisible();

  // No results: the empty card, the query chip, and no filter button for an empty list (AC-6).
  await search(page, `zz${tag}`);
  await expect(page.getByText(`لا توجد نتائج لـ «zz${tag}»`)).toBeVisible();
  await expect(page.getByRole("link", { name: `إزالة البحث zz${tag}` })).toBeVisible();
  await expect(page.getByTestId("filters-button")).toHaveCount(0);
});

test("a customer filters a category, shares the address, and clears the filters", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const categoryPath = `/c/${SLUG}`;
  await page.goto(categoryPath);
  await expect(page.getByTestId("category-count")).toHaveText("4 منتج");

  // The screen opens on the list's choices, and N follows each change (AC-10 to AC-12).
  await page.getByTestId("filters-button").click();
  const screen = page.getByTestId("filters-screen");
  await expect(screen.getByRole("heading", { level: 1, name: "تصفية المنتجات" })).toBeVisible();
  await expect(screen.getByRole("button", { name: "إغلاق التصفية" })).toBeFocused();
  const apply = page.getByTestId("filters-apply");
  await expect(apply).toHaveText("عرض 4 منتج");
  await screen.getByRole("group", { name: "الحجم" }).getByRole("button", { name: "60 سم" }).click();
  await expect(apply).toHaveText("عرض 3 منتج");
  await screen.getByRole("group", { name: "اللون" }).getByRole("button", { name: GOLD }).click();
  await expect(apply).toHaveText("عرض 2 منتج");
  await expect(screen.getByLabel("من")).toHaveAttribute("placeholder", "120");
  await expect(screen.getByLabel("إلى")).toHaveAttribute("placeholder", "300");
  await checkA11y(page);

  // Apply: the address holds the filters, focus returns to the button (AC-8, AC-11, AC-13).
  await apply.click();
  await expect(page).toHaveURL(new RegExp(`\\?size=${encodeURIComponent("60سم")}&colour=`));
  await expect(page.getByTestId("category-count")).toHaveText("2 منتج");
  await expect(page.getByTestId("filters-button")).toBeFocused();
  await expect(page.getByTestId("filters-button")).toContainText("2");
  const applied = page.getByTestId("applied-chips");
  await expect(applied.getByRole("link", { name: "إزالة التصفية: 60 سم" })).toBeVisible();
  await expect(applied.getByRole("link", { name: `إزالة التصفية: ${GOLD}` })).toBeVisible();
  // In stock first, then newest (spec 0008): ألف is sellable, دال is not.
  await expect(cardNames(page, "category-products")).toHaveText([
    `ثريا ألف ${tag}`,
    `ثريا دال ${tag}`,
  ]);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await checkA11y(page);

  // The copied address opens the same list in a new page (AC-8).
  const shared = await context.newPage();
  await shared.goto(page.url());
  await expect(shared.getByTestId("category-count")).toHaveText("2 منتج");
  await expect(cardNames(shared, "category-products")).toHaveText([
    `ثريا ألف ${tag}`,
    `ثريا دال ${tag}`,
  ]);
  await shared.close();

  // One chip off keeps the other filter; focus goes to the filter button (AC-11, AC-13).
  await applied.getByRole("link", { name: `إزالة التصفية: ${GOLD}` }).click();
  await expect(page.getByTestId("category-count")).toHaveText("3 منتج");
  await expect(page.getByTestId("filters-button")).toBeFocused();
  await expect(applied.getByRole("link")).toHaveCount(2);

  // Clear all: the unfiltered list again.
  await page.getByTestId("applied-clear").click();
  await expect(page.getByTestId("category-count")).toHaveText("4 منتج");
  await expect(page.getByTestId("applied-chips")).toHaveCount(0);

  // A filtered list with no match: its own empty card and the clear link (AC-13).
  await page.goto(`${categoryPath}?size=${encodeURIComponent("80سم")}&max=100`);
  await expect(page.getByText("لا توجد منتجات مطابقة")).toBeVisible();
  await page.getByRole("link", { name: "مسح التصفية" }).click();
  await expect(page.getByTestId("category-count")).toHaveText("4 منتج");
});
