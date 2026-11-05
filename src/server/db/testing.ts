// Shared setup for `*.db.test.ts`: they run against the local Supabase database only, one file at a
// time, and roll back everything except the tests that must commit (spec 0002, testing note).
import { existsSync } from "node:fs";
import { expect } from "vitest";
import { refreshSearchKeys } from "@/features/catalog/server/search-keys";
import { categories, colours, products, productVariants } from "./schema";
import { isLocalDatabaseUrl } from "./local";
import { pgErrorOf } from "./pg-error";
import type { Database, Transaction } from "./types";

if (!process.env.DATABASE_URL_DIRECT && existsSync(".env.local")) process.loadEnvFile(".env.local");

/** False skips the database suites: CI checks and any machine without `pnpm db:start`. */
export const hasLocalDb = isLocalDatabaseUrl(process.env.DATABASE_URL_DIRECT);

if (!hasLocalDb) {
  console.warn(
    "Skipping database tests: DATABASE_URL_DIRECT is not the local Supabase database " +
      "(127.0.0.1:54322). Run `pnpm db:start` and `pnpm db:migrate`, then try again.",
  );
}

class Rollback extends Error {}

/** Runs `fn` in a transaction that always rolls back, and returns what `fn` returned. */
export async function withRollback<T>(db: Database, fn: (tx: Transaction) => Promise<T>) {
  let result: T | undefined;
  await db
    .transaction(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof Rollback)) throw error;
    });
  return result as T;
}

/**
 * Asserts that `run` fails on the named constraint. It runs inside a savepoint, so the
 * surrounding test transaction stays usable for the next assertion.
 */
export async function expectViolation(
  tx: Transaction,
  constraint: string,
  run: (sp: Transaction) => Promise<unknown>,
) {
  const error = await tx.transaction(run).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error, `expected a violation of ${constraint}`).not.toBeNull();
  expect(pgErrorOf(error)?.constraint_name).toBe(constraint);
}

/** A category, a colour, and a simple product with its one default variant, all with test codes. */
export async function insertSimpleProduct(tx: Transaction, code = "TEST-1", price = 12_500) {
  const [category] = await tx
    .insert(categories)
    .values({ name: "فئة اختبار", slug: `test-${code.toLowerCase()}` })
    .returning();
  const [colour] = await tx
    .insert(colours)
    .values({ name: `لون ${code}`, hex: "#C9A227" })
    .returning();
  const [product] = await tx
    .insert(products)
    .values({ categoryId: category.id, code, name: "ثريا اختبار", slug: `test-product-${code}` })
    .returning();
  const [variant] = await tx
    .insert(productVariants)
    .values({ productId: product.id, price, isDefault: true })
    .returning();
  await refreshSearchKeys(tx, product.id);
  return { category, colour, product, variant };
}
