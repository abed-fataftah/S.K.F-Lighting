import "server-only";
import * as Sentry from "@sentry/nextjs";

// Who an error happened to (spec 0027 AC-14): the Supabase account id only, and the role where the
// request already read it. Set on the request's own isolation scope, so it never reaches another
// request's events. No query is added just for this. Never throws.

const ROLES = new Set(["customer", "electrician", "admin"]);

export function tagSentryUser(userId: string): void {
  try {
    Sentry.getIsolationScope().setUser({ id: userId });
  } catch {
    // Monitoring never breaks a request.
  }
}

export function tagSentryRole(role: string | null): void {
  if (role === null || !ROLES.has(role)) return;
  try {
    Sentry.getIsolationScope().setTag("role", role);
  } catch {
    // Monitoring never breaks a request.
  }
}
