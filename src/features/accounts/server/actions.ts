"use server";

import { redirect } from "next/navigation";
import { fieldErrorsOf, formValues, type FieldErrors } from "@/lib/form-errors";
import { parsePublicEnv } from "@/lib/public-env";
import { fail, ok, type Fail, type Ok } from "@/lib/result";
import { routes } from "@/lib/routes";
import { getVerifiedUser } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/auth/supabase";
import { getDb } from "@/server/db";
import { accountAuthError, type AccountAuthError } from "../auth-errors";
import { safeStorefrontNext } from "../next-path";
import {
  changePasswordSchema,
  HONEYPOT_FIELD,
  profileSchema,
  registerSchema,
  resetRequestSchema,
  setPasswordSchema,
  signInSchema,
} from "../schemas";
import { getAccountProfile, savePhoneAfterSignUp, updateProfileInDb } from "./profile";
import { forgetRecovery, hasFreshRecovery, rememberRecovery } from "./recovery";

// Customer accounts on Supabase Auth (spec 0017). Each action logs one line with the outcome
// (AC-17): never the email, name, phone, or password; a user id at most.

type AccountEvent =
  | "account_sign_up"
  | "account_sign_in"
  | "account_reset_requested"
  | "account_recovery_confirmed"
  | "account_password_set"
  | "account_password_changed"
  | "account_profile_saved";

function logOutcome(event: AccountEvent, code?: string) {
  const line = code ? { event, ok: false, code } : { event, ok: true };
  (code ? console.warn : console.info)(JSON.stringify(line));
}

const trapped = (form: FormData) => {
  const trap = form.get(HONEYPOT_FIELD);
  return typeof trap === "string" && trap.trim() !== "";
};

type WithFields = { readonly fieldErrors?: FieldErrors };
const invalid = (fieldErrors: FieldErrors) => ({
  ok: false as const,
  error: "invalid" as const,
  fieldErrors,
});

export type RegisterError = "invalid" | "email_taken" | "weak_password" | "too_many" | "failed";
export type RegisterState = Fail<RegisterError, WithFields> | null;

/** AC-2, AC-3: create the account, save the phone, and sign the visitor in at once. */
export async function registerCustomer(
  _previous: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  if (trapped(form)) {
    logOutcome("account_sign_up", "honeypot");
    return fail("failed");
  }
  const parsed = registerSchema.safeParse(formValues(form));
  if (!parsed.success) {
    logOutcome("account_sign_up", "invalid");
    return invalid(fieldErrorsOf(parsed.error));
  }
  const { name, phone, email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  // Only the name goes in the metadata; the trigger reads it and the role stays `customer`.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  if (error || !data.user) {
    const code = signUpError(accountAuthError(error));
    logOutcome("account_sign_up", code);
    return fail(code);
  }

  // A failed phone write keeps the account and the session; /account then asks for the phone.
  try {
    await savePhoneAfterSignUp(await getDb(), data.user.id, { fullName: name, phone });
  } catch {
    console.error(JSON.stringify({ event: "profile_phone_save_failed", userId: data.user.id }));
  }
  logOutcome("account_sign_up");
  redirect(safeStorefrontNext(next));
}

const signUpError = (error: AccountAuthError): RegisterError =>
  error === "email_taken" || error === "weak_password" || error === "too_many" ? error : "failed";

export type SignInError = "invalid" | "invalid_credentials" | "too_many" | "failed";
export type SignInState = Fail<SignInError, WithFields> | null;

const signInError = (error: AccountAuthError): SignInError =>
  error === "invalid_credentials" || error === "too_many" ? error : "failed";

/** AC-5: a wrong password and an unknown email get the same answer; an outage does not. */
export async function signInCustomer(_previous: SignInState, form: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse(formValues(form));
  if (!parsed.success) {
    logOutcome("account_sign_in", "invalid");
    return invalid(fieldErrorsOf(parsed.error));
  }
  const { email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const code = signInError(accountAuthError(error));
    logOutcome("account_sign_in", code);
    return fail(code);
  }
  logOutcome("account_sign_in");
  redirect(safeStorefrontNext(next));
}

export type ResetRequestState = Ok<{ readonly sent: true }> | Fail<"invalid", WithFields> | null;

/**
 * AC-7: the same answer whether or not the email has an account. Every Supabase refusal, its per
 * email throttle included, is only logged, since the throttle fires for real accounts alone.
 */
export async function requestPasswordReset(
  _previous: ResetRequestState,
  form: FormData,
): Promise<ResetRequestState> {
  if (trapped(form)) {
    logOutcome("account_reset_requested", "honeypot");
    return ok({ sent: true });
  }
  const parsed = resetRequestSchema.safeParse(formValues(form));
  if (!parsed.success) {
    logOutcome("account_reset_requested", "invalid");
    return invalid(fieldErrorsOf(parsed.error));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: parsePublicEnv().siteUrl + routes.auth.confirm,
  });
  logOutcome("account_reset_requested", error ? accountAuthError(error) : undefined);
  return ok({ sent: true });
}

