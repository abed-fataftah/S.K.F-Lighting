import "server-only";
import { and, asc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import {
  categories,
  colours,
  orderLines,
  productMedia,
  products,
  productVariants,
} from "@/server/db/schema";
import { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-error";
import type { Database, Transaction } from "@/server/db/types";
import { orderMedia } from "../media-rules";
import { optionKey, type ProductEditorData } from "../schemas";
import { buildProductSlug } from "../slug";
import { planVariants, tempLabel, type VariantPlan } from "../variant-plan";
import { refreshSearchKeys } from "./search-keys";

// The database half of `saveProduct` (spec 0006 AC-2 to AC-13, saveProduct order of work, step 3):
// one transaction that checks the version, resolves the category and colours, reconciles the
// variants with `planVariants`, replaces the media rows, and refreshes the search keys. Storage is checked before and cleaned
// after, in the action.

export type SaveRefusal =
  | { readonly kind: "stale" }
  | { readonly kind: "not_found" }
  | { readonly kind: "archived" }
  | { readonly kind: "code_taken" }
  | { readonly kind: "code_changed" }
  | { readonly kind: "category_required" }
  | {
      readonly kind: "colour_invalid";
      readonly index: number;
      readonly reason: "duplicate" | "missing";
    };

export type SaveOutcome =
  | {
      readonly kind: "saved";
      readonly id: string;
      readonly slug: string;
      readonly version: number;
      readonly status: "active" | "hidden";
      /** The main category and the sub (if any) now stored, for the editor's selects. */
      readonly category: { readonly mainId: string; readonly subId: string | null };
    }
  | SaveRefusal;

/** Thrown inside the transaction to roll it back and answer with an expected refusal. */
class Refused extends Error {
  constructor(readonly outcome: SaveRefusal) {
    super(outcome.kind);
  }
}

type Tx = Transaction;

/** Why an update matched no row, in the spec's order: gone, archived, else someone saved first. */
export async function whyNoRow(tx: Tx | Database, id: string): Promise<SaveRefusal> {
  const [row] = await tx
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!row) return { kind: "not_found" };
  return row.status === "archived" ? { kind: "archived" } : { kind: "stale" };
}

type ResolvedCategory = { readonly mainId: string; readonly subId: string | null };

/** The stored category is the sub when one is chosen under the main, else the main (AC-18). */
const storedCategory = (category: ResolvedCategory) => category.subId ?? category.mainId;

async function resolveCategory(tx: Tx, data: ProductEditorData): Promise<ResolvedCategory> {
  if (!data.categoryId) throw new Refused({ kind: "category_required" });

  const [main] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, data.categoryId), isNull(categories.parentId)))
    .limit(1);
  if (!main) throw new Refused({ kind: "category_required" });
  if (!data.subCategoryId) return { mainId: main.id, subId: null };

  const [sub] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, data.subCategoryId), eq(categories.parentId, main.id)))
    .limit(1);
  if (!sub) throw new Refused({ kind: "category_required" });
  return { mainId: main.id, subId: sub.id };
}

/** A typed colour reuses the listed one with the same name (tidied, any case), else is created (AC-5). */
async function findOrCreateColour(tx: Tx, name: string): Promise<string> {
  const [listed] = await tx
    .select({ id: colours.id })
    .from(colours)
    .where(eq(sql`lower(${colours.name})`, optionKey(name)))
    .orderBy(asc(colours.sort), asc(colours.name))
    .limit(1);
  if (listed) return listed.id;
  const [created] = await tx
    .insert(colours)
    .values({ name, hex: null, sort: 0 })
    .onConflictDoNothing({ target: colours.name })
    .returning({ id: colours.id });
  if (created) return created.id;
  const [raced] = await tx.select({ id: colours.id }).from(colours).where(eq(colours.name, name));
  return raced.id;
}

