import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-error";
import { draftLines, drafts, productVariants } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { DraftLineView } from "../draft-view";
import { MAX_DRAFT_LINES, type RestoreDraftLineInput, type UpdateDraftLineInput } from "../schemas";
import { lineOrder, readLineViews } from "./read-draft";

// The line writes (spec 0020 AC-8, AC-9). Each one locks the parent draft `for update` with the
// owner check, then counts, checks duplicates, writes, and bumps `drafts.updated_at`, all in one
// transaction, so the 30 line cap and the one line per option rule hold under concurrency.

const LINE_OPTION_UNIQUE = "draft_lines_draft_variant_unique";

export type LineOutcome =
  | { readonly kind: "ok"; readonly line: DraftLineView }
  | { readonly kind: "not_found" }
  | { readonly kind: "invalid" }
  | { readonly kind: "too_many_lines" }
  | { readonly kind: "duplicate"; readonly position: number };

/** Locks the user's draft; false when it is missing or someone else's. */
async function lockDraft(tx: Transaction, userId: string, draftId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: drafts.id })
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.ownerUserId, userId)))
    .for("update");
  return !!row;
}

/** The line, with its draft locked; null when it is missing or not the user's. */
async function lockLine(tx: Transaction, userId: string, lineId: string) {
  const [line] = await tx
    .select({
      draftId: draftLines.draftId,
      productId: draftLines.productId,
      variantId: draftLines.variantId,
    })
    .from(draftLines)
    .innerJoin(drafts, eq(drafts.id, draftLines.draftId))
    .where(and(eq(draftLines.id, lineId), eq(drafts.ownerUserId, userId)));
  if (!line || !(await lockDraft(tx, userId, line.draftId))) return null;
  return line;
}

export const touch = (tx: Transaction, draftId: string) =>
  tx
    .update(drafts)
    .set({ updatedAt: sql`now()` })
    .where(eq(drafts.id, draftId));

export const lineCount = async (tx: Transaction, draftId: string) => {
  const [{ total }] = await tx
    .select({ total: count() })
    .from(draftLines)
    .where(eq(draftLines.draftId, draftId));
  return total;
};

/** The 1 based position of the line holding `variantId` in this draft, other than `except`. */
async function positionOfOption(
  db: Database | Transaction,
  draftId: string,
  variantId: string,
  except: string | null,
): Promise<number | null> {
  const ids = await db
    .select({ id: draftLines.id, variantId: draftLines.variantId })
    .from(draftLines)
    .where(eq(draftLines.draftId, draftId))
    .orderBy(...lineOrder);
  const index = ids.findIndex((row) => row.variantId === variantId && row.id !== except);
  return index === -1 ? null : index + 1;
}

/** The option exists, belongs to the product, and (unless kept from before) is not archived. */
async function optionOf(
  tx: Transaction,
  productId: string,
  variantId: string,
  { allowArchived = false } = {},
): Promise<boolean> {
  const [option] = await tx
    .select({ archivedAt: productVariants.archivedAt })
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
  return !!option && (allowArchived || option.archivedAt === null);
}

async function viewOf(tx: Transaction, draftId: string, lineId: string): Promise<LineOutcome> {
  const [line] = await readLineViews(tx, draftId, [lineId]);
  return line ? { kind: "ok", line } : { kind: "not_found" };
}

/** A unique clash that slipped past the check (it cannot under the lock, but the index decides). */
export async function afterClash(
  db: Database,
  error: unknown,
  clash: { draftId: string; variantId: string | null; except: string | null } | null,
): Promise<LineOutcome> {
  if (clash?.variantId && isUniqueViolation(error, LINE_OPTION_UNIQUE)) {
    const position = await positionOfOption(db, clash.draftId, clash.variantId, clash.except);
    return { kind: "duplicate", position: position ?? 0 };
  }
  if (isForeignKeyViolation(error)) return { kind: "invalid" };
  throw error;
}

