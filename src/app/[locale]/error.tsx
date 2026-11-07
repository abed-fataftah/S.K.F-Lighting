"use client";

import { ErrorState } from "@/components/error-state";
import { ReportToSentry } from "@/components/report-to-sentry";
import { parsePublicEnv } from "@/lib/public-env";

// A storefront page that failed to load (design.md section 7): the error card inside the shell,
// with retry and WhatsApp, so a down database never leaves the shopper on a bare 500. The error
// goes to Sentry (spec 0027 AC-9).
export default function StorefrontError({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  const { whatsappNumber } = parsePublicEnv();

  return (
    <div className="px-(--page-pad) pt-5 pb-8">
      <ErrorState onRetry={retry} whatsappNumber={whatsappNumber} />
      <ReportToSentry error={error} />
    </div>
  );
}