async function resolveColours(tx: Tx, rows: ProductEditorData["colours"]): Promise<string[]> {
  const listedIds = rows.flatMap((row) => (row.colourId ? [row.colourId] : []));
  const known = new Set(
    listedIds.length
      ? (
          await tx.select({ id: colours.id }).from(colours).where(inArray(colours.id, listedIds))
        ).map((row) => row.id)
      : [],
  );

  const ids: string[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.colourId && !known.has(row.colourId)) {
      throw new Refused({ kind: "colour_invalid", index, reason: "missing" });
    }
    const id = row.colourId ?? (await findOrCreateColour(tx, row.newName!));
    // A new name that turned out to be a colour already on the product.
    if (ids.includes(id)) throw new Refused({ kind: "colour_invalid", index, reason: "duplicate" });
    ids.push(id);
  }
  return ids;
}

/** Variants an order line points at (and, from feature 21, a draft line): archived, never deleted. */
async function referencedVariantIds(tx: Tx, productId: string): Promise<ReadonlySet<string>> {
  const rows = await tx
    .selectDistinct({ id: orderLines.variantId })
    .from(orderLines)
    .where(eq(orderLines.productId, productId));
  return new Set(rows.map((row) => row.id));
}

/** Runs the plan in the spec's order, so neither the unique labels nor the one default trip. */
async function applyPlan(tx: Tx, productId: string, plan: VariantPlan): Promise<void> {
  const v = productVariants;
  if (plan.deletes.length) await tx.delete(v).where(inArray(v.id, plan.deletes));
  if (plan.archives.length) {
    await tx
      .update(v)
      .set({ archivedAt: sql`now()`, isDefault: false })
      .where(inArray(v.id, plan.archives));
  }
  await tx
    .update(v)
    .set({ isDefault: false })
    .where(and(eq(v.productId, productId), eq(v.isDefault, true)));

  for (const relabel of plan.relabels) {
    await tx.update(v).set({ sizeLabel: relabel.sizeLabel }).where(eq(v.id, relabel.id));
  }
  // Pass 1 frees every label that moves, so a swap never meets itself in the unique index.
  for (const update of plan.updates.filter((row) => row.moved)) {
    await tx
      .update(v)
      .set({ sizeLabel: tempLabel(update.id) })
      .where(eq(v.id, update.id));
  }

  // Pass 2 and the restores in one statement.
  const kept = [...plan.updates, ...plan.restores];
  if (kept.length) {
    await tx.execute(sql`
      update ${v} as t set
        size_label = x.size_label, size_sort = x.size_sort, colour_id = x.colour_id, sort = x.sort,
        price = x.price, is_available = x.is_available, archived_at = null, updated_at = now()
      from (values ${sql.join(
        kept.map(
          (row) =>
            sql`(${row.id}::uuid, ${row.sizeLabel}::text, ${row.sizeSort}::int, ${row.colourId}::uuid, ${row.sort}::int, ${row.price}::int, ${row.isAvailable}::boolean)`,
        ),
        sql`, `,
      )}) as x(id, size_label, size_sort, colour_id, sort, price, is_available)
      where t.id = x.id`);
  }

  const inserted = plan.inserts.length
    ? await tx
        .insert(v)
        .values(
          plan.inserts.map((row) => ({
            productId,
            sizeLabel: row.sizeLabel,
            sizeSort: row.sizeSort,
            colourId: row.colourId,
            sort: row.sort,
            price: row.price,
            isAvailable: row.isAvailable,
          })),
        )
        .returning({ id: v.id, sizeLabel: v.sizeLabel, colourId: v.colourId })
    : [];

  const defaultId =
    kept.find((row) => row.key === plan.defaultKey)?.id ??
    inserted.find((row) => {
      const planned = plan.inserts.find((insert) => insert.key === plan.defaultKey);
      return planned && row.sizeLabel === planned.sizeLabel && row.colourId === planned.colourId;
    })?.id;
  if (!defaultId) throw new Error("applyPlan: the default variant was not written");
  await tx.update(v).set({ isDefault: true }).where(eq(v.id, defaultId));
}

