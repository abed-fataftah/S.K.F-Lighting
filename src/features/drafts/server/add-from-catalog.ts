import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { firstProductImageKey } from "@/features/catalog/server/product-image-sql";
import {
  categoryShown,
  listedProduct,
  parentCategory,
} from "@/features/catalog/server/storefront-sql";
import { isSellable } from "@/features/catalog/sellable";
import { categories, draftLines, drafts, products, productVariants } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { planCatalogAdd } from "../catalog-add";
import type { DraftProduct } from "../draft-view";
import { MAX_DRAFTS, type AddToDraftInput } from "../schemas";
import { insertNamedDraft, isDraftNameClash } from "./drafts-db";
import { afterClash, lineCount, touch } from "./lines-db";
import { lineOrder, readMyDrafts, readOptions, toOption, type ProductRule } from "./read-draft";
import { QUICK_SEARCH_OPTIONS } from "./search";

// Add to draft from the catalog (spec 0021 Feature design). It writes spec 0020's drafts and
// lines as they are, under the same locks and limits as quick order, so a line added here cannot
// be told from one typed there.

type Db = Database | Transaction;

const shown = sql<boolean>`coalesce(${categoryShown}, false)`.mapWith(Boolean);
const listed = sql<boolean>`coalesce(${listedProduct}, false)`.mapWith(Boolean);

export type PickerDraft = {
  readonly id: string;
  readonly name: string;
  readonly lineCount: number;
};

export type DraftPickerData = {
  readonly drafts: readonly PickerDraft[];
  readonly draftLimitReached: boolean;
  /** Null when the product is no longer listed. */
  readonly product: DraftProduct | null;
};

/** A listed product in quick order's shape, its first 40 live options with live prices. */
async function readPickerProduct(db: Db, productId: string): Promise<DraftProduct | null> {
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      code: products.code,
      status: products.status,
      isAvailable: products.isAvailable,
      categoryShown: shown,
      imageKey: firstProductImageKey(products.id),
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(eq(products.id, productId), listedProduct))
    .limit(1);
  if (!row) return null;
  const rule: ProductRule = {
    status: row.status,
    isAvailable: row.isAvailable,
    categoryShown: row.categoryShown,
  };
  const options = ((await readOptions(db, [row.id])).get(row.id) ?? [])
    .slice(0, QUICK_SEARCH_OPTIONS)
    .map((option) => toOption(rule, option));
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    imageKey: row.imageKey,
    sellable: options.some((option) => option.sellable),
    options,
  };
}

/** What the sheet needs when it opens: the user's drafts in list order and the product. */
export async function readDraftPickerData(
  db: Db,
  userId: string,
  productId: string,
): Promise<DraftPickerData> {
  const [mine, product] = await Promise.all([
    readMyDrafts(db, userId),
    readPickerProduct(db, productId),
  ]);
  return {
    drafts: mine.map(({ id, name, lineCount }) => ({ id, name, lineCount })),
    draftLimitReached: mine.length >= MAX_DRAFTS,
    product,
  };
}

/** Locks the user's draft and returns its name; null when it is missing or someone else's. */
async function lockDraftForAdd(
  tx: Transaction,
  userId: string,
  draftId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ name: drafts.name })
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.ownerUserId, userId)))
    .for("update");
  return row?.name ?? null;
}

/** The line holding `variantId` in this draft, with its 1 based position, or null. */
async function lineForOption(tx: Transaction, draftId: string, variantId: string) {
  const lines = await tx
    .select({ id: draftLines.id, variantId: draftLines.variantId, quantity: draftLines.quantity })
    .from(draftLines)
    .where(eq(draftLines.draftId, draftId))
    .orderBy(...lineOrder);
  const index = lines.findIndex((line) => line.variantId === variantId);
  return index === -1 ? null : { ...lines[index], position: index + 1 };
}

