import { expect as baseExpect, test, type Page } from "@playwright/test";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";
import { localSql } from "./local-db";

// covers: AC-1 to AC-5, AC-8 to AC-11, AC-16 (spec 0011). On a phone sized right to left screen:
// the owner adds two banners (one linked to a category), reorders them, unticks one and saves,
// picks two featured products, unticks a main, and gives a main a photo and a line; a customer
// sees the banner, follows its link, and sees the circles and the featured cards; with every banner
// off the hero shows; the circle carousel's pause button stops its movement. Axe runs on Home (both
// versions) and on the editor. Home is shared by every flow, so this one runs in its own project
// after the others (playwright.config.ts) and puts Home back as it found it.

const expect = baseExpect.configure({ timeout: 15_000 });
const accounts = adminAccounts();

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

const tag = Date.now().toString(36);
const MAINS = [1, 2, 3, 4].map((n) => `قسم ${tag} ${n}`);
const CODE = `HP-E2E-${tag.toUpperCase()}`;
const FEATURED = [1, 2].map((n) => `ثريا مختارة ${tag} ${n}`);
const LINKED = `عرض الثريات ${tag}`;
const PLAIN = `عرض الأباجورات ${tag}`;
const LINE = `سطر ${tag}`;

/** Four mains, each with a listed product (so four or more circles), and the two picks. */
async function seed() {
  const sql = localSql();
  try {
    await sql`delete from banners`;
    await sql`delete from featured_products`;
    for (const [i, name] of MAINS.entries()) {
      const [main] = await sql<{ id: string }[]>`
        insert into categories (name, slug, sort) values (${name}, ${`hp-e2e-${tag}-${i}`}, ${-10 + i})
        returning id`;
      const names = i < FEATURED.length ? [FEATURED[i]] : [`منتج ${tag} ${i}`];
      for (const productName of names) {
        const [product] = await sql<{ id: string }[]>`
          insert into products (category_id, code, name, slug)
          values (${main.id}, ${`${CODE}-${i}`}, ${productName}, ${`hp-e2e-${tag}-p${i}`})
          returning id`;
        await sql`
          insert into product_variants (product_id, price, is_default)
          values (${product.id}, ${20_000 + i * 100}, true)`;
      }
    }
  } finally {
    await sql.end();
  }
}

test.afterAll(async () => {
  if (!accounts) return;
  const sql = localSql();
  try {
    await sql`delete from banners`;
    await sql`delete from featured_products`;
    await sql`delete from products where code like ${`${CODE}-%`}`;
    await sql`delete from categories where slug like ${`hp-e2e-${tag}-%`}`;
  } finally {
    await sql.end();
  }
});

/** A plain coloured picture made by the browser, `width` by `height`, as a file to pick. */
async function picture(page: Page, width: number, height: number) {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#1b1714";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#fcf42c";
      context.fillRect(w / 4, h / 4, w / 2, h / 2);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (const byte of bytes) text += String.fromCharCode(byte);
      return btoa(text);
    },
    [width, height] as const,
  );
  return { name: "picture.jpg", mimeType: "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

/** Waits until the picked picture is cropped, previewed, and in Storage. */
async function uploaded(dialog: ReturnType<Page["getByTestId"]>) {
  await expect(dialog.getByTestId("home-image-preview").locator("img")).toBeVisible();
  await expect(dialog.getByText("جارٍ الرفع")).toHaveCount(0, { timeout: 30_000 });
  await expect(dialog.getByText("تعذّر رفع الصورة")).toHaveCount(0);
}

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

async function openEditor(page: Page) {
  await page.goto("/admin/homepage");
  await expect(page.getByRole("heading", { level: 1, name: "الصفحة الرئيسية" })).toBeVisible();
  // The editor answers input once React has taken over the page.
  await expect(page.locator("[aria-busy]")).toHaveCount(0);
}

async function addBanner(page: Page, alt: string, linkTo: string | null) {
  await page.getByTestId("banner-add").click();
  const dialog = page.getByTestId("banner-dialog");
  await dialog.getByTestId("home-image-input").setInputFiles(await picture(page, 1800, 1200));
  await uploaded(dialog);
  await dialog.getByLabel("العنوان").fill(alt);
  if (linkTo) {
    await dialog.getByRole("radio", { name: "قسم" }).click();
    await dialog.getByLabel("القسم", { exact: true }).selectOption({ label: linkTo });
  }
  await dialog.getByTestId("banner-save").click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("banner-row").filter({ hasText: alt })).toBeVisible();
}

