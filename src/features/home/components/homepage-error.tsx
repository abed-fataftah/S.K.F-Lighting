"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";

// The homepage editor's error card (spec 0011 AC-8): an alert with a retry that renders the page
// again. The dashboard has no WhatsApp button; the owner is the one being asked.
export function HomepageError() {
  const t = useTranslations("AdminHomepage");
  const router = useRouter();
  return (
    <StateCard
      role="alert"
      icon={CircleAlert}
      title={t("errorTitle")}
      text={t("errorText")}
      className="max-w-(--admin-form-max)"
      actions={<Button onClick={() => router.refresh()}>{t("retry")}</Button>}
    />
  );
}
