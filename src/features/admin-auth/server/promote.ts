import "server-only";
import { eq, sql } from "drizzle-orm";
import { profiles } from "@/server/db/schema";
import type { Database, Transaction } from "@/server/db/types";

// `pnpm admin:promote <email>` (spec 0004 AC-1, docs/runbooks/admin-mfa.md): gives an existing
// account the `admin` role. The account is made first (Supabase dashboard, until sign up exists).

export type PromoteOutcome =
  | { readonly kind: "promoted"; readonly userId: string }
  | { readonly kind: "user_not_found" }
  | { readonly kind: "profile_missing"; readonly userId: string };

export async function promoteToAdmin(
  db: Database | Transaction,
  email: string,
): Promise<PromoteOutcome> {
  const [user] = await db.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = lower(${email.trim()}) limit 1`,
  );
  if (!user) return { kind: "user_not_found" };

  const [promoted] = await db
    .update(profiles)
    .set({ role: "admin" })
    .where(eq(profiles.id, user.id))
    .returning({ id: profiles.id });
  return promoted
    ? { kind: "promoted", userId: user.id }
    : { kind: "profile_missing", userId: user.id };
}

/** What the script prints for each outcome; the email is the operator's own input. */
export function promoteMessage(outcome: PromoteOutcome, email: string): string {
  switch (outcome.kind) {
    case "promoted":
      return `${email} is now an admin. Sign in at /admin/login and set up the authenticator app.`;
    case "user_not_found":
      return `No account with the email ${email}. Create it in the Supabase dashboard (Authentication, Add user, auto confirm), then run this again.`;
    case "profile_missing":
      return `The account ${email} has no profile row (user ${outcome.userId}). Check that the handle_new_user trigger ran, then run this again.`;
  }
}
