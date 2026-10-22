import { expect, type Page } from "@playwright/test";

// Categories are made on /admin/categories (spec 0008 AC-17): the product editor only picks one.
// Shared by the flows that need a category before they add a product.

/** On the categories page (signed in), adds the main `name` unless it is already there. */
export async function ensureCategory(page: Page, name: string) {
  await page.goto("/admin/categories");
  await expect(page.getByRole("heading", { level: 1, name: "الأقسام" })).toBeVisible();
  if (await page.getByTestId(`category-${name}`).count()) return;
  await page.getByTestId("category-add-main").click();
  const dialog = page.getByTestId("category-dialog");
  await dialog.getByLabel("اسم القسم").fill(name);
  await dialog.getByTestId("category-save").click();
  await expect(page.getByTestId(`category-${name}`)).toBeVisible();
}

/** Picks the main category in the product editor by its name. */
export async function chooseCategory(page: Page, name: string) {
  await page.getByLabel("القسم الرئيسي").selectOption({ label: name });
}