/** AC-9: an empty line, `sort` one past the highest. */
export async function addDraftLineInDb(
  db: Database,
  userId: string,
  draftId: string,
): Promise<LineOutcome> {
  return db.transaction(async (tx): Promise<LineOutcome> => {
    if (!(await lockDraft(tx, userId, draftId))) return { kind: "not_found" };
    if ((await lineCount(tx, draftId)) >= MAX_DRAFT_LINES) return { kind: "too_many_lines" };
    const [line] = await tx
      .insert(draftLines)
      .values({
        draftId,
        sort: sql`(select coalesce(max(l.sort) + 1, 0) from ${draftLines} l where l.draft_id = ${draftId})`,
      })
      .returning({ id: draftLines.id, sort: draftLines.sort });
    await touch(tx, draftId);
    return {
      kind: "ok",
      line: { id: line.id, sort: line.sort, quantity: null, product: null, option: null },
    };
  });
}

/** AC-8: the product with its option, the option alone, or the quantity. */
export async function updateDraftLineInDb(
  db: Database,
  userId: string,
  input: UpdateDraftLineInput,
): Promise<LineOutcome> {
  let clash: { draftId: string; variantId: string | null; except: string } | null = null;
  try {
    return await db.transaction(async (tx): Promise<LineOutcome> => {
      const line = await lockLine(tx, userId, input.lineId);
      if (!line) return { kind: "not_found" };

      let set: Partial<typeof draftLines.$inferInsert>;
      if ("quantity" in input) {
        set = { quantity: input.quantity };
      } else {
        const productId = "productId" in input ? input.productId : line.productId;
        // Choosing the product the line already has changes nothing.
        if ("productId" in input && productId === line.productId && input.variantId === null) {
          return viewOf(tx, line.draftId, input.lineId);
        }
        if (!productId) return { kind: "invalid" };
        const variantId = input.variantId;
        if (variantId) {
          if (!(await optionOf(tx, productId, variantId))) return { kind: "invalid" };
          const position = await positionOfOption(tx, line.draftId, variantId, input.lineId);
          if (position) return { kind: "duplicate", position };
        }
        clash = { draftId: line.draftId, variantId, except: input.lineId };
        set = { productId, variantId };
      }

      await tx.update(draftLines).set(set).where(eq(draftLines.id, input.lineId));
      await touch(tx, line.draftId);
      return viewOf(tx, line.draftId, input.lineId);
    });
  } catch (error) {
    return afterClash(db, error, clash);
  }
}

/** AC-9: the line goes; the page keeps what it held for undo. */
export async function removeDraftLineInDb(
  db: Database,
  userId: string,
  lineId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const line = await lockLine(tx, userId, lineId);
    if (!line) return false;
    await tx.delete(draftLines).where(eq(draftLines.id, lineId));
    await touch(tx, line.draftId);
    return true;
  });
}

/** AC-9 undo: the line back in its place with what it held, under the same limits. */
export async function restoreDraftLineInDb(
  db: Database,
  userId: string,
  input: RestoreDraftLineInput,
): Promise<LineOutcome> {
  const clash = { draftId: input.draftId, variantId: input.variantId, except: null };
  try {
    return await db.transaction(async (tx): Promise<LineOutcome> => {
      if (!(await lockDraft(tx, userId, input.draftId))) return { kind: "not_found" };
      if ((await lineCount(tx, input.draftId)) >= MAX_DRAFT_LINES) {
        return { kind: "too_many_lines" };
      }
      if (input.variantId) {
        if (!input.productId) return { kind: "invalid" };
        // The option was on this line a moment ago, so an archived one may come back (AC-14).
        const belongs = await optionOf(tx, input.productId, input.variantId, {
          allowArchived: true,
        });
        if (!belongs) return { kind: "invalid" };
        const position = await positionOfOption(tx, input.draftId, input.variantId, null);
        if (position) return { kind: "duplicate", position };
      }
      const [line] = await tx
        .insert(draftLines)
        .values({
          draftId: input.draftId,
          productId: input.productId,
          variantId: input.variantId,
          quantity: input.quantity,
          sort: input.sort,
        })
        .returning({ id: draftLines.id });
      await touch(tx, input.draftId);
      return viewOf(tx, input.draftId, line.id);
    });
  } catch (error) {
    return afterClash(db, error, clash);
  }
}
