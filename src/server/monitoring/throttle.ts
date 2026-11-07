// How often `reportError` may send one kind of failure (spec 0027 AC-10). Pure, so the window is
// tested without a clock; the map of last send times lives in `report.ts`.

/** One Sentry event per event name per minute, in each Worker instance. */
export const REPORT_WINDOW_MS = 60_000;

/** True when `event` has not been sent in the last window. */
export function mayReport(lastSentAt: number | undefined, now: number): boolean {
  return lastSentAt === undefined || now - lastSentAt >= REPORT_WINDOW_MS;
}

/**
 * What to report for a failed `withTimeLimit` read: the thrown cause, so Sentry gets its stack, or
 * the failure code (`timeout`) when nothing was thrown.
 */
export function failureOf(result: { readonly error: string; readonly cause?: unknown }): unknown {
  return result.error === "failed" && result.cause instanceof Error ? result.cause : result.error;
}

// A failure code such as `timeout` or `http_500`. Any other string may carry data (a thrown
// string can hold a phone number), so it is never logged.
const FAILURE_CODE = /^[a-z][a-z0-9_]*$/;

/** What the log line names as the error: its name, a failure code, or `unknown`. */
export function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (typeof error === "string" && FAILURE_CODE.test(error)) return error;
  return "unknown";
}
