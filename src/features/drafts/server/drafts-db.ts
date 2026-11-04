import "server-only";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { isForeignKeyViolation, isUniqueViolation } from "@/server/db/pg-error";
import { draftLines, drafts, profiles } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { draftCustomerColumns, MAX_DRAFTS, type DraftCustomerInput } from "../schemas";

// The draft level writes (spec 0020 AC-4, AC-5, AC-10, AC-15). Ownership is a
// `owner_user_id = userId` in the same statement, so another user's draft reads as `not_found`.

const NAME_INDEX = "drafts_owner_name_unique";

/** Latin letters compare case insensitively, as the unique index does (AC-4). */
const sameName = (name: string) => sql`lower(${drafts.name}) = lower(${name})`;

/** The name unique index refused a write: a clash that slipped past the check. */
export const isDraftNameClash = (error: unknown) => isUniqueViolation(error, NAME_INDEX);

export type CreateDraftOutcome =
  | { readonly kind: "created"; readonly draftId: string }
  | { readonly kind: "name_taken" }
  | { readonly kind: "too_many_drafts" };

/**
 * A new draft with no lines, inside the caller's transaction. The profile row lock queues two
 * creates by the same user, so the 30 draft limit holds; the unique index is the final judge of
 * the name, so the caller maps `isDraftNameClash` after the transaction.
 */
export async function insertNamedDraft(
  tx: Transaction,
  userId: string,
  name: string,
): Promise<CreateDraftOutcome> {
  await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).for("update");
  const [{ total }] = await tx
    .select({ total: count() })
    .from(drafts)
    .where(eq(drafts.ownerUserId, userId));
  if (total >= MAX_DRAFTS) return { kind: "too_many_drafts" };
  const [clash] = await tx
    .select({ id: drafts.id })
    .from(drafts)
    .where(and(eq(drafts.ownerUserId, userId), sameName(name)))
    .limit(1);
  if (clash) return { kind: "name_taken" };

  const [draft] = await tx
    .insert(drafts)
    .values({ ownerUserId: userId, name })
    .returning({ id: drafts.id });
  return { kind: "created", draftId: draft.id };
}

/** AC-4: a new draft with one empty line. */
export async function createDraftInDb(
  db: Database,
  userId: string,
  name: string,
): Promise<CreateDraftOutcome> {
  try {
    return await db.transaction(async (tx): Promise<CreateDraftOutcome> => {
      const outcome = await insertNamedDraft(tx, userId, name);
      if (outcome.kind === "created") {
        await tx.insert(draftLines).values({ draftId: outcome.draftId, sort: 0 });
      }
      return outcome;
    });
  } catch (error) {
    if (isDraftNameClash(error)) return { kind: "name_taken" };
    throw error;
  }
}

export type RenameDraftOutcome =
  | { readonly kind: "renamed"; readonly name: string }
  | { readonly kind: "name_taken" }
  | { readonly kind: "not_found" };

/** AC-5: the same rules as a new name; the clash check leaves out the draft itself. */
export async function renameDraftInDb(
  db: Database,
  userId: string,
  draftId: string,
  name: string,
): Promise<RenameDraftOutcome> {
  try {
    return await db.transaction(async (tx): Promise<RenameDraftOutcome> => {
      const [clash] = await tx
        .select({ id: drafts.id })
        .from(drafts)
        .where(and(eq(drafts.ownerUserId, userId), ne(drafts.id, draftId), sameName(name)))
        .limit(1);
      if (clash) return { kind: "name_taken" };
      const [row] = await tx
        .update(drafts)
        .set({ name, updatedAt: sql`now()` })
        .where(and(eq(drafts.id, draftId), eq(drafts.ownerUserId, userId)))
        .returning({ name: drafts.name });
      return row ? { kind: "renamed", name: row.name } : { kind: "not_found" };
    });
  } catch (error) {
    if (isUniqueViolation(error, NAME_INDEX)) return { kind: "name_taken" };
    throw error;
  }
}

/** AC-15: the draft and, by cascade, its lines. True when a row was deleted. */
export async function deleteDraftInDb(
  db: Database,
  userId: string,
  draftId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.ownerUserId, userId)))
    .returning({ id: drafts.id });
  return deleted.length > 0;
}

export type SaveCustomerOutcome = "saved" | "not_found" | "invalid";

/** AC-10: the given customer fields as typed (tidied and cut), and the phone's E.164 form. */
export async function saveDraftCustomerInDb(
  db: Database,
  userId: string,
  input: DraftCustomerInput,
): Promise<SaveCustomerOutcome> {
  try {
    const updated = await db
      .update(drafts)
      .set({ ...draftCustomerColumns(input), updatedAt: sql`now()` })
      .where(and(eq(drafts.id, input.draftId), eq(drafts.ownerUserId, userId)))
      .returning({ id: drafts.id });
    return updated.length > 0 ? "saved" : "not_found";
  } catch (error) {
    // A zone id that does not exist.
    if (isForeignKeyViolation(error)) return "invalid";
    throw error;
  }
}
