import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";
import { SectionJump } from "./section-jump";

// The side card beside the banners from lg (spec 0029 AC-13b): the hero's words in a compact black
// card at the end third of the row. Its headline is an `h2`; the page's `h1` stays the hidden shop
// name above the banners. "تسوّق الآن" goes where the hero's would, and hides when it would.
export function HomeSideCard({
  whatsappNumber,
  jumpTo,
  className,
}: {
  readonly whatsappNumber: string;
  readonly jumpTo: "categories" | "featured" | null;
  readonly className?: string;
}) {
  const t = useTranslations("Home");
  const shell = useTranslations("Shell");

  return (
    <section
      aria-labelledby="home-side-title"
      className={cn(
        "on-dark flex-col justify-center gap-4 rounded-card border border-sidebar-active bg-ink p-6 text-white",
        className,
      )}
      data-testid="home-side-card"
    >
      <div className="flex flex-col gap-2">
        <h2 id="home-side-title" className="flex flex-col type-title-l">
          <span>{t("heroLine1")}</span>
          <span className="text-yellow">{t("heroLine2")}</span>
        </h2>
        <p className="type-body text-on-dark-muted">{t("heroText")}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        {jumpTo ? <SectionJump section={jumpTo}>{t("shopNow")}</SectionJump> : null}
        <ButtonLink
          variant="whatsapp"
          size="lg"
          href={whatsappUrl(whatsappNumber, shell("whatsappMessages.general"))}
          target="_blank"
          rel="noopener"
        >
          <WhatsAppIcon />
          {t("heroWhatsapp")}
        </ButtonLink>
      </div>
    </section>
  );
}
