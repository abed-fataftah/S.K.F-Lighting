"use client";

import { CircleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";

// The report failed to load (spec 0024 AC-11): an alert card with one retry, which reads the page
// again from the server and renders it in place of this card.
export default function ReportsError({
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  const t = useTranslations("AdminReports");

  return (
    <StateCard
      role="alert"
      icon={CircleAlert}
      title={t("loadError")}
      data-testid="reports-error"
      actions={
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
      }
    />
  );
}
