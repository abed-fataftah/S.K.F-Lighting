import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";
import { HeroChandelier } from "./hero-chandelier";
import { SectionJump } from "./section-jump";

// The hero card (spec 0011 AC-3; pages/home.md layout 3): shown when no banner is on. Black,
// radius 20, the chandelier hanging from the top edge on the physical left (the inline end in
// right to left), the page's one `h1`, and the two buttons. "تسوّق الآن" goes to the circles, or
// to the featured products when there are none, and is hidden when both are.
export function HeroCard({
  whatsappNumber,
  jumpTo,
}: {
  readonly whatsappNumber: string;
  readonly jumpTo: "categories" | "featured" | null;
}) {
  const t = useTranslations("Home");
  const shell = useTranslations("Shell");

  return (
    <section
      aria-labelledby="hero-title"
      className="on-dark relative mx-(--page-pad) overflow-hidden rounded-hero border border-sidebar-active bg-ink px-5 pt-6.5 pb-5 text-white"
      data-testid="home-hero"
    >
      <HeroChandelier className="absolute -end-6.5 top-0" />
      <div className="relative flex min-h-39 flex-col items-start justify-center">
        <h1 id="hero-title" className="flex flex-col type-hero">
          <span>{t("heroLine1")}</span>
          <span className="text-yellow">{t("heroLine2")}</span>
        </h1>
        <p className="mt-2.5 type-body text-on-dark-muted">{t("heroText")}</p>
      </div>
      <div className="relative mt-5 flex gap-2.5">
        {jumpTo ? (
          <SectionJump section={jumpTo} className="flex-1">
            {t("shopNow")}
          </SectionJump>
        ) : null}
        <ButtonLink
          variant="whatsapp"
          size="lg"
          href={whatsappUrl(whatsappNumber, shell("whatsappMessages.general"))}
          target="_blank"
          rel="noopener"
          className="flex-[1.25]"
        >
          <WhatsAppIcon />
          {t("heroWhatsapp")}
        </ButtonLink>
      </div>
    </section>
  );
}
