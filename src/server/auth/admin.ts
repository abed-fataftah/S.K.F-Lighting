import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { adminRedirect, decideAdminAccess, type AdminAccess } from "@/features/admin-auth/access";
import { ADMIN_PATH_HEADER } from "@/features/admin-auth/next-path";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { getClaims, getVerifiedUser } from "./session";

// The dashboard guard (spec 0001, spec 0004 AC-1): role `admin` from `profiles.role` plus the
// `aal2` claim, for a session Supabase Auth still accepts. It runs in the dashboard layout, in every
// admin page query, and inside every admin Server Action, so a page or action that forgets one of
// the others still leaks nothing.

/** `profiles.role` for a user, or null when the profile is missing. */
export async function readProfileRole(userId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row?.role ?? null;
}

/**
 * Who is asking: the claims, the session checked with Supabase Auth (one round trip, so a revoked
 * session is out at once rather than when its token expires), and the profile role. Cached per
 * request, so the layout, the page query, and an action share one check.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const claims = await getClaims();
  if (!claims?.sub) return decideAdminAccess(null, null, null);
  const [user, role] = await Promise.all([getVerifiedUser(), readProfileRole(claims.sub)]);
  return decideAdminAccess(claims, role, user?.id ?? null);
});

/**
 * For dashboard layouts, pages, and their queries: sends anyone who is not a signed in admin at
 * `aal2` to sign in (or to the code page), then back to `next`. Pass the page's own path; without
 * one, the path the proxy saw is used.
 */
export async function requireAdminPage(next?: string): Promise<{ readonly userId: string }> {
  const access = await getAdminAccess();
  const target = adminRedirect(access, next ?? (await headers()).get(ADMIN_PATH_HEADER));
  if (target !== null || access.kind !== "admin") redirect(target ?? routes.admin.login);
  return { userId: access.userId };
}

/** For admin Server Actions, before anything is read or written. */
export async function requireAdmin(): Promise<Ok<{ readonly userId: string }> | Fail<"forbidden">> {
  const access = await getAdminAccess();
  return access.kind === "admin" ? ok({ userId: access.userId }) : fail("forbidden");
}
