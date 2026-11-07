import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/error-scrub";
import { browserDsnFor, safePublicEnv } from "@/lib/monitoring-env";
import { NO_PERSONAL_DATA } from "@/lib/sentry-options";

// The browser's Sentry client (spec 0027 AC-9, AC-13 to AC-15): it starts only with a DSN, on the
// production host, so dev, CI, workers.dev, and branch previews start nothing. Uncaught errors and
// unhandled rejections are caught by default; errors only, no tracing, replay, or logs, and no
// user. Every event passes the gate and the scrubber again in `beforeSend`.
const env = safePublicEnv();
const dsn = browserDsnFor(env, window.location.host);

if (env && dsn) {
  Sentry.init({
    dsn,
    environment: "production",
    dataCollection: NO_PERSONAL_DATA,
    tracesSampleRate: 0,
    // No tracing integration in the bundle's live set, so nothing measures page loads.
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "BrowserTracing"),
    ignoreErrors: [/ResizeObserver loop/],
    denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari(-web)?-extension:\/\//],
    beforeSend: (event) => scrubEvent(event, env.siteUrl),
    beforeSendTransaction: () => null,
    beforeSendLog: () => null,
  });
}
