"use server";

import { redirect } from "next/navigation";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getAdminAccess, readProfileRole } from "@/server/auth/admin";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { safeAdminNext, withNext } from "../next-path";
import { qrImageSrc, signInSchema, verifyTotpSchema } from "../schemas";

// Dashboard sign in (spec 0004 AC-1, spec 0001): email and password, then a 6 digit code from an
// authenticator app (Supabase MFA, TOTP). Failed password attempts are limited by Supabase Auth.

/** The name the authenticator app shows beside the codes. */
const TOTP_ISSUER = "SKF Lighting";

// Logs carry the outcome only, never the email typed.
function logRefusal(event: string, error: string) {
  console.warn(JSON.stringify({ event, error }));
}

const isRateLimited = (error: { status?: number } | null) => error?.status === 429;

export type SignInError = "invalid" | "invalid_credentials" | "not_admin" | "too_many";

/** Null before the first submit; a success redirects to the code page. */
export type SignInState = Fail<SignInError, { readonly fieldErrors?: FieldErrors }> | null;

export async function signInAdmin(_previous: SignInState, form: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse(formValues(form));
  if (!parsed.success)
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error) };
  const { email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    const code = isRateLimited(error) ? "too_many" : "invalid_credentials";
    logRefusal("admin_sign_in_refused", code);
    return fail(code);
  }

  // A customer's correct password still opens nothing here; the form shows the same message.
  if ((await readProfileRole(data.user.id)) !== "admin") {
    await supabase.auth.signOut({ scope: "local" });
    logRefusal("admin_sign_in_refused", "not_admin");
    return fail("not_admin");
  }

  redirect(withNext(routes.admin.mfa, next));
}

export type EnrollError = "forbidden" | "already_enrolled" | "enroll_failed";

export type Enrollment = {
  readonly factorId: string;
  /** The QR code as an <img> source. */
  readonly qrSrc: string;
  /** The same key as text, for typing into an app that cannot scan. */
  readonly secret: string;
};

/**
 * Starts authenticator setup for a signed in admin who has none yet. It first removes the user's
 * unverified factors, so starting again (or reloading) never piles them up.
 */
export async function enrollTotp(): Promise<Ok<Enrollment> | Fail<EnrollError>> {
  const access = await getAdminAccess();
  if (access.kind === "admin") return fail("already_enrolled");
  if (access.kind !== "needs_mfa") return fail("forbidden");

  const supabase = await createSupabaseServerClient();
  const factors = await supabase.auth.mfa.listFactors();
  if (factors.error) return fail("enroll_failed");
  if (factors.data.totp.length > 0) return fail("already_enrolled");

  const unverified = factors.data.all.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "unverified",
  );
  for (const factor of unverified) {
    const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error) return fail("enroll_failed");
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: TOTP_ISSUER,
  });
  if (error) {
    logRefusal("admin_mfa_enroll_failed", error.code ?? "unknown");
    return fail("enroll_failed");
  }
  return ok({ factorId: data.id, qrSrc: qrImageSrc(data.totp.qr_code), secret: data.totp.secret });
}

export type VerifyError = "invalid" | "invalid_code" | "too_many" | "forbidden";

export type VerifyState = Fail<VerifyError, { readonly fieldErrors?: FieldErrors }> | null;

/**
 * Checks a code against the factor (a first code also finishes enrollment), which lifts the
 * session to `aal2`, then goes to `next` (dashboard paths only) or the orders list. `getClaims()` is
 * cached per request, so nothing is checked after the verify: the next request sees `aal2`.
 */
export async function verifyTotp(_previous: VerifyState, form: FormData): Promise<VerifyState> {
  const parsed = verifyTotpSchema.safeParse(formValues(form));
  if (!parsed.success)
    return { ok: false, error: "invalid", fieldErrors: fieldErrorsOf(parsed.error) };
  const { factorId, code, next } = parsed.data;

  const access = await getAdminAccess();
  if (access.kind === "admin") redirect(safeAdminNext(next));
  if (access.kind !== "needs_mfa") return fail("forbidden");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    const reason = isRateLimited(error) ? "too_many" : "invalid_code";
    logRefusal("admin_mfa_refused", reason);
    return fail(reason);
  }

  redirect(safeAdminNext(next));
}

/** Ends this browser's session and goes back to sign in. */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(routes.admin.login);
}
