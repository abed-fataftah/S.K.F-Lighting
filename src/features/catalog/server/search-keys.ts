import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { products, productVariants } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { buildSearchText, sizeKey } from "../search-text";

// The stored search keys (spec 0010 AC-7): `products.search_text` and `product_variants.size_key`
// always equal what the pure rules give for the current row. `refreshSearchKeys` runs inside the
// transaction of any write to a name, a code, an option code, or a size label (the editor save and
// the import through `saveProductInDb`, the dev seed, the test helper); the backfill repairs drift.
// The keys are derived, so writing them leaves `updated_at` alone, and an unchanged row is skipped.

type Db = Database | Transaction;

type KeyOptions = readonly {
  readonly id: string;
  readonly code: string | null;
  readonly sizeLabel: string | null;
  readonly archivedAt: Date | null;
}[];

/** The keys one product should hold, from its name, code, and options in `sort` order. */
export function productSearchKeys(
  product: { readonly name: string; readonly code: string },
  options: KeyOptions,
) {
  return {
    searchText: buildSearchText(
      product.name,
      product.code,
      options.filter((option) => option.archivedAt === null).map((option) => option.code),
    ),
    sizeKeys: options.map((option) => ({ id: option.id, sizeKey: sizeKey(option.sizeLabel) })),
  };
}

/** Writes the keys; returns how many rows it changed (a row already right is not written). */
export async function writeSearchKeys(
  db: Db,
  productId: string,
  keys: ReturnType<typeof productSearchKeys>,
): Promise<number> {
  const product = await db.execute(sql`
    update ${products} set search_text = ${keys.searchText}
    where id = ${productId} and search_text is distinct from ${keys.searchText}`);
  if (!keys.sizeKeys.length) return product.count;
  const options = await db.execute(sql`
    update ${productVariants} as t set size_key = x.size_key
    from (values ${sql.join(
      keys.sizeKeys.map((row) => sql`(${row.id}::uuid, ${row.sizeKey}::text)`),
      sql`, `,
    )}) as x(id, size_key)
    where t.id = x.id and t.size_key is distinct from x.size_key`);
  return product.count + options.count;
}

async function readKeyInputs(db: Db, productId: string) {
  const [product] = await db
    .select({ name: products.name, code: products.code })
    .from(products)
    .where(eq(products.id, productId));
  if (!product) throw new Error("refreshSearchKeys: product not found");
  const options = await db
    .select({
      id: productVariants.id,
      code: productVariants.code,
      sizeLabel: productVariants.sizeLabel,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.sort), asc(productVariants.id));
  return { product, options };
}

/** Reads the product's name, code, and options inside the caller's transaction, then writes both keys. */
export async function refreshSearchKeys(tx: Db, productId: string): Promise<void> {
  const { product, options } = await readKeyInputs(tx, productId);
  await writeSearchKeys(tx, productId, productSearchKeys(product, options));
}

export const BACKFILL_BATCH_SIZE = 200;

export type BackfillCount = { readonly products: number; readonly options: number };

/**
 * `pnpm db:backfill-search` (AC-7): recomputes both keys for every product, 200 at a time by id,
 * and writes only the rows whose stored value differs. A second run changes nothing.
 */
export async function backfillSearchKeys(
  db: Db,
  batchSize = BACKFILL_BATCH_SIZE,
): Promise<BackfillCount> {
  let changedProducts = 0;
  let changedOptions = 0;
  let after: string | null = null;
  for (;;) {
    const batch = await db
      .select({
        id: products.id,
        name: products.name,
        code: products.code,
        searchText: products.searchText,
      })
      .from(products)
      .where(after === null ? undefined : sql`${products.id} > ${after}`)
      .orderBy(asc(products.id))
      .limit(batchSize);
    if (!batch.length) break;
    after = batch[batch.length - 1].id;

    const options = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        code: productVariants.code,
        sizeLabel: productVariants.sizeLabel,
        sizeKey: productVariants.sizeKey,
        archivedAt: productVariants.archivedAt,
      })
      .from(productVariants)
      .where(
        sql`${productVariants.productId} in (${sql.join(
          batch.map((row) => sql`${row.id}::uuid`),
          sql`, `,
        )})`,
      )
      .orderBy(asc(productVariants.sort), asc(productVariants.id));

    for (const product of batch) {
      const own = options.filter((option) => option.productId === product.id);
      const keys = productSearchKeys(product, own);
      const stored = new Map(own.map((option) => [option.id, option.sizeKey]));
      const stale = {
        searchText: keys.searchText,
        sizeKeys: keys.sizeKeys.filter((row) => stored.get(row.id) !== row.sizeKey),
      };
      const productStale = product.searchText !== keys.searchText;
      if (!productStale && !stale.sizeKeys.length) continue;
      await writeSearchKeys(db, product.id, stale);
      if (productStale) changedProducts += 1;
      changedOptions += stale.sizeKeys.length;
    }
  }
  return { products: changedProducts, options: changedOptions };
}
