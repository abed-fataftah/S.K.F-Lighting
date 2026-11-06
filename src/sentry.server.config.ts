import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/error-scrub";
import { NO_PERSONAL_DATA } from "@/lib/sentry-options";
import { parsePublicEnv } from "@/lib/public-env";

// The Worker's Sentry client (spec 0027 AC-8, AC-13 to AC-15), loaded by `register` in
// `instrumentation.ts`. No DSN means no client: local dev and CI check builds send nothing. Errors
// only, no personal data by default, and every event passes the production gate and the scrubber.
// No `server-only` here: Next loads this file outside the React server graph.
const { sentryDsn, siteUrl } = parsePublicEnv();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: "production",
    dataCollection: NO_PERSONAL_DATA,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event, siteUrl),
    // Errors only (AC-15): no transaction or Sentry log ever leaves.
    beforeSendTransaction: () => null,
    beforeSendLog: () => null,
  });
}
