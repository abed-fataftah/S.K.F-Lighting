"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { whatsappUrl } from "@/lib/whatsapp";
import { orderNumberInPath } from "../fab-message";

// The float's link (spec 0013 AC-9): W7 with the order number on a confirmation path, else W1.
// Only the link is a client component, so the added JavaScript stays small.
export function FabLink({
  whatsappNumber,
  className,
  children,
}: {
  readonly whatsappNumber: string;
  readonly className: string;
  readonly children: ReactNode;
}) {
  const t = useTranslations("Shell");
  const number = orderNumberInPath(usePathname());
  const text = number ? t("whatsappMessages.order", { number }) : t("whatsappMessages.general");

  return (
    <a
      href={whatsappUrl(whatsappNumber, text)}
      target="_blank"
      rel="noopener"
      aria-label={t("whatsapp")}
      className={className}
    >
      {children}
    </a>
  );
}
