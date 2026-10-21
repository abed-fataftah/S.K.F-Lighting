import "server-only";
import { asc, eq, like, or, sql } from "drizzle-orm";
import { categories, products, productVariants } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { ProductFormInput } from "../schemas";
import { buildProductSlug, nextFreeSlug, slugify } from "../slug";

// The database half of `createProduct` (spec 0004 AC-2): one `active`, available product with one
// default variant, and a new top level category when a new name is typed. All in one transaction.

export type CreateProductOutcome =
  | { readonly kind: "created"; readonly productId: string; readonly slug: string }
  | { readonly kind: "code_taken" }
  | { readonly kind: "category_missing" }
  | { readonly kind: "slug_taken" };

/** A typed category name reuses a category with that name; otherwise a new top level one. */
async function findOrCreateCategory(tx: Transaction, name: string): Promise<string> {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(sql`btrim(${categories.name})`, name))
    .orderBy(sql`${categories.parentId} nulls first`, asc(categories.sort))
    .limit(1);
  if (existing) return existing.id;

  const base = slugify(name);
  const clashes = await tx
    .select({ slug: categories.slug })
    .from(categories)
    .where(or(eq(categories.slug, base), like(categories.slug, `${base}-%`)));
  const [created] = await tx
    .insert(categories)
    .values({
      name,
      slug: nextFreeSlug(
        base,
        clashes.map((row) => row.slug),
      ),
      parentId: null,
      sort: 0,
      isVisible: true,
    })
    .returning({ id: categories.id });
  return created.id;
}

async function categoryExists(tx: Transaction, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return !!row;
}

// Thrown inside the transaction when the insert hit a unique code or slug, so a category made
// for this product rolls back with it.
class Clash extends Error {}

export async function createProductInDb(
  db: Database | Transaction,
  input: ProductFormInput,
): Promise<CreateProductOutcome> {
  const codeTaken = async () =>
    (await db.select({ id: products.id }).from(products).where(eq(products.code, input.code)))
      .length > 0;

  if (await codeTaken()) return { kind: "code_taken" };

  try {
    return await db.transaction(async (tx): Promise<CreateProductOutcome> => {
      // A typed new name wins over the select.
      const categoryId = input.newCategoryName
        ? await findOrCreateCategory(tx, input.newCategoryName)
        : input.categoryId && (await categoryExists(tx, input.categoryId))
          ? input.categoryId
          : null;
      if (!categoryId) return { kind: "category_missing" };

      const slug = buildProductSlug(input.name, input.code);
      const [product] = await tx
        .insert(products)
        .values({
          categoryId,
          code: input.code,
          name: input.name,
          slug,
          status: "active",
          isAvailable: true,
        })
        .onConflictDoNothing()
        .returning({ id: products.id });
      if (!product) throw new Clash();

      await tx
        .insert(productVariants)
        .values({ productId: product.id, price: input.price, isDefault: true, isAvailable: true });
      return { kind: "created", productId: product.id, slug };
    });
  } catch (error) {
    if (!(error instanceof Clash)) throw error;
    return (await codeTaken()) ? { kind: "code_taken" } : { kind: "slug_taken" };
  }
}
