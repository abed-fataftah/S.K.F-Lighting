import "server-only";
import { eq } from "drizzle-orm";
import { listedProduct, parentCategory } from "@/features/catalog/server/storefront-sql";
import { categories, pages, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { SitemapData } from "../sitemap";

// The sitemap's three reads (spec 0026 AC-3, AC-4), run together. Products go through the same
// `listedProduct` rule the pages use, so the sitemap never lists a page that answers 404. Only
// slugs and dates are read, never prices, stock, or anything about customers.

type Db = Database | Transaction;

export async function readSitemapData(db: Db): Promise<SitemapData> {
  const [productRows, categoryRows, pageRows] = await Promise.all([
    db
      .select({
        slug: products.slug,
        categoryId: products.categoryId,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
      .where(listedProduct)
      .orderBy(products.slug),
    db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
        sort: categories.sort,
        isVisible: categories.isVisible,
        updatedAt: categories.updatedAt,
      })
      .from(categories),
    db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages),
  ]);
  return { products: productRows, categories: categoryRows, pages: pageRows };
}
