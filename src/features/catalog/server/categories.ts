import "server-only";
import { and, asc, count, eq, isNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import { categories, products } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-error";
import {
  buildAdminCategories,
  categorySlugBase,
  planMove,
  type AdminMain,
  type CategoryProductCounts,
  type MoveDirection,
} from "../category-rules";
import { builtCircleLines } from "@/features/home/home-rules";
import { nextFreeSlug } from "../slug";

// Category writes (spec 0008 AC-2 to AC-5, AC-4a) and the shared insert the import's find or
// create uses too (spec 0007 AC-9). Writes lock the sibling rows first (and the parent row for a
// sub), so the name check, `max(sort) + 1`, and a renumbering cannot race. No migration needed.

type Tx = Transaction;
type Db = Database | Transaction;

/** Sibling names compare like this (AC-2): "LED" and "led" clash. Stored names are tidied. */
const sameName = (name: string): SQL =>
  sql`lower(btrim(${categories.name})) = lower(btrim(${name}))`;

const siblingsOf = (parentId: string | null): SQL =>
  parentId === null ? isNull(categories.parentId) : eq(categories.parentId, parentId);

/** Locks every sibling under `parentId` (and the parent row for a sub) until the transaction ends. */
async function lockSiblings(tx: Tx, parentId: string | null) {
  if (parentId !== null) {
    await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, parentId))
      .for("update");
  }
  return tx
    .select({ id: categories.id, name: categories.name, sort: categories.sort })
    .from(categories)
    .where(siblingsOf(parentId))
    .for("update");
}

async function freeSlug(tx: Tx, name: string): Promise<string> {
  const base = categorySlugBase(name);
  const clashes = await tx
    .select({ slug: categories.slug })
    .from(categories)
    .where(or(eq(categories.slug, base), like(categories.slug, `${base}-%`)));
  return nextFreeSlug(
    base,
    clashes.map((row) => row.slug),
  );
}

type NewCategory = {
  readonly name: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly isVisible: boolean;
  readonly homeSubtitle?: string | null;
  readonly imageKey?: string | null;
};

/**
 * Inserts one category with a free slug (`qism` when the name gives none) and `sort` one above its
 * highest sibling, so it goes last. A slug clash from a concurrent insert retries once inside a
 * savepoint; a second clash is thrown to the caller.
 */
export async function insertCategory(
  tx: Tx,
  category: NewCategory,
): Promise<{ readonly id: string; readonly slug: string }> {
  const [{ next }] = await tx
    .select({ next: sql<number>`coalesce(max(${categories.sort}) + 1, 0)`.mapWith(Number) })
    .from(categories)
    .where(siblingsOf(category.parentId));
  const attempt = async () => {
    const slug = await freeSlug(tx, category.name);
    return tx.transaction(async (sp) => {
      const [created] = await sp
        .insert(categories)
        .values({ ...category, slug, sort: next })
        .returning({ id: categories.id, slug: categories.slug });
      return created;
    });
  };
  try {
    return await attempt();
  } catch (error) {
    if (!isUniqueViolation(error, "categories_slug_unique")) throw error;
    return attempt();
  }
}

async function findByName(tx: Tx, name: string, parentId: string | null) {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(sameName(name), siblingsOf(parentId)))
    .orderBy(asc(categories.sort), asc(categories.name), asc(categories.id))
    .limit(1);
  return existing?.id ?? null;
}

/** A typed name reuses a top level category with that name; otherwise a new top level one. */
export async function findOrCreateTopCategory(tx: Tx, name: string): Promise<string> {
  return (
    (await findByName(tx, name, null)) ??
    (await insertCategory(tx, { name, description: null, parentId: null, isVisible: true })).id
  );
}

/** A typed name reuses a child of `mainId` with that name; otherwise a new child of it. */
export async function findOrCreateSubCategory(
  tx: Tx,
  mainId: string,
  name: string,
): Promise<string> {
  return (
    (await findByName(tx, name, mainId)) ??
    (await insertCategory(tx, { name, description: null, parentId: mainId, isVisible: true })).id
  );
}

