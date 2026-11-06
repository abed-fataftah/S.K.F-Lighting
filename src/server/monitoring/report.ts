import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";
import { errorName, mayReport } from "./throttle";

// The one way to log an unexpected failure (spec 0027 AC-10): the JSON log line Workers Logs has
// always had, plus a Sentry event grouped by `event`, so each kind of failure is one issue. It
// never throws and never holds up the response: the send leaves through `waitUntil`.

export type ReportDetails = Readonly<Record<string, string | number | boolean>>;

// The named exception to the no shared mutable state rule (spec 0027 AC-10): the last send time
// per event name, per Worker instance, so a database outage cannot use up the monthly quota.
const lastSentAt = new Map<string, number>();

async function requestHost(): Promise<string | null> {
  try {
    return (await headers()).get("host");
  } catch {
    // Outside a request (a script, a test) there is no host, and the gate drops the event.
    return null;
  }
}

export async function reportError(
  event: string,
  error: unknown,
  details: ReportDetails = {},
): Promise<void> {
  console.error(JSON.stringify({ event, ...details, error: errorName(error) }));
  try {
    const now = Date.now();
    if (!mayReport(lastSentAt.get(event), now)) return;
    lastSentAt.set(event, now);
    const host = await requestHost();
    Sentry.withScope((scope) => {
      scope.setFingerprint([event]);
      scope.setTag("event", event);
      if (host) scope.setTag("host", host);
      scope.setExtras(details);
      // A failure code such as `timeout` arrives as a string; Sentry needs an Error for a stack.
      Sentry.captureException(
        error instanceof Error ? error : new Error(`${event}: ${errorName(error)}`),
      );
    });
    getCloudflareContext().ctx.waitUntil(Sentry.flush(2000));
  } catch {
    // A Sentry or context failure only loses the Sentry copy; the log line is already written.
  }
}
