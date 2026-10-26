import { readFileSync } from "node:fs";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import readXlsxFile, { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { adminAccounts, signInAdmin } from "./admin-auth";
import {
  expectNoAxeViolations,
  expectNoSidewaysScroll,
  expectTouchTargets,
  usePhoneWidth,
} from "./a11y";

// covers: AC-1, AC-2, AC-12, AC-13, AC-14, AC-15, AC-17 (spec 0007).
// The spreadsheet import on a phone sized right to left screen, against the local Supabase. The
// committed fixtures under e2e/fixtures/import/ hold the content; each run swaps their `IMP-`
// codes for codes of its own, so runs never meet each other's products.

const expect = baseExpect.configure({ timeout: 20_000 });
const accounts = adminAccounts();
const FIXTURES = "e2e/fixtures/import";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the import flow runs on the phone project");
  test.skip(!accounts, "needs the local Supabase (pnpm db:start)");
  await usePhoneWidth(page, testInfo);
});

async function checkA11y(page: Page) {
  await expectNoAxeViolations(page);
  await expectTouchTargets(page);
  await expectNoSidewaysScroll(page);
}

type Cell = string | number | boolean | null;

async function xlsx(rows: readonly (readonly Cell[])[]): Promise<Buffer> {
  const cells = rows.map((row) =>
    row.map((value) =>
      value === null
        ? null
        : typeof value === "number"
          ? { type: Number, value }
          : { type: String, value: String(value) },
    ),
  );
  return writeXlsxFile(cells).toBuffer();
}

/** The fixture sheet with its codes made unique to this run. */
async function fixtureSheet(prefix: string) {
  const data = await readSheet(`${FIXTURES}/products.xlsx`);
  const swapped = data.map((row, index) =>
    row.map((cell) =>
      index > 0 && typeof cell === "string" ? cell.replace(/^IMP-/, prefix) : (cell as Cell),
    ),
  );
  return { headers: swapped[0], buffer: await xlsx(swapped) };
}

const photo = (name: string, prefix: string) => ({
  name: name.replace(/^IMP-/, prefix),
  mimeType: "image/jpeg",
  buffer: readFileSync(`${FIXTURES}/${name}`),
});

