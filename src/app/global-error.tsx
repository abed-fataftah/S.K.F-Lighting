"use client";

import { CircleAlert } from "lucide-react";
import { HtmlDocument } from "@/components/html-document";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ReportToSentry } from "@/components/report-to-sentry";
import { StateCard } from "@/components/state-card";
import { Button, ButtonLink } from "@/components/ui/button";
import ar from "@/i18n/messages/ar.json";
import { safePublicEnv } from "@/lib/monitoring-env";
import { whatsappUrl } from "@/lib/whatsapp";
import "./globals.css";

// The last resort (spec 0027 AC-9): a root layout itself failed, so this page replaces it and
// renders its own <html>. next-intl is not available here, so the strings come straight from
// ar.json. The error goes to Sentry; the page keeps the shop's error card, retry, and WhatsApp.
export default function GlobalError({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  const strings = ar.Shell;
  const whatsappNumber = safePublicEnv()?.whatsappNumber;

  return (
    <HtmlDocument>
      <main className="mx-auto flex min-h-dvh w-full max-w-(--page-max) flex-col justify-center bg-page px-(--page-pad) py-8">
        <StateCard
          role="alert"
          heading="h1"
          icon={CircleAlert}
          title={strings.error.title}
          text={strings.error.text}
          actions={
            <>
              <Button size="lg" onClick={() => retry()}>
                {strings.error.retry}
              </Button>
              {whatsappNumber ? (
                <ButtonLink
                  variant="whatsapp"
                  size="lg"
                  href={whatsappUrl(whatsappNumber, strings.whatsappMessages.help)}
                  target="_blank"
                  rel="noopener"
                >
                  <WhatsAppIcon />
                  {strings.error.whatsapp}
                </ButtonLink>
              ) : null}
            </>
          }
        />
        <ReportToSentry error={error} />
      </main>
    </HtmlDocument>
  );
}
