import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { getClaims } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { profiles } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";
import type { ProfileInput } from "../schemas";

// The signed in customer's profile (spec 0017 Value sourcing): read for the account page, the
// checkout prefill, and order placement; written only by register and the profile form. Nothing
// here reads or writes `profiles.role` beyond reading it (AC-4).

export type UserRole = (typeof profiles.$inferSelect)["role"];

export type AccountProfile = {
  readonly fullName: string | null;
  readonly phone: string | null;
  readonly phoneE164: string | null;
  readonly role: UserRole;
};

export type Account = {
  readonly userId: string;
  readonly email: string | null;
  /** Null when the user has no profile row (it should always have one). */
  readonly profile: AccountProfile | null;
};

/** The visitor's account from the session claims and one profile select, or null when signed out. */
export const getAccountProfile = cache(async (): Promise<Account | null> => {
  const claims = await getClaims();
  if (!claims?.sub) return null;
  const profile = await readAccountProfile(await getDb(), claims.sub);
  const email = typeof claims.email === "string" ? claims.email : null;
  return { userId: claims.sub, email, profile };
});

export async function readAccountProfile(
  db: Database | Transaction,
  userId: string,
): Promise<AccountProfile | null> {
  const [row] = await db
    .select({
      fullName: profiles.fullName,
      phone: profiles.phone,
      phoneE164: profiles.phoneE164,
      role: profiles.role,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row ?? null;
}

type Phone = ProfileInput["phone"];

/**
 * After sign up (AC-2): the phone on the profile the trigger made. If that row is missing, one
 * insert makes it (role stays the column default, `customer`).
 */
export async function savePhoneAfterSignUp(
  db: Database | Transaction,
  userId: string,
  { fullName, phone }: { readonly fullName: string; readonly phone: Phone },
): Promise<void> {
  const contact = { phone: phone.typed, phoneE164: phone.e164 };
  const updated = await db
    .update(profiles)
    .set(contact)
    .where(eq(profiles.id, userId))
    .returning({ id: profiles.id });
  if (updated.length > 0) return;
  await upsertContact(db, userId, { fullName, ...contact });
}

/** The profile form (AC-9): name and phone, both phone columns together. */
export async function updateProfileInDb(
  db: Database | Transaction,
  userId: string,
  input: ProfileInput,
): Promise<void> {
  const contact = { fullName: input.name, phone: input.phone.typed, phoneE164: input.phone.e164 };
  const updated = await db
    .update(profiles)
    .set(contact)
    .where(eq(profiles.id, userId))
    .returning({ id: profiles.id });
  if (updated.length > 0) return;
  await upsertContact(db, userId, contact);
}

async function upsertContact(
  db: Database | Transaction,
  userId: string,
  contact: { readonly fullName: string; readonly phone: string; readonly phoneE164: string },
) {
  await db
    .insert(profiles)
    .values({ id: userId, ...contact })
    .onConflictDoUpdate({ target: profiles.id, set: contact });
}
