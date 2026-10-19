"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

// The yellow delivery strip (handoff section 6): on the home page only. Fixed copy of
// home.01 until feature 25 decides whether it comes from delivery_zones.
// `show` forces it on (the gallery).
export function InfoStrip({ show }: { readonly show?: boolean }) {
  const t = useTranslations("Shell");
  const pathname = usePathname();
  if (!show && pathname !== routes.home) return null;

  return (
    <p className="bg-yellow px-3 py-2 text-center type-caption font-extrabold text-ink">
      {t("infoStrip")}
    </p>
  );
}