async function chooseSheet(page: Page, buffer: Buffer) {
  await page.getByTestId("sheet-input").setInputFiles({
    name: "products.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByTestId("import-review")).toBeVisible();
}

async function confirmImport(page: Page) {
  await page.getByTestId("import-confirm").click();
  await expect(page.getByTestId("import-done")).toBeVisible({ timeout: 90_000 });
  return (await page.getByTestId("import-result").textContent())?.trim();
}

async function openImport(page: Page) {
  await page.goto("/admin/products/import");
  await expect(page.getByRole("heading", { level: 1, name: "استيراد المنتجات" })).toBeVisible();
}

const listRow = async (page: Page, code: string) => {
  await page.goto(`/admin/products?q=${encodeURIComponent(code)}`);
  return page.getByTestId(`product-row-${code}`);
};

test("the owner imports products and photos from a sheet, then runs the same files again", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const prefix = `I${Date.now().toString(36).toUpperCase()}-`;
  const [newCode, simpleCode, oldCode, badCode] = ["NEW", "SIMPLE", "OLD", "BAD"].map(
    (name) => `${prefix}${name}`,
  );

  // AC-1: the list's button opens the page, empty state first.
  await signInAdmin(page, accounts!, "/admin/products");
  await page.getByTestId("product-import-link").click();
  await expect(page).toHaveURL(/\/admin\/products\/import$/);
  await expect(page.getByTestId("import-review")).toHaveCount(0);
  await checkA11y(page);

  // AC-2: the template, three sheets, the products sheet holding only the headers.
  const download = page.waitForEvent("download");
  await page.getByTestId("template-download").click();
  const template = await download;
  expect(template.suggestedFilename()).toBe("skf-products-template.xlsx");
  const sheets = await readXlsxFile(await template.path());
  expect(sheets.map((sheet) => sheet.sheet)).toEqual(["المنتجات", "مثال", "القوائم"]);
  const fixture = await fixtureSheet(prefix);
  expect(sheets[0].data.filter((row) => row.some((cell) => cell !== null))).toEqual([
    fixture.headers,
  ]);
  expect(sheets[2].data[0]).toEqual(["القسم الرئيسي", "القسم الفرعي", "الألوان"]);

  // The product the sheet will update, made by a first, one row import.
  const headers = fixture.headers.map(String);
  const oneRow = headers.map((header) =>
    header === "الكود"
      ? oldCode
      : header === "الاسم"
        ? "ثريا قديمة للاستيراد"
        : header === "القسم الرئيسي"
          ? "ثريات الاستيراد"
          : header === "السعر"
            ? 100
            : null,
  );
  await chooseSheet(page, await xlsx([headers, oneRow]));
  expect(await confirmImport(page)).toBe("تم: 1 جديد · 0 محدّث · 0 صورة · لم يُستورد: 0");
  await page.getByRole("button", { name: "استيراد ملف آخر" }).click();
  await expect(page.getByTestId("import-review")).toHaveCount(0);

  // AC-14: the review of 3 products to write, the bad price row, and the unmatched photo.
  const photos = ["IMP-NEW.jpg", "IMP-NEW_2.jpg", "IMP-NONE.jpg"].map((name) =>
    photo(name, prefix),
  );
  await chooseSheet(page, fixture.buffer);
  await page.getByTestId("photos-input").setInputFiles(photos);
  await expect(page.getByTestId("photos-chosen")).toHaveText("الصور المختارة: 3");
  await expect(page.getByTestId("review-items").getByRole("listitem")).toHaveCount(3);
  await expect(page.getByTestId(`review-item-${newCode}`)).toContainText("الصور: 2");
  await expect(page.getByTestId(`review-item-${oldCode}`)).toContainText("تحديث");
  await expect(page.getByTestId("chip-ok")).toHaveText("صفوف سليمة: 4");
  await expect(page.getByTestId("chip-problems")).toHaveText("تحتاج إصلاحاً: 1");
  await expect(page.getByTestId("chip-photos")).toHaveText("صور بلا منتج: 1");
  const problems = page.getByTestId("problem-row");
  await expect(problems).toHaveCount(2);
  await expect(problems.nth(0)).toContainText("سعر غير صالح");
  await expect(problems.nth(0)).toContainText("6");
  await expect(problems.nth(1)).toContainText(`${prefix}NONE.jpg`);
  await expect(problems.nth(1)).toContainText("صورة بلا منتج مطابق");
  await checkA11y(page);

  // AC-15: confirm, then the result line counted from the run.
  expect(await confirmImport(page)).toBe("تم: 2 جديد · 1 محدّث · 2 صورة · لم يُستورد: 1");
  await expect(page.getByTestId("import-status")).toHaveText(
    "تم: 2 جديد · 1 محدّث · 2 صورة · لم يُستورد: 1",
  );
  await checkA11y(page);

  // AC-17: the new product is hidden with its from price and 2 photos, the update has its new
  // price, and the bad product does not exist.
  const created = await listRow(page, newCode);
  await expect(created.getByTestId("product-status")).toHaveText("مخفي");
  await expect(created.getByTestId("product-price")).toHaveText("من ₪450");
  await expect(created.getByTestId("product-options")).toHaveText("2 أحجام · 2 ألوان");
  await expect((await listRow(page, simpleCode)).getByTestId("product-price")).toHaveText("₪120");
  await expect((await listRow(page, oldCode)).getByTestId("product-price")).toHaveText("₪175");
  await listRow(page, badCode);
  await expect(page.getByTestId(`product-row-${badCode}`)).toHaveCount(0);

  await (await listRow(page, newCode)).getByRole("link", { name: /^تعديل/ }).click();
  await expect(page.getByTestId("photo-tile")).toHaveCount(2);

  // Running the same files again updates the same products and replaces the same photos.
  await openImport(page);
  await chooseSheet(page, fixture.buffer);
  await page.getByTestId("photos-input").setInputFiles(photos);
  await expect(page.getByTestId(`review-item-${newCode}`)).toContainText("تحديث");
  expect(await confirmImport(page)).toBe("تم: 0 جديد · 3 محدّث · 2 صورة · لم يُستورد: 1");
  await expect((await listRow(page, newCode)).getByTestId("product-price")).toHaveText("من ₪450");
  await (await listRow(page, newCode)).getByRole("link", { name: /^تعديل/ }).click();
  await expect(page.getByTestId("photo-tile")).toHaveCount(2);
});

test("a file the import cannot read shows the notice banner and nothing else", async ({ page }) => {
  await signInAdmin(page, accounts!, "/admin/products/import");
  await page.getByTestId("sheet-input").setInputFiles({
    name: "products.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: await xlsx([["الكود", "الحجم", "السعر"]]),
  });
  await expect(page.getByTestId("import-banner")).toContainText("العمود «الألوان» غير موجود");
  await expect(page.getByTestId("import-review")).toHaveCount(0);

  await page.getByTestId("sheet-input").setInputFiles({
    name: "products.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByTestId("import-banner")).toContainText("نوع الملف غير مدعوم");
});

test("a CSV saved by Excel in Arabic, with semicolons and a BOM, reads like the xlsx", async ({
  page,
}) => {
  const code = `C${Date.now().toString(36).toUpperCase()}`;
  await signInAdmin(page, accounts!, "/admin/products/import");
  const csv = `﻿الكود;الاسم;القسم الرئيسي;الحجم;السعر;الألوان\r\n${code};ثريا ملف نصي;ثريات الاستيراد;;99;\r\n`;
  await page.getByTestId("sheet-input").setInputFiles({
    name: "products.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  // Chosen while the sheet may still be reading: kept, not dropped.
  await page.getByTestId("photos-input").setInputFiles({
    name: `${code}.jpg`,
    mimeType: "image/jpeg",
    buffer: readFileSync(`${FIXTURES}/IMP-NEW.jpg`),
  });
  await expect(page.getByTestId("photos-chosen")).toHaveText("الصور المختارة: 1");
  await expect(page.getByTestId(`review-item-${code}`)).toContainText("جديد");
  await expect(page.getByTestId(`review-item-${code}`)).toContainText("الصور: 1");
  await expect(page.getByTestId("problem-row")).toHaveCount(0);
});
