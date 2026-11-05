// Who may open the dashboard (spec 0004 AC-1, spec 0001): role `admin` from `profiles.role` and the
// `aal2` claim, which only a verified authenticator code gives. Pure, so every guard (layout, page
// query, Server Action, the sign in pages) decides the same way.
import { routes } from "@/lib/routes";
import { withNext } from "./next-path";

export type AdminAccess =
  | { readonly kind: "admin"; readonly userId: string }
  | { readonly kind: "needs_mfa"; readonly userId: string }
  | { readonly kind: "not_admin" }
  | { readonly kind: "signed_out" };

/** The claims this check reads; `aal` is `aal1` after a password, `aal2` after a code. */
export type AccessClaims = { readonly sub?: string; readonly aal?: string };

/**
 * `verifiedUserId` is the user Supabase Auth returns for the session right now. Claims are checked
 * locally against the signing key, so a token stays valid until it expires even after its session
 * is revoked (sign out, `admin:mfa-reset`); the server's answer is what cuts it off at once.
 */
export function decideAdminAccess(
  claims: AccessClaims | null,
  role: string | null,
  verifiedUserId: string | null,
): AdminAccess {
  if (!claims?.sub || verifiedUserId !== claims.sub) return { kind: "signed_out" };
  if (role !== "admin") return { kind: "not_admin" };
  return claims.aal === "aal2"
    ? { kind: "admin", userId: claims.sub }
    : { kind: "needs_mfa", userId: claims.sub };
}

/** Where a dashboard page sends someone who may not see it; null lets them in. */
export function adminRedirect(access: AdminAccess, next: string | null): string | null {
  switch (access.kind) {
    case "admin":
      return null;
    case "needs_mfa":
      return withNext(routes.admin.mfa, next);
    case "not_admin":
    case "signed_out":
      return withNext(routes.admin.login, next);
  }
}