/**
 * The categories one import product ends in (spec 0007 AC-9), in one short transaction. A filled
 * main finds or makes the main; a sub alone goes under the product's stored main; both empty keep
 * the stored main and sub. Null when a sub has no main to sit under.
 */
export async function ensureImportCategories(
  db: Db,
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

export type CategoryFields = {
  readonly name: string;
  readonly description?: string;
  readonly isVisible: boolean;
  /** Mains only (spec 0011 AC-11); empty is none. */
  readonly homeSubtitle?: string;
  /** Mains only: a key sets the photo, null removes it, undefined leaves it as stored. */
  readonly imageKey?: string | null;
};

/** The circle fields were sent, which only a main may carry (spec 0011 AC-11). */
const sendsCircle = (input: CategoryFields) =>
  input.homeSubtitle !== undefined || input.imageKey !== undefined;

export type CreateOutcome =
  | { readonly kind: "created"; readonly id: string; readonly slug: string }
  | { readonly kind: "name_taken" | "too_deep" | "not_found" | "failed" | "invalid" };

/** Add a main (`parentId` null) or a sub (AC-2, AC-4a). */
export async function createCategoryInDb(
  db: Db,
  input: CategoryFields & { readonly parentId?: string },
): Promise<CreateOutcome> {
  const parentId = input.parentId ?? null;
  if (parentId !== null && sendsCircle(input)) return { kind: "invalid" };
  try {
    return await db.transaction(async (tx): Promise<CreateOutcome> => {
      if (parentId !== null) {
        const [parent] = await tx
          .select({ parentId: categories.parentId })
          .from(categories)
          .where(eq(categories.id, parentId));
        if (!parent) return { kind: "not_found" };
        if (parent.parentId !== null) return { kind: "too_deep" };
      }
      await lockSiblings(tx, parentId);
      if (await findByName(tx, input.name, parentId)) return { kind: "name_taken" };
      const created = await insertCategory(tx, {
        name: input.name,
        description: input.description ?? null,
        parentId,
        isVisible: input.isVisible,
        homeSubtitle: input.homeSubtitle ?? null,
        imageKey: input.imageKey ?? null,
      });
      return { kind: "created", ...created };
    });
  } catch (error) {
    if (isUniqueViolation(error, "categories_slug_unique")) return { kind: "failed" };
    // The parent was deleted between the check and the insert.
    if (isForeignKeyViolation(error)) return { kind: "not_found" };
    throw error;
  }
}

export type UpdateOutcome =
  | {
      readonly kind: "updated";
      readonly id: string;
      /** The circle photo this edit replaced or removed, to remove from Storage after commit. */
      readonly replacedKey: string | null;
    }
  | { readonly kind: "name_taken" | "not_found" | "invalid" };

/**
 * Edit the name, description, visibility, and for a main the circle line and photo; slug, parent,
 * and sort never change (AC-3). Never touches `home_version` (spec 0011 AC-11).
 */
export async function updateCategoryInDb(
  db: Db,
  input: CategoryFields & { readonly id: string },
): Promise<UpdateOutcome> {
  return db.transaction(async (tx): Promise<UpdateOutcome> => {
    const [row] = await tx
      .select({ parentId: categories.parentId, imageKey: categories.imageKey })
      .from(categories)
      .where(eq(categories.id, input.id));
    if (!row) return { kind: "not_found" };
    if (row.parentId !== null && sendsCircle(input)) return { kind: "invalid" };
    await lockSiblings(tx, row.parentId);
    const [clash] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(sameName(input.name), siblingsOf(row.parentId), ne(categories.id, input.id)))
      .limit(1);
    if (clash) return { kind: "name_taken" };
    const updated = await tx
      .update(categories)
      .set({
        name: input.name,
        description: input.description ?? null,
        isVisible: input.isVisible,
        ...(row.parentId === null ? { homeSubtitle: input.homeSubtitle ?? null } : {}),
        ...(input.imageKey === undefined ? {} : { imageKey: input.imageKey }),
      })
      .where(eq(categories.id, input.id))
      .returning({ id: categories.id });
    if (!updated.length) return { kind: "not_found" };
    const replaced =
      input.imageKey !== undefined && row.imageKey !== null && row.imageKey !== input.imageKey;
    return { kind: "updated", id: input.id, replacedKey: replaced ? row.imageKey : null };
  });
}

