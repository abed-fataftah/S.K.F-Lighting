import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";
import { HeroChandelier } from "./hero-chandelier";
import { SectionJump } from "./section-jump";

// The hero card (spec 0011 AC-3; pages/home.md layout 3): the fallback hero, shown when there
// are no products for the coverflow (spec 0030 AC-11). White with a 1px border (spec 0032 AC-11),
// radius 20, the chandelier hanging from the top edge on the physical left (the inline end in
// right to left), the page's one `h1`, line 2 on the orange marker, and the two buttons. "تسوّق الآن" goes to the circles and is hidden when there are none. From
// md it spans the content width, the words at the start and the chandelier at the end (spec 0029
// AC-13a).
export function HeroCard({
  whatsappNumber,
  jumpTo,
}: {
  readonly whatsappNumber: string;
  readonly jumpTo: "categories" | null;
}) {
  const t = useTranslations("Home");
  const shell = useTranslations("Shell");

  return (
    <section
      aria-labelledby="hero-title"
      className="relative mx-(--page-pad) overflow-hidden rounded-hero border border-border bg-white px-5 pt-6.5 pb-5 text-ink"
      data-testid="home-hero"
    >
      {/* From md the card is wide, so the chandelier moves in from the corner; from lg it grows
          to fill the empty end of the card. */}
      <HeroChandelier className="absolute -end-6.5 top-0 md:end-8 lg:end-16 lg:h-60 lg:w-75" />
      <div className="relative flex min-h-39 flex-col items-start justify-center">
        <h1 id="hero-title" className="flex flex-col type-hero">
          <span>{t("heroLine1")}</span>
          <span className="w-fit rounded-btn bg-brand px-3">{t("heroLine2")}</span>
        </h1>
        <p className="mt-2.5 type-body text-muted">{t("heroText")}</p>
      </div>
      <div className="relative mt-5 flex gap-2.5 md:w-(--form-max) md:max-w-full">
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
