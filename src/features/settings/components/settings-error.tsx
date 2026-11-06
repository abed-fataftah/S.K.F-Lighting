"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";

// The settings hub's error card: an alert with a retry that renders the page again.
export function SettingsError() {
  const t = useTranslations("AdminSettings");
  const router = useRouter();
  return (
    <StateCard
      role="alert"
      icon={CircleAlert}
      title={t("errorTitle")}
      text={t("errorText")}
      className="max-w-(--admin-column-max)"
      actions={<Button onClick={() => router.refresh()}>{t("retry")}</Button>}
    />
  );
}