export type MoveOutcome =
  { readonly kind: "moved"; readonly id: string } | { readonly kind: "not_found" | "at_edge" };

/** One step up or down among siblings, renumbering them `0..n-1` (AC-4). */
export async function moveCategoryInDb(
  db: Db,
  id: string,
  direction: MoveDirection,
): Promise<MoveOutcome> {
  return db.transaction(async (tx): Promise<MoveOutcome> => {
    const [row] = await tx
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, id));
    if (!row) return { kind: "not_found" };
    const plan = planMove(await lockSiblings(tx, row.parentId), id, direction);
    if (plan.kind !== "move") return plan;
    for (const { id: siblingId, sort } of plan.sorts) {
      await tx.update(categories).set({ sort }).where(eq(categories.id, siblingId));
    }
    return { kind: "moved", id };
  });
}

export type DeleteOutcome =
  | {
      readonly kind: "deleted";
      readonly id: string;
      /** Its circle photo, removed from Storage after commit (spec 0011 AC-13). */
      readonly imageKey: string | null;
    }
  | { readonly kind: "not_empty" | "not_found" };

/** Deletes a category with no product in any status and no sub (AC-5); the foreign keys back it. */
export async function deleteCategoryInDb(db: Db, id: string): Promise<DeleteOutcome> {
  try {
    return await db.transaction(async (tx): Promise<DeleteOutcome> => {
      const [row] = await tx
        .select({
          imageKey: categories.imageKey,
          blocked:
            sql<boolean>`(exists (select 1 from ${products} p where p.category_id = ${categories.id}) or exists (select 1 from ${categories} c where c.parent_id = ${categories.id}))`.mapWith(
              Boolean,
            ),
        })
        .from(categories)
        .where(eq(categories.id, id))
        .for("update");
      if (!row) return { kind: "not_found" };
      if (row.blocked) return { kind: "not_empty" };
      await tx.delete(categories).where(eq(categories.id, id));
      return { kind: "deleted", id, imageKey: row.imageKey };
    });
  } catch (error) {
    // A product saved into it, or a sub added, after the check (AC-4a).
    if (isForeignKeyViolation(error)) return { kind: "not_empty" };
    throw error;
  }
}

/**
 * The categories page (AC-1): the tree with counts and whether each one can be deleted, plus each
 * main's built circle line from its menu subs (spec 0011 AC-11).
 */
export async function readAdminCategories(db: Db): Promise<readonly AdminMain[]> {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: categories.id,
        parentId: categories.parentId,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        sort: categories.sort,
        isVisible: categories.isVisible,
        homeSubtitle: categories.homeSubtitle,
        imageKey: categories.imageKey,
      })
      .from(categories),
    db
      .select({
        categoryId: products.categoryId,
        listed: sql<number>`count(*) filter (where ${products.status} = 'active')`.mapWith(Number),
        live: sql<number>`count(*) filter (where ${products.status} <> 'archived')`.mapWith(Number),
        all: count(),
      })
      .from(products)
      .groupBy(products.categoryId),
  ]);
  const byCategory = new Map<string, CategoryProductCounts>(
    counts.map((row) => [row.categoryId, { live: row.live, all: row.all }]),
  );
  const lines = builtCircleLines(rows, new Map(counts.map((row) => [row.categoryId, row.listed])));
  const linesById = new Map(rows.map((row) => [row.id, lines.get(row.slug) ?? null]));
  return buildAdminCategories(rows, byCategory, linesById);
}
