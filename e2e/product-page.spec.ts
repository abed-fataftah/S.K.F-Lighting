import { expect as baseExpect, test, type Page } from "@playwright/test";
import { adminAccounts } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-13, AC-16, AC-18, AC-19 (spec 0009). On a phone sized right to left screen: a
// product with 2 sizes at different prices × 2 colours, one pair unticked, and 2 photos opens on
// its default; a size change updates the price and the address; the unticked pair's colour is
// disabled for that size; a reload keeps the choice; 2 units go to the cart with that size and
// colour; the arrows loop the counter; the full screen view opens and closes with focus back;
// share copies the link; a stale add moves the choice; an out of stock product offers only W4; an
// unknown slug is a real 404. Axe runs in stock, out of stock, and on the full screen view.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the product page flow runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
  // No system share sheet, so share falls back to copying the link (AC-13).
  await page.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share;
  });
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

const tag = Date.now().toString(36);
const CODE = `PP-E2E-${tag.toUpperCase()}`;
const GOLD = `ذهبي ${tag}`;
const BLACK = `أسود ${tag}`;
const NAME = `ثريا الصفحة ${tag}`;
const OUT_NAME = `ثريا نفدت ${tag}`;
const slug = `pp-e2e-${tag}`;
const outSlug = `pp-e2e-out-${tag}`;

type Ids = Record<"40-gold" | "40-black" | "60-gold" | "60-black", string>;
let ids: Ids;
let otherVariant: string;

