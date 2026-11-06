import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Spec 0027 AC-8: uncaught server errors (pages, layouts, Server Actions, route handlers) go to
// Sentry. OpenNext runs the Node.js build on workerd, so only that runtime loads the client.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
}

/** Sentry's own hook, with the request host as the `host` tag the production gate reads (AC-13). */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const host = request.headers.host;
  Sentry.withScope((scope) => {
    if (typeof host === "string") scope.setTag("host", host);
    Sentry.captureRequestError(error, request, context);
  });
};
