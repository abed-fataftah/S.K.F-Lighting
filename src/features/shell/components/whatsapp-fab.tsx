import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { whatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { FabLink } from "./fab-link";

// The floating WhatsApp button (handoff section 6, spec 0003 AC-17): a 52px green circle
// with a white border, 14px from the inline end edge of the 480 column and 84px above the
// bottom (clear of the bottom bar and the home indicator). Opens W1 in a new tab, or W7 with
// the order number on a confirmation page (spec 0013 AC-9).
// `static` puts it in the page flow (the gallery, outside `[locale]`), always with W1.
export function WhatsAppFab({
  whatsappNumber,
  static: inFlow = false,
}: {
  readonly whatsappNumber: string;
  readonly static?: boolean;
}) {
  const t = useTranslations("Shell");
  const className = cn(
    "flex size-(--size-fab) items-center justify-center rounded-full border-2 border-white bg-whatsapp text-white",
    inFlow
      ? "relative"
      : "fixed end-[max(var(--sp-14),calc((100vw-var(--page-max))/2+var(--sp-14)))] bottom-[calc(var(--fab-bottom)+env(safe-area-inset-bottom))] z-(--z-fab)",
  );
  const icon = <WhatsAppIcon className="size-6.5" />;

  if (!inFlow) {
    return (
      <FabLink whatsappNumber={whatsappNumber} className={className}>
        {icon}
      </FabLink>
    );
  }
  return (
    <a
      href={whatsappUrl(whatsappNumber, t("whatsappMessages.general"))}
      target="_blank"
      rel="noopener"
      aria-label={t("whatsapp")}
      className={className}
    >
      {icon}
    </a>
  );
}
