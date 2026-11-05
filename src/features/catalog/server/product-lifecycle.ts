import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { orderLines, products } from "@/server/db/schema";
import { isForeignKeyViolation } from "@/server/db/pg-error";
import type { Database, Transaction } from "@/server/db/types";

// Delete, archive, and restore (spec 0006 AC-12). A product nothing has ordered is deleted with its
// variants and media rows (cascade); an ordered one is archived so its orders stay exact.

export type DeleteOutcome =
  | { readonly kind: "deleted" }
  | { readonly kind: "archived"; readonly version: number }
  | { readonly kind: "stale" }
  | { readonly kind: "not_found" }
  | { readonly kind: "already_archived" };

/** True when an order line (and, from feature 21, a draft line) points at the product. */
async function isReferenced(tx: Transaction, productId: string): Promise<boolean> {
  const [row] = await tx
    .select({ one: sql`1` })
    .from(orderLines)
    .where(eq(orderLines.productId, productId))
    .limit(1);
  return !!row;
}

async function deleteOrArchive(
  tx: Transaction,
  id: string,
  version: number,
): Promise<DeleteOutcome> {
  const [row] = await tx
    .select({ status: products.status, version: products.version })
    .from(products)
    .where(eq(products.id, id))
    .for("update");
  if (!row) return { kind: "not_found" };
  if (row.status === "archived") return { kind: "already_archived" };
  if (row.version !== version) return { kind: "stale" };

  if (await isReferenced(tx, id)) {
    const [archived] = await tx
      .update(products)
      .set({ status: "archived", version: sql`${products.version} + 1` })
      .where(eq(products.id, id))
      .returning({ version: products.version });
    return { kind: "archived", version: archived.version };
  }
  await tx.delete(products).where(eq(products.id, id));
  return { kind: "deleted" };
}

/** A delete that lost a race with a new order line (`23503`) runs once more, and then archives. */
export async function deleteProductInDb(
  db: Database | Transaction,
  id: string,
  version: number,
): Promise<DeleteOutcome> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.transaction((tx) => deleteOrArchive(tx, id, version));
    } catch (error) {
      if (attempt === 1 && isForeignKeyViolation(error)) continue;
      throw error;
    }
  }
}

export type RestoreOutcome =
  | { readonly kind: "restored"; readonly version: number }
  | { readonly kind: "stale" }
  | { readonly kind: "not_found" }
  | { readonly kind: "not_archived" };

/** An archived product comes back hidden, so the owner checks it before showing it again. */
export async function restoreProductInDb(
  db: Database | Transaction,
  id: string,
  version: number,
): Promise<RestoreOutcome> {
  const [restored] = await db
    .update(products)
    .set({ status: "hidden", version: sql`${products.version} + 1` })
    .where(and(eq(products.id, id), eq(products.version, version), eq(products.status, "archived")))
    .returning({ version: products.version });
  if (restored) return { kind: "restored", version: restored.version };

  const [row] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return { kind: "not_found" };
  return row.status === "archived" ? { kind: "stale" } : { kind: "not_archived" };
}