/** The option with its product and category, for the sellable check; null when it is not this product's. */
async function liveOption(tx: Transaction, productId: string, variantId: string) {
  const [row] = await tx
    .select({
      status: products.status,
      productAvailable: products.isAvailable,
      categoryShown: shown,
      listed,
      isAvailable: productVariants.isAvailable,
      archivedAt: productVariants.archivedAt,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(parentCategory, eq(parentCategory.id, categories.parentId))
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
  return row ?? null;
}

export type AddToDraftOutcome =
  | {
      readonly kind: "added";
      readonly draftId: string;
      readonly draftName: string;
      readonly position: number;
      readonly quantity: number;
      readonly merged: boolean;
      readonly newDraft: boolean;
    }
  | { readonly kind: "invalid" }
  | { readonly kind: "not_sellable" }
  | { readonly kind: "not_found" }
  | { readonly kind: "too_many_lines" }
  | { readonly kind: "quantity_over"; readonly position: number; readonly current: number }
  | { readonly kind: "name_taken" }
  | { readonly kind: "too_many_drafts" };

/** Into a draft the user owns: merge into the option's line, or append one (AC-8). */
async function addToExisting(
  tx: Transaction,
  userId: string,
  draftId: string,
  input: AddToDraftInput,
): Promise<AddToDraftOutcome> {
  const draftName = await lockDraftForAdd(tx, userId, draftId);
  if (draftName === null) return { kind: "not_found" };
  const existing = await lineForOption(tx, draftId, input.variantId);
  const plan = planCatalogAdd({
    existing,
    lineCount: await lineCount(tx, draftId),
    quantity: input.quantity,
  });
  switch (plan.kind) {
    case "quantity_over":
    case "too_many_lines":
      return plan;
    case "merge":
      await tx
        .update(draftLines)
        .set({ quantity: plan.quantity })
        .where(eq(draftLines.id, existing!.id));
      break;
    case "append":
      await tx.insert(draftLines).values({
        draftId,
        productId: input.productId,
        variantId: input.variantId,
        quantity: input.quantity,
        sort: sql`(select coalesce(max(l.sort) + 1, 0) from ${draftLines} l where l.draft_id = ${draftId})`,
      });
      break;
  }
  await touch(tx, draftId);
  return {
    kind: "added",
    draftId,
    draftName,
    position: plan.position,
    quantity: plan.kind === "merge" ? plan.quantity : input.quantity,
    merged: plan.kind === "merge",
    newDraft: false,
  };
}

/** Into a new draft named here, holding only this line (AC-9). */
async function addToNew(
  tx: Transaction,
  userId: string,
  name: string,
  input: AddToDraftInput,
): Promise<AddToDraftOutcome> {
  const created = await insertNamedDraft(tx, userId, name);
  if (created.kind !== "created") return created;
  await tx.insert(draftLines).values({
    draftId: created.draftId,
    productId: input.productId,
    variantId: input.variantId,
    quantity: input.quantity,
    sort: 0,
  });
  return {
    kind: "added",
    draftId: created.draftId,
    draftName: name,
    position: 1,
    quantity: input.quantity,
    merged: false,
    newDraft: true,
  };
}

/**
 * AC-8 and AC-9 in one transaction: the option belongs to the product and is live, the product
 * is listed and the option sellable, then the target draft takes the line. A refusal writes nothing.
 */
export async function addToDraftInDb(
  db: Database,
  userId: string,
  input: AddToDraftInput,
): Promise<AddToDraftOutcome> {
  const clash = {
    draftId: "draftId" in input.target ? input.target.draftId : "",
    variantId: input.variantId,
    except: null,
  };
  try {
    return await db.transaction(async (tx): Promise<AddToDraftOutcome> => {
      // The option exists, is this product's, and is not archived (`invalid`, as in quick order).
      const option = await liveOption(tx, input.productId, input.variantId);
      if (!option || option.archivedAt !== null) return { kind: "invalid" };
      const product = {
        status: option.status,
        isAvailable: option.productAvailable,
        categoryShown: option.categoryShown,
      };
      if (!option.listed || !isSellable(product, option)) return { kind: "not_sellable" };
      return "draftId" in input.target
        ? addToExisting(tx, userId, input.target.draftId, input)
        : addToNew(tx, userId, input.target.newDraftName, input);
    });
  } catch (error) {
    if (isDraftNameClash(error)) return { kind: "name_taken" };
    // A line clash cannot happen under the draft lock, and a foreign key miss means the product
    // went mid write: `afterClash` rethrows anything else, and the page says "try again".
    await afterClash(db, error, clash.draftId ? clash : null);
    return { kind: "invalid" };
  }
}
