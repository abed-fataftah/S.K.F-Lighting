"use client";

import { CircleAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { StateCard } from "@/components/state-card";
import { Button, ButtonLink } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";

// Something failed (design.md section 7): the error card, announced as an alert, always
// with a retry button and a WhatsApp button so the shopper is never stuck.
export function ErrorState({
  icon = CircleAlert,
  title,
  text,
  onRetry,
  whatsappNumber,
  whatsappText,
  className,
}: {
  readonly icon?: LucideIcon;
  readonly title?: ReactNode;
  readonly text?: ReactNode;
  readonly onRetry: () => void;
  readonly whatsappNumber: string;
  /** The prefilled message; defaults to W2 ("I need help"). */
  readonly whatsappText?: string;
  readonly className?: string;
}) {
  const t = useTranslations("Shell");

  return (
    <StateCard
      role="alert"
      data-slot="error-state"
      icon={icon}
      title={title ?? t("error.title")}
      text={text ?? t("error.text")}
      className={className}
      actions={
        <>
          <Button size="lg" onClick={onRetry}>
            {t("error.retry")}
          </Button>
          <ButtonLink
            variant="whatsapp"
            size="lg"
            href={whatsappUrl(whatsappNumber, whatsappText ?? t("whatsappMessages.help"))}
            target="_blank"
            rel="noopener"
          >
            <WhatsAppIcon />
            {t("error.whatsapp")}
          </ButtonLink>
        </>
      }
    />
  );
}
