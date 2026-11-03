import "server-only";
import { createClient } from "@supabase/supabase-js";
import { storageEnv } from "@/server/storage/env";

// Supabase Auth admin calls with the service role key (spec 0019 AC-11 step 2). The client is made
// per call (Workers cannot share I/O across requests) and never reaches the browser. It reads the
// same settings as Storage (`storageEnv()`, spec 0006).

export function authAdmin() {
  const { url, serviceRoleKey } = storageEnv();
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth.admin;
}

export type DeleteAuthUserResult =
  { readonly ok: true } | { readonly ok: false; readonly code: string };

/**
 * Deletes the login; Postgres cascades it to the profile. A user that is already gone counts as
 * done, so a retry after another tab finished is safe.
 */
export async function deleteAuthUser(userId: string): Promise<DeleteAuthUserResult> {
  try {
    const { error } = await authAdmin().deleteUser(userId);
    if (!error || error.code === "user_not_found" || error.status === 404) return { ok: true };
    return { ok: false, code: error.code ?? "unknown" };
  } catch {
    return { ok: false, code: "unknown" };
  }
}