/** Deletes the rows no longer wanted first (so a replaced video never trips the one video index). */
async function replaceMedia(tx: Tx, productId: string, media: ProductEditorData["media"]) {
  const wanted = orderMedia(media);
  const keys = wanted.map((item) => item.storageKey);
  await tx
    .delete(productMedia)
    .where(
      and(
        eq(productMedia.productId, productId),
        keys.length ? notInArray(productMedia.storageKey, keys) : undefined,
      ),
    );
  if (!wanted.length) return;
  await tx
    .insert(productMedia)
    .values(
      wanted.map((item) => ({
        productId,
        kind: item.kind,
        storageKey: item.storageKey,
        width: item.width,
        height: item.height,
        sort: item.sort,
      })),
    )
    .onConflictDoUpdate({
      target: productMedia.storageKey,
      set: {
        sort: sql`excluded.sort`,
        width: sql`excluded.width`,
        height: sql`excluded.height`,
        updatedAt: sql`now()`,
      },
      setWhere: sql`${productMedia.productId} = excluded.product_id`,
    });
}

async function writeProduct(tx: Tx, data: ProductEditorData): Promise<SaveOutcome> {
  const status = data.visible ? ("active" as const) : ("hidden" as const);
  const fields = {
    name: data.name,
    description: data.description ?? null,
    specs: data.specs,
    status,
    isAvailable: data.available,
  };

  let slug: string;
  let version: number;
  let category: ResolvedCategory;
  if (data.version === null) {
    // A repeated submit of a create finds its own product already there.
    const [taken] = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, data.id));
    if (taken) throw new Refused({ kind: "stale" });
    slug = buildProductSlug(data.name, data.code);
    version = 1;
    category = await resolveCategory(tx, data);
    await tx.insert(products).values({
      id: data.id,
      code: data.code,
      slug,
      categoryId: storedCategory(category),
      version,
      ...fields,
    });
  } else {
    const [bumped] = await tx
      .update(products)
      .set({ version: sql`${products.version} + 1` })
      .where(
        and(
          eq(products.id, data.id),
          eq(products.version, data.version),
          sql`${products.status} <> 'archived'`,
        ),
      )
      .returning({ code: products.code, slug: products.slug, version: products.version });
    if (!bumped) throw new Refused(await whyNoRow(tx, data.id));
    if (bumped.code !== data.code) throw new Refused({ kind: "code_changed" });
    slug = bumped.slug;
    version = bumped.version;
    category = await resolveCategory(tx, data);
    await tx
      .update(products)
      .set({ categoryId: storedCategory(category), ...fields })
      .where(eq(products.id, data.id));
  }

  const colourIds = await resolveColours(tx, data.colours);
  const existing = await tx
    .select({
      id: productVariants.id,
      sizeLabel: productVariants.sizeLabel,
      sizeSort: productVariants.sizeSort,
      colourId: productVariants.colourId,
      sort: productVariants.sort,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, data.id));
  const plan = planVariants(
    { sizes: data.sizes, colours: colourIds, pairs: data.pairs, price: data.price },
    existing,
    await referencedVariantIds(tx, data.id),
  );
  await applyPlan(tx, data.id, plan);
  await replaceMedia(tx, data.id, data.media);
  // Last, so the keys see the saved name and options (spec 0010 AC-7).
  await refreshSearchKeys(tx, data.id);

  return { kind: "saved", id: data.id, slug, version, status, category };
}

/**
 * Saves the whole product or nothing. A delete that lost a race with a new order line (`23503`)
 * reruns the save once, when the plan then archives that row. Anything unexpected throws.
 */
export async function saveProductInDb(
  db: Database | Transaction,
  data: ProductEditorData,
): Promise<SaveOutcome> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await db.transaction((tx) => writeProduct(tx, data));
    } catch (error) {
      if (error instanceof Refused) return error.outcome;
      if (isUniqueViolation(error, "products_code_unique")) return { kind: "code_taken" };
      if (data.version === null && isUniqueViolation(error, "products_pkey")) {
        return { kind: "stale" };
      }
      if (attempt === 1 && isForeignKeyViolation(error)) continue;
      throw error;
    }
  }
}
