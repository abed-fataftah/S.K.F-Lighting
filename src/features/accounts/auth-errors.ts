// What a Supabase Auth refusal means for the account forms (spec 0017 AC-3 to AC-5, AC-8, AC-10).
// Pure: the actions pass the error they got and show or log the result.

export type AccountAuthError =
  | "too_many"
  | "email_taken"
  | "weak_password"
  | "same_password"
  | "invalid_credentials"
  | "owner_needs_runbook"
  | "failed";

const BY_CODE: Readonly<Record<string, AccountAuthError>> = {
  over_request_rate_limit: "too_many",
  over_email_send_rate_limit: "too_many",
  user_already_exists: "email_taken",
  email_exists: "email_taken",
  weak_password: "weak_password",
  same_password: "same_password",
  invalid_credentials: "invalid_credentials",
  // Supabase asks for the authenticator before changing an MFA account's password (AC-4).
  insufficient_aal: "owner_needs_runbook",
};

export function accountAuthError(
  error: { readonly status?: number; readonly code?: string } | null | undefined,
): AccountAuthError {
  if (error?.status === 429) return "too_many";
  return (error?.code && BY_CODE[error.code]) || "failed";
}
