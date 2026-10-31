// The `skf_recovery` cookie (spec 0017 AC-8, the cookie runner up in `## Decision`): a new password
// without the current one only within 10 minutes of a reset link. `confirmRecovery` sets it after a
// good token, bound to that user id; `setNewPassword` clears it. Supabase's `amr` claim cannot carry
// this, since a recovery verify records method `otp`, not `recovery`.

export const RECOVERY_COOKIE = "skf_recovery";
export const RECOVERY_WINDOW_SECONDS = 600;

/** `<user id>.<seconds since the epoch>` when the reset link was confirmed. */
export const recoveryCookieValue = (userId: string, nowSeconds: number) =>
  `${userId}.${nowSeconds}`;

/** True when the cookie was set for `userId` at most 10 minutes before `nowSeconds`. */
export function isFreshRecovery(
  raw: string | undefined,
  userId: string,
  nowSeconds: number,
): boolean {
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot < 1 || raw.slice(0, dot) !== userId) return false;
  const stamp = raw.slice(dot + 1);
  if (!/^\d{1,12}$/.test(stamp)) return false;
  const age = nowSeconds - Number(stamp);
  return age >= 0 && age <= RECOVERY_WINDOW_SECONDS;
}