/** AC-8: the "متابعة" button on /auth/confirm. The token is the proof; it signs the visitor in. */
export async function confirmRecovery(form: FormData): Promise<void> {
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const expired = routes.signInWith({ tab: "reset", error: "link_expired" });
  if (typeof tokenHash !== "string" || tokenHash === "" || type !== "recovery") {
    logOutcome("account_recovery_confirmed", "invalid");
    redirect(expired);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });
  const userId = data.user?.id;
  if (error || !userId) {
    logOutcome("account_recovery_confirmed", error ? accountAuthError(error) : "failed");
    redirect(expired);
  }
  await rememberRecovery(userId);
  logOutcome("account_recovery_confirmed");
  redirect(routes.accountResetPassword);
}

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** AC-17: a failure here keeps the new password; it is logged with the user id and the code. */
async function endOtherSessions(supabase: ServerSupabase, userId: string): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.warn(
      JSON.stringify({ event: "other_sessions_kept", userId, code: error.code ?? "unknown" }),
    );
  }
}

export type PasswordError =
  | "not_signed_in"
  | "invalid"
  | "weak_password"
  | "same_password"
  | "owner_needs_runbook"
  | "too_many"
  | "failed";
export type SetPasswordError = PasswordError | "recovery_expired";
export type SetPasswordState = Fail<SetPasswordError, WithFields> | null;

const passwordError = (error: AccountAuthError): PasswordError =>
  error === "weak_password" ||
  error === "same_password" ||
  error === "owner_needs_runbook" ||
  error === "too_many"
    ? error
    : "failed";

/**
 * AC-8: the new password after a reset link, only within its 10 minutes (else the current password
 * is needed, AC-10); every other session of the account ends.
 */
export async function setNewPassword(
  _previous: SetPasswordState,
  form: FormData,
): Promise<SetPasswordState> {
  const user = await getVerifiedUser();
  if (!user) {
    logOutcome("account_password_set", "not_signed_in");
    return fail("not_signed_in");
  }
  if (!(await hasFreshRecovery(user.id))) {
    logOutcome("account_password_set", "recovery_expired");
    return fail("recovery_expired");
  }
  const parsed = setPasswordSchema.safeParse(formValues(form));
  if (!parsed.success) {
    logOutcome("account_password_set", "invalid");
    return invalid(fieldErrorsOf(parsed.error));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const code = passwordError(accountAuthError(error));
    logOutcome("account_password_set", code);
    return fail(code);
  }
  await forgetRecovery();
  await endOtherSessions(supabase, user.id);
  logOutcome("account_password_set");
  redirect(routes.accountWith("password_set"));
}

export type ChangePasswordError = PasswordError | "wrong_current";
export type ChangePasswordState =
  Ok<{ readonly changed: true }> | Fail<ChangePasswordError, WithFields> | null;

/** AC-10: the current password first, then the new one; every other session ends. */
export async function changePassword(
  _previous: ChangePasswordState,
  form: FormData,
): Promise<ChangePasswordState> {
  const user = await getVerifiedUser();
  if (!user?.email) {
    logOutcome("account_password_changed", "not_signed_in");
    return fail("not_signed_in");
  }
  // AC-4: Supabase would refuse the owner at the update anyway, and checking the current password
  // first signs in again at aal1, which would end the owner's dashboard session for nothing.
  if ((await getAccountProfile())?.profile?.role === "admin") {
    logOutcome("account_password_changed", "owner_needs_runbook");
    return fail("owner_needs_runbook");
  }
  const parsed = changePasswordSchema.safeParse(formValues(form));
  if (!parsed.success) {
    logOutcome("account_password_changed", "invalid");
    return invalid(fieldErrorsOf(parsed.error));
  }
  const { current, password } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) {
    const mapped = accountAuthError(check.error);
    const code: ChangePasswordError =
      mapped === "invalid_credentials" ? "wrong_current" : passwordError(mapped);
    logOutcome("account_password_changed", code);
    return fail(code);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const code = passwordError(accountAuthError(error));
    logOutcome("account_password_changed", code);
    return fail(code);
  }
  await endOtherSessions(supabase, user.id);
  await forgetRecovery();
  logOutcome("account_password_changed");
  return ok({ changed: true });
}

export type ProfileError = "not_signed_in" | "invalid" | "failed";
export type ProfileState = Ok<{ readonly saved: true }> | Fail<ProfileError, WithFields> | null;

/** AC-9: the name and phone on the profile; saved orders keep what they were placed with. */
export async function updateProfile(
  _previous: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const user = await getVerifiedUser();
  if (!user) {
    logOutcome("account_profile_saved", "not_signed_in");
    return fail("not_signed_in");
  }
  const parsed = profileSchema.safeParse(formValues(form));
  if (!parsed.success) {
    logOutcome("account_profile_saved", "invalid");
    return invalid(fieldErrorsOf(parsed.error));
  }

  try {
    await updateProfileInDb(await getDb(), user.id, parsed.data);
  } catch {
    logOutcome("account_profile_saved", "failed");
    return fail("failed");
  }
  logOutcome("account_profile_saved");
  return ok({ saved: true });
}

/** AC-11: this browser only; the cart and order cookies stay, an open reset window ends. */
export async function signOutCustomer(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  await forgetRecovery();
  redirect(routes.home);
}
