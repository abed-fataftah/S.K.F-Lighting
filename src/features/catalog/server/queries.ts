import "server-only";
import { and, asc, desc, eq, isNull, min } from "drizzle-orm";
import { getDb } from "@/server/db";
import { categories, colours, products, productVariants } from "@/server/db/schema";
import { pickVariantToAdd } from "../sellable";

export const HOME_GRID_SIZE = 24;

export type HomeProduct = {
  readonly slug: string;
  readonly name: string;
  readonly code: string;
  /** The lowest sellable variant price (spec 0002, list price). */
  readonly listPrice: number;
};

// The sellable rule as SQL, for lists; `isSellable` is the same rule in code.
const sellableVariant = and(
  eq(products.status, "active"),
  eq(products.isAvailable, true),
  eq(productVariants.isAvailable, true),
  isNull(productVariants.archivedAt),
);

/** The temporary home grid (spec 0004 AC-3): newest sellable products first, until feature 25. */
export async function listHomeProducts(): Promise<readonly HomeProduct[]> {
  const db = await getDb();
  const rows = await db
    .select({
      slug: products.slug,
      name: products.name,
      code: products.code,
      listPrice: min(productVariants.price),
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(sellableVariant)
    .groupBy(products.id)
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(HOME_GRID_SIZE);
  return rows.map((row) => ({ ...row, listPrice: row.listPrice ?? 0 }));
}

export type ProductPageData = {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly slug: string;
  readonly description: string | null;
  readonly specs: readonly { readonly label: string; readonly value: string }[];
  readonly categoryName: string;
  /** The variant the add button puts in the cart; null shows the product as out of stock. */
  readonly variant: {
    readonly id: string;
    readonly price: number;
    readonly sizeLabel: string | null;
    readonly colourName: string | null;
  } | null;
  /** Shown muted when out of stock: the default variant's price, else the first one's. */
  readonly price: number | null;
};

/** An `active` product by slug, or null for the not found page (spec 0004 AC-3). */
export async function getProductBySlug(slug: string): Promise<ProductPageData | null> {
  const db = await getDb();
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      code: products.code,
      slug: products.slug,
      description: products.description,
      specs: products.specs,
      status: products.status,
      isAvailable: products.isAvailable,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), eq(products.status, "active")))
    .limit(1);
  if (!product) return null;

  const variants = await db
    .select({
      id: productVariants.id,
      price: productVariants.price,
      sizeLabel: productVariants.sizeLabel,
      colourName: colours.name,
      isAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
      isDefault: productVariants.isDefault,
      sort: productVariants.sort,
    })
    .from(productVariants)
    .leftJoin(colours, eq(colours.id, productVariants.colourId))
    .where(eq(productVariants.productId, product.id))
    .orderBy(asc(productVariants.sort), asc(productVariants.sizeSort));

  const picked = pickVariantToAdd(product, variants);
  const fallback = variants.find((variant) => variant.isDefault) ?? variants[0];
  return {
    id: product.id,
    name: product.name,
    code: product.code,
    slug: product.slug,
    description: product.description,
    specs: product.specs,
    categoryName: product.categoryName,
    variant: picked
      ? {
          id: picked.id,
          price: picked.price,
          sizeLabel: picked.sizeLabel,
          colourName: picked.colourName,
        }
      : null,
    price: picked?.price ?? fallback?.price ?? null,
  };
}
