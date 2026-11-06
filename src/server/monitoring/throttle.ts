// How often `reportError` may send one kind of failure (spec 0027 AC-10). Pure, so the window is
// tested without a clock; the map of last send times lives in `report.ts`.

/** One Sentry event per event name per minute, in each Worker instance. */
export const REPORT_WINDOW_MS = 60_000;

/** True when `event` has not been sent in the last window. */
export function mayReport(lastSentAt: number | undefined, now: number): boolean {
  return lastSentAt === undefined || now - lastSentAt >= REPORT_WINDOW_MS;
}

/** What the log line names as the error: its name, the failure code itself, or `unknown`. */
export function errorName(error: unknown): string {
  if (error instanceof Error) return error.name;
  if (typeof error === "string") return error;
  return "unknown";
}
