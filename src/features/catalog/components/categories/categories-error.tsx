"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { StateCard } from "@/components/state-card";
import { Button } from "@/components/ui/button";

// The categories page's error card (spec 0008 AC-1): an alert with a retry that renders the page
// again. The dashboard has no WhatsApp button; the owner is the one being asked.
export function CategoriesError() {
  const t = useTranslations("AdminCategories");
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
