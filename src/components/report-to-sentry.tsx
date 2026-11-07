"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// An error boundary's report (spec 0027 AC-9): sends the caught error to Sentry once it shows, and
// renders nothing. Sentry only runs on the production host, and its scrubber runs first.
export function ReportToSentry({ error }: { readonly error: unknown }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return null;
}