async function saveEditor(page: Page) {
  await page.getByTestId("homepage-save").click();
  await expect(page.getByText("تم حفظ التغييرات.")).toBeVisible();
}

test("the owner runs Home and a customer sees it", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "homepage", "runs once, after the other flows");
  test.setTimeout(300_000);
  await seed();
  await signInAdmin(page, accounts!, "/admin/homepage");
  await openEditor(page);
  await expect(page.getByText("لا توجد بانرات. تظهر بطاقة الترحيب بدلها.")).toBeVisible();

  // Two banners, the first linked to a category; a picture under 800 wide is refused (AC-10).
  await page.getByTestId("banner-add").click();
  const dialog = page.getByTestId("banner-dialog");
  await dialog.getByTestId("home-image-input").setInputFiles(await picture(page, 700, 700));
  await expect(dialog.getByText("الصورة صغيرة")).toBeVisible();
  await dialog.getByRole("button", { name: "إلغاء" }).click();
  await addBanner(page, LINKED, MAINS[0]);
  await addBanner(page, PLAIN, null);
  const rows = page.getByTestId("banner-row");
  await expect(rows.nth(0)).toContainText(`الرابط: ${MAINS[0]}`);
  await expect(rows.nth(1)).toContainText("الرابط: بدون رابط");

  // Reorder, untick the plain one, pick two products, untick the fourth main, then save (AC-8, AC-9).
  await page.getByRole("button", { name: `نقل لأعلى: ${PLAIN}` }).click();
  await expect(rows.nth(0)).toContainText(PLAIN);
  await rows.nth(0).getByRole("checkbox").click();
  const picker = page.getByLabel("إضافة منتج");
  for (const name of FEATURED) {
    await picker.fill(CODE);
    await page.getByRole("button", { name: `إضافة ${name}` }).click();
  }
  await expect(page.getByTestId("featured-row")).toHaveCount(2);
  await page.getByRole("checkbox", { name: MAINS[3] }).click();
  await saveEditor(page);
  await checkA11y(page);

  // A main's circle photo and line, from the category dialog (AC-11).
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: `تعديل: ${MAINS[0]}` }).click();
  const categoryDialog = page.getByTestId("category-dialog");
  await categoryDialog.getByTestId("home-image-input").setInputFiles(await picture(page, 600, 600));
  await uploaded(categoryDialog);
  await categoryDialog.getByLabel("السطر تحت الدائرة (اختياري)").fill(LINE);
  await categoryDialog.getByTestId("category-save").click();
  await expect(categoryDialog).toBeHidden();

  // The customer: the one active banner, its link, the circles, and the picks (AC-1 to AC-5).
  const shopper = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const customer = await shopper.newPage();
  await customer.goto("/");
  const banner = customer.getByTestId("home-banners");
  await expect(banner.getByRole("img", { name: LINKED })).toBeVisible();
  await expect(banner.getByRole("img", { name: PLAIN })).toHaveCount(0);
  await expect(customer.locator("h1")).toHaveText("S.K.F للإنارة");
  const circles = customer.getByTestId("home-circles");
  await expect(circles.getByText(LINE)).toBeAttached();
  await expect(circles.getByText(MAINS[3])).toHaveCount(0);
  const featured = customer.getByTestId("home-products");
  await expect(featured.getByTestId("product-card")).toHaveCount(2);
  await expect(featured).toContainText(FEATURED[0]);
  await expect(featured).toContainText(FEATURED[1]);
  await checkA11y(customer);

  // With four or more circles the carousel moves; the pause button stops it (AC-4).
  const pause = customer.getByTestId("circles-pause");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await pause.click();
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  const centred = await customer.getByTestId("circles-browse").textContent();
  await customer.waitForTimeout(4000);
  await expect(customer.getByTestId("circles-browse")).toHaveText(centred ?? "");

  await banner.getByTestId("banner-link").click();
  await expect(customer).toHaveURL(new RegExp(`/c/hp-e2e-${tag}-0$`));

  // Every banner off: the hero comes back with its own h1 (AC-3).
  await openEditor(page);
  await page.getByTestId("banner-row").filter({ hasText: LINKED }).getByRole("checkbox").click();
  await saveEditor(page);
  await customer.goto("/");
  await expect(customer.getByRole("heading", { level: 1 })).toHaveText(/ثريات وإنارة/);
  await expect(customer.getByTestId("home-banners")).toHaveCount(0);
  await checkA11y(customer);
  await shopper.close();
});
