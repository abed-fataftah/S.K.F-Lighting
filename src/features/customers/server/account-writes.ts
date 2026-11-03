import "server-only";
import { and, eq } from "drizzle-orm";
import { updateProfileInDb } from "@/features/accounts/server/profile";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { accountEvents, orders, profiles } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import { changedFields, removalBlock, type DetailField } from "../account-rules";
import type { AssignableRole } from "../roles";
import type { ChangeRoleInput, CustomerDetailsInput } from "../schemas";

// The owner's account writes (spec 0019 AC-7, AC-10, AC-11 step 1). Each runs in one transaction:
// the profile is read `for update`, checked, written, and recorded with exactly one
// `account_events` row. An admin profile is `not_found` everywhere (AC-1); a profile with a
// `removed` event is pending removal and takes no more changes (AC-12).

type Db = Database | Transaction;

export type AccountWriteError = "not_found" | "removal_pending";

async function lockProfile(tx: Transaction, profileId: string) {
  const [profile] = await tx
    .select({
      role: profiles.role,
      fullName: profiles.fullName,
      phone: profiles.phone,
      phoneE164: profiles.phoneE164,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .for("update");
  return profile && profile.role !== "admin" ? profile : null;
}

/** A `removed` event exists: step 1 of a removal ran (AC-12). */
export async function isRemovalPending(db: Db, profileId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: accountEvents.id })
    .from(accountEvents)
    .where(and(eq(accountEvents.profileId, profileId), eq(accountEvents.type, "removed")))
    .limit(1);
  return row !== undefined;
}

/**
 * Where a removal stands (AC-12): `gone` once the login delete cascaded, `pending` after step 1
 * only, `not_pending` for any other account (an admin included).
 */
export async function readRemovalState(
  db: Db,
  profileId: string,
): Promise<"gone" | "pending" | "not_pending"> {
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!profile) return "gone";
  if (profile.role === "admin") return "not_pending";
  return (await isRemovalPending(db, profileId)) ? "pending" : "not_pending";
}

/** Switch between customer and electrician, only while the role is still `from` (AC-7). */
export function changeCustomerRoleInDb(
  db: Db,
  actorUserId: string,
  input: ChangeRoleInput,
): Promise<Ok<{ readonly role: AssignableRole }> | Fail<AccountWriteError | "stale">> {
  return db.transaction(async (tx) => {
    const profile = await lockProfile(tx, input.profileId);
    if (!profile) return fail("not_found");
    if (await isRemovalPending(tx, input.profileId)) return fail("removal_pending");
    if (profile.role !== input.from) return fail("stale");

    await tx.update(profiles).set({ role: input.to }).where(eq(profiles.id, input.profileId));
    await tx.insert(accountEvents).values({
      profileId: input.profileId,
      type: "role_changed",
      actorUserId,
      fromRole: input.from,
      toRole: input.to,
    });
    return ok({ role: input.to });
  });
}

/** Name and phone through the account form's own write; no change writes nothing (AC-10). */
export function updateCustomerDetailsInDb(
  db: Db,
  actorUserId: string,
  input: CustomerDetailsInput,
): Promise<Ok<{ readonly changed: readonly DetailField[] }> | Fail<AccountWriteError>> {
  return db.transaction(async (tx) => {
    const profile = await lockProfile(tx, input.profileId);
    if (!profile) return fail("not_found");
    if (await isRemovalPending(tx, input.profileId)) return fail("removal_pending");

    const changed = changedFields(profile, input);
    if (changed.length === 0) return ok({ changed });
    await updateProfileInDb(tx, input.profileId, { name: input.name, phone: input.phone });
    await tx.insert(accountEvents).values({
      profileId: input.profileId,
      type: "details_edited",
      actorUserId,
      fields: [...changed],
    });
    return ok({ changed });
  });
}

export type RemovalStartError = "not_found" | "has_open_orders" | "has_balance";

/**
 * Step 1 of a removal (AC-11): the checks under the lock, then the name and phone cleared and one
 * `removed` event. A profile already pending skips it all, so a retry never writes a second event
 * and never checks orders that arrived since.
 */
export function startCustomerRemovalInDb(
  db: Db,
  actorUserId: string,
  profileId: string,
): Promise<Ok<{ readonly alreadyPending: boolean }> | Fail<RemovalStartError>> {
  return db.transaction(async (tx) => {
    const profile = await lockProfile(tx, profileId);
    if (!profile) return fail("not_found");
    if (await isRemovalPending(tx, profileId)) return ok({ alreadyPending: true });

    const placed = await tx
      .select({ status: orders.status, total: orders.total, amountPaid: orders.amountPaid })
      .from(orders)
      .where(eq(orders.placedByUserId, profileId));
    const block = removalBlock(placed);
    if (block) return fail(block);

    await tx
      .update(profiles)
      .set({ fullName: null, phone: null, phoneE164: null })
      .where(eq(profiles.id, profileId));
    await tx.insert(accountEvents).values({ profileId, type: "removed", actorUserId });
    return ok({ alreadyPending: false });
  });
}