test.beforeAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    const [category] = await sql<{ id: string }[]>`
      insert into categories (name, slug) values (${`صفحة المنتج ${tag}`}, ${`pp-e2e-${tag}`})
      returning id`;
    const [gold] = await sql<{ id: string }[]>`
      insert into colours (name, hex, sort) values (${GOLD}, ${"#C9A227"}, 0) returning id`;
    const [black] = await sql<{ id: string }[]>`
      insert into colours (name, hex, sort) values (${BLACK}, ${"#111111"}, 1) returning id`;
    const [product] = await sql<{ id: string }[]>`
      insert into products (category_id, code, name, slug, description, specs)
      values (${category.id}, ${CODE}, ${NAME}, ${slug}, ${"ثريا للاختبار\nبسطرين."},
              ${sql.json([{ label: "القدرة", value: "60 واط" }])})
      returning id`;
    const pairs = [
      ["40-gold", "40 سم", 1, gold.id, 30_000, true],
      ["40-black", "40 سم", 1, black.id, 30_000, true],
      ["60-gold", "60 سم", 2, gold.id, 45_000, true],
      ["60-black", "60 سم", 2, black.id, 45_000, false],
    ] as const;
    const made: Partial<Ids> = {};
    for (const [index, [key, size, sizeSort, colourId, price, available]] of pairs.entries()) {
      const [row] = await sql<{ id: string }[]>`
        insert into product_variants
          (product_id, size_label, size_sort, colour_id, price, is_available, is_default, sort)
        values (${product.id}, ${size}, ${sizeSort}, ${colourId}, ${price}, ${available},
                ${index === 0}, ${index})
        returning id`;
      made[key] = row.id;
    }
    ids = made as Ids;
    for (const n of [0, 1]) {
      await sql`
        insert into product_media (product_id, kind, storage_key, width, height, sort)
        values (${product.id}, 'image', ${`products/${product.id}/e2e-${n}.webp`}, 800, 800, ${n})`;
    }
    const [out] = await sql<{ id: string }[]>`
      insert into products (category_id, code, name, slug, is_available)
      values (${category.id}, ${`${CODE}-OUT`}, ${OUT_NAME}, ${outSlug}, false)
      returning id`;
    const [outVariant] = await sql<{ id: string }[]>`
      insert into product_variants (product_id, price, is_default)
      values (${out.id}, ${12_000}, true) returning id`;
    otherVariant = outVariant.id;
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from products where code like ${`${CODE}%`}`;
    await sql`delete from colours where name in (${GOLD}, ${BLACK})`;
    await sql`delete from categories where slug = ${`pp-e2e-${tag}`}`;
  } finally {
    await sql.end();
  }
});

const productPath = (s: string) => `/p/${encodeURIComponent(s)}`;
const sizeChip = (page: Page, size: string) =>
  page.getByRole("group", { name: "الحجم" }).getByRole("button", { name: new RegExp(`^${size}`) });
const colourChip = (page: Page, colour: string) =>
  page.getByRole("group", { name: "اللون" }).getByRole("button", { name: new RegExp(colour) });
const price = (page: Page) => page.getByTestId("product-price");

test("a customer chooses a size and colour, sees the price follow, and buys that pair", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto(productPath(slug));

  // Opens on the default pair, with no ?v in the address (AC-4, AC-6).
  await expect(price(page)).toHaveText("₪300");
  await expect(page.getByTestId("product-size-note")).toHaveText("· للحجم 40 سم");
  await expect(sizeChip(page, "40 سم")).toHaveAttribute("aria-pressed", "true");
  await expect(colourChip(page, GOLD)).toHaveAttribute("aria-pressed", "true");
  expect(new URL(page.url()).search).toBe("");
  await checkA11y(page);

  // A size change updates the price and the address at once (AC-5, AC-6).
  await sizeChip(page, "60 سم").click();
  await expect(price(page)).toHaveText("₪450");
  await expect(page).toHaveURL(new RegExp(`\\?v=${ids["60-gold"]}$`));

  // Follow the size: black is disabled for 60 سم only, with the visible note (AC-3).
  await expect(colourChip(page, BLACK)).toBeDisabled();
  await expect(colourChip(page, BLACK)).toContainText("· غير متوفر");
  await sizeChip(page, "40 سم").click();
  await expect(colourChip(page, BLACK)).toBeEnabled();
  await colourChip(page, BLACK).click();
  await expect(page).toHaveURL(new RegExp(`\\?v=${ids["40-black"]}$`));
  // Choosing 60 سم from black moves the colour to the first one that sells (AC-3).
  await sizeChip(page, "60 سم").click();
  await expect(colourChip(page, GOLD)).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(new RegExp(`\\?v=${ids["60-gold"]}$`));

  // W3 names the size and colour and links the same choice (AC-9).
  const whatsapp = decodeURIComponent(
    (await page.getByTestId("product-whatsapp-buy").getAttribute("href"))!,
  );
  expect(whatsapp).toContain(`(الكود: ${CODE}) 60 سم ${GOLD} `);
  expect(whatsapp).toContain(`?v=${ids["60-gold"]}`);

  // A reload keeps the choice (AC-4, AC-6).
  await page.reload();
  await expect(price(page)).toHaveText("₪450");
  await expect(sizeChip(page, "60 سم")).toHaveAttribute("aria-pressed", "true");

  // The arrows move the counter and loop (AC-10).
  const counter = page.getByTestId("gallery-counter");
  await expect(counter).toHaveText("1 / 2");
  await page.getByRole("button", { name: "الصورة التالية" }).click();
  await expect(counter).toHaveText("2 / 2");
  await page.getByRole("button", { name: "الصورة التالية" }).click();
  await expect(counter).toHaveText("1 / 2");
  await expect(page.getByRole("button", { name: "صورة 1", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // The full screen view opens, passes axe, closes on Esc, and focus comes back (AC-12).
  const zoom = page.getByRole("button", { name: "تكبير الصورة 1" });
  await zoom.click();
  const dialog = page.getByRole("dialog", { name: `صور ${NAME}` });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("full-screen-counter")).toHaveText("1 / 2");
  await expectNoAxeViolations(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(zoom).toBeFocused();

  // Share copies the link with the choice when there is no share sheet (AC-13).
  await page.getByTestId("share-product").click();
  await expect(page.getByTestId("share-notice")).toHaveText("تم نسخ الرابط");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    new RegExp(`/p/${slug}\\?v=${ids["60-gold"]}$`),
  );

  // 2 units of the chosen pair reach the cart (AC-8).
  await page.getByRole("button", { name: "زيادة الكمية" }).click();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("add-to-cart")).toContainText("تمت الإضافة إلى السلة");
  await page.getByRole("link", { name: "عرض السلة" }).click();
  const line = page.getByTestId("cart-lines").getByRole("listitem").filter({ hasText: NAME });
  await expect(line).toContainText("60 سم");
  await expect(line).toContainText(GOLD);
  await expect(line.getByRole("textbox")).toHaveValue("2");
});

test("a bad ?v opens the default pair", async ({ page }) => {
  for (const v of ["abc", otherVariant, ids["60-black"]]) {
    await page.goto(`${productPath(slug)}?v=${v}`);
    await expect(price(page)).toHaveText("₪300");
    await expect(sizeChip(page, "40 سم")).toHaveAttribute("aria-pressed", "true");
  }
});

test("a pair that sells out after the page loaded is refused and the choice moves", async ({
  page,
}) => {
  await page.goto(productPath(slug));
  await expect(colourChip(page, GOLD)).toHaveAttribute("aria-pressed", "true");
  const sql = localSql();
  try {
    await sql`update product_variants set is_available = false where id = ${ids["40-gold"]}`;
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("add-problem")).toHaveText("هذا المنتج لم يعد متوفرًا.");
    await expect(page).toHaveURL(new RegExp(`\\?v=${ids["40-black"]}$`));
    await expect(colourChip(page, BLACK)).toHaveAttribute("aria-pressed", "true");
    await expect(colourChip(page, GOLD)).toBeDisabled();
  } finally {
    await sql`update product_variants set is_available = true where id = ${ids["40-gold"]}`;
    await sql.end();
  }
});

test("an out of stock product only asks about availability, and an unknown slug is a 404", async ({
  page,
}) => {
  await page.goto(productPath(outSlug));
  await expect(page.getByTestId("product-stock")).toHaveText("غير متوفر");
  await expect(page.getByTestId("add-to-cart")).toBeDisabled();
  await expect(page.getByTestId("add-to-cart")).toHaveText("غير متوفر");
  await expect(price(page)).toHaveText("₪120");
  await expect(page.getByRole("button", { name: "زيادة الكمية" })).toHaveCount(0);
  for (const place of ["buy", "help"]) {
    const button = page.getByTestId(`product-whatsapp-${place}`);
    await expect(button).toHaveText("اسأل عن توفره عبر واتساب");
    expect(decodeURIComponent((await button.getAttribute("href"))!)).toContain(
      `هل المنتج ${OUT_NAME} (الكود: ${CODE}-OUT) متوفر؟`,
    );
  }
  await checkA11y(page);

  expect((await page.request.get(productPath(`missing-${tag}`))).status()).toBe(404);
});
