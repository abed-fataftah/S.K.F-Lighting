import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// The help card under a product list (pages/category.md, item 9): a yellow WhatsApp tile, the
// question, a line, and the green button with W2.
export function HelpCard({ href }: { readonly href: string }) {
  const t = useTranslations("Categories");
  return (
    <Card className="mt-4 flex-row items-start gap-3">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-yellow text-ink"
      >
        <WhatsAppIcon className="size-5.5" />
      </span>
      <div className="flex flex-col items-start gap-2">
        <h2 className="type-lead">{t("helpTitle")}</h2>
        <p className="type-small text-muted">{t("helpText")}</p>
        <ButtonLink variant="whatsapp" href={href} target="_blank" rel="noopener">
          <WhatsAppIcon />
          {t("helpButton")}
        </ButtonLink>
      </div>
    </Card>
  );
}
