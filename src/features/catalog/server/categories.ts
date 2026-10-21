import "server-only";
import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";
import { categories } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { nextFreeSlug, slugify } from "../slug";

// Find or create a category by its typed name (spec 0006 AC-18, spec 0007 AC-9). Stored names were
// tidied on insert, so a tidied name compares with `btrim(name)`. A new category gets a slug unique
// across all categories, `sort` 0, and is visible. Feature 9 may reuse or replace these.

type Tx = Transaction;

async function insertCategory(tx: Tx, name: string, parentId: string | null): Promise<string> {
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
      parentId,
      sort: 0,
      isVisible: true,
    })
    .returning({ id: categories.id });
  return created.id;
}

/** A typed name reuses a top level category with that name; otherwise a new top level one. */
export async function findOrCreateTopCategory(tx: Tx, name: string): Promise<string> {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(sql`btrim(${categories.name})`, name), isNull(categories.parentId)))
    .orderBy(asc(categories.sort))
    .limit(1);
  return existing?.id ?? insertCategory(tx, name, null);
}

/** A typed name reuses a child of `mainId` with that name; otherwise a new child of it. */
export async function findOrCreateSubCategory(
  tx: Tx,
  mainId: string,
  name: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(sql`btrim(${categories.name})`, name), eq(categories.parentId, mainId)))
    .orderBy(asc(categories.sort))
    .limit(1);
  return existing?.id ?? insertCategory(tx, name, mainId);
}

/**
 * The categories one import product ends in (AC-9), in one short transaction. A filled main finds
 * or makes the main; a sub alone goes under the product's stored main; both empty keep the
 * stored main and sub. Null when a sub has no main to sit under.
 */
export async function ensureImportCategories(
  db: Database | Transaction,
  names: { readonly main?: string; readonly sub?: string },
  stored: { readonly mainId: string; readonly subId: string | null } | null,
): Promise<{ readonly mainId: string; readonly subId: string | null } | null> {
  if (!names.main && !names.sub) return stored;
  return db.transaction(async (tx) => {
    const mainId = names.main ? await findOrCreateTopCategory(tx, names.main) : stored?.mainId;
    if (!mainId) return null;
    const subId = names.sub ? await findOrCreateSubCategory(tx, mainId, names.sub) : null;
    return { mainId, subId };
  });
}
