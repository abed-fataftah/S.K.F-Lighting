import type postgres from "postgres";
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

export type SeededProduct = {
  readonly category: string;
  readonly product: string;
  readonly name: string;
};

/** The dev seed's "ثريات" main category and its first active product, as slugs (scripts/seed-dev.ts). */
export async function seededChandelier(sql: postgres.Sql): Promise<SeededProduct> {
  const [row] = await sql<SeededProduct[]>`
    select c.slug as category, p.slug as product, p.name from categories c
    join products p on p.category_id = c.id
    where c.name = 'ثريات' and c.parent_id is null and p.status = 'active'
    order by p.code limit 1`;
  if (!row) throw new Error("No seeded chandelier: run pnpm db:seed first");
  return row;
}
