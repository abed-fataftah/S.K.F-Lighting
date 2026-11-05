import "server-only";
import { asc, eq } from "drizzle-orm";
import { inCategoryOrder } from "@/features/catalog/category-rules";
import { readCatalogTree } from "@/features/catalog/server/queries";
import { parentCategory } from "@/features/catalog/server/storefront-sql";
import { routes } from "@/lib/routes";
import { requireAdminPage } from "@/server/auth/admin";
import { getDb } from "@/server/db";
import { categories, featuredProducts, products, shopSettings } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { readBannerRows } from "./banner-rows";
import {
  pickerColumns,
  toEditorBanner,
  toPickerProduct,
  type EditorBanner,
  type PickerProduct,
} from "./homepage-db";

// What `/admin/homepage` opens with (spec 0011 AC-8, API surface `getHomepageEditor`).

type Db = Database | Transaction;

export type EditorMain = {
  readonly id: string;
  readonly name: string;
  readonly isVisible: boolean;
  /** The main and its shown subs hold no listed product (spec 0008 AC-10 rule). */
  readonly isEmpty: boolean;
  readonly showOnHome: boolean;
};

/** Every category for the banner dialog's select, subs under their main, in category order. */
export type EditorCategory = {
  readonly id: string;
  readonly name: string;
  readonly isVisible: boolean;
  readonly subs: readonly {
    readonly id: string;
    readonly name: string;
    readonly isVisible: boolean;
  }[];
};

export type HomepageEditorData = {
  readonly version: number;
  readonly banners: readonly EditorBanner[];
  readonly featured: readonly PickerProduct[];
  readonly mains: readonly EditorMain[];
  readonly categories: readonly EditorCategory[];
};

export async function readHomepageEditor(db: Db): Promise<HomepageEditorData> {
  const [[settings], bannerRows, featuredRows, tree] = await Promise.all([
    db
      .select({ version: shopSettings.homeVersion })
      .from(shopSettings)
      .where(eq(shopSettings.id, 1)),
    readBannerRows(db),
    db
      .select(pickerColumns)
      .from(featuredProducts)
      .innerJoin(products, eq(products.id, featuredProducts.productId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
      .orderBy(asc(featuredProducts.sort), asc(products.id)),
    readCatalogTree(db),
  ]);

  // The raw rows, not `buildNavigation`, which drops exactly the hidden and empty mains.
  const ordered = inCategoryOrder(tree.categories);
  const listedOf = (id: string) => tree.listed.get(id) ?? 0;
  const mains = ordered
    .filter((row) => row.parentId === null)
    .map((main) => {
      const listed =
        listedOf(main.id) +
        ordered
          .filter((sub) => sub.parentId === main.id && sub.isVisible)
          .reduce((sum, sub) => sum + listedOf(sub.id), 0);
      return {
        id: main.id,
        name: main.name,
        isVisible: main.isVisible,
        isEmpty: listed === 0,
        showOnHome: main.showOnHome,
      };
    });

  const categoryChoices = ordered
    .filter((row) => row.parentId === null)
    .map((main) => ({
      id: main.id,
      name: main.name,
      isVisible: main.isVisible,
      subs: ordered
        .filter((sub) => sub.parentId === main.id)
        .map(({ id, name, isVisible }) => ({ id, name, isVisible })),
    }));

  return {
    version: settings?.version ?? 0,
    banners: bannerRows.map(toEditorBanner),
    featured: featuredRows.map(toPickerProduct),
    mains,
    categories: categoryChoices,
  };
}

/** The editor's data; the guard runs here too, so a page that forgets the layout shows nothing. */
export async function getHomepageEditor(): Promise<HomepageEditorData> {
  await requireAdminPage(routes.admin.homepage);
  return readHomepageEditor(await getDb());
}
