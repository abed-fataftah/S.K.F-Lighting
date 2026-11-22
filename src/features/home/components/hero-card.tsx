import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/whatsapp";
import { HeroChandelier } from "./hero-chandelier";
import { SectionJump } from "./section-jump";

// The hero card (spec 0011 AC-3; pages/home.md layout 3): the fallback hero, shown when there
// are no products for the coverflow (spec 0030 AC-11). White with a 1px border (spec 0032 AC-11),
// radius 20, the chandelier hanging from the top edge on the physical left (the inline end in
// right to left), the page's one `h1`, line 2 on the orange marker, and the two buttons. "تسوّق المجموعة" goes to the circles and is hidden when there are none. It
// shares the coverflow's surface (spec 0032 AC-5): a card below md, and from md a white band
// across the whole screen with a bottom border, its words and chandelier inside the content box
// (spec 0029 AC-13a), so it sits outside `PageFrame` like the coverflow.
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
      className="relative mx-(--page-pad) mt-3.5 overflow-hidden rounded-hero border border-border bg-white text-ink md:mx-0 md:mt-0 md:rounded-none md:border-x-0 md:border-t-0"
      data-testid="home-hero"
    >
      <div className="relative mx-auto w-full max-w-(--content-max) px-5 pt-6.5 pb-5 md:px-(--page-pad) md:pt-8 md:pb-6">
        {/* On a phone it is drawn at half size in the corner, so it hangs beside the headline and
            never crosses the ink words on white. From md the content box is wide, so the
            chandelier moves in from the corner at full size; from lg it grows to fill the empty
            end of the box. */}
        <HeroChandelier className="absolute -end-4 top-0 h-20 w-25 md:end-8 md:h-40 md:w-50 lg:end-16 lg:h-60 lg:w-75" />
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
            href={whatsappUrl(whatsappNumber, shell("whatsappMessages.consult"))}
            target="_blank"
            rel="noopener"
            className="flex-[1.25]"
          >
            <WhatsAppIcon />
            {t("heroWhatsapp")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
