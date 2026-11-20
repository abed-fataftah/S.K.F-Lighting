import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { PageFrame } from "@/components/page-frame";
import { ButtonLink } from "@/components/ui/button";
import { getWhatsappNumber } from "@/features/shell/server/shop-contact";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";

// An unknown product, category, or order (design pages/not-found.md): the 404 card inside the
// shell, in the narrow column (spec 0029 AC-17), with the ways forward. Next adds `noindex`.
export default async function StorefrontNotFound() {
  const [t, shell, whatsappNumber] = await Promise.all([
    getTranslations("NotFound"),
    getTranslations("Shell"),
    getWhatsappNumber(),
  ]);

  return (
    <PageFrame width="form" className="px-(--page-pad) pt-7 pb-8">
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-white px-5 py-8 text-center text-ink">
        <p className="type-404" dir="ltr" aria-hidden>
          {formatNumber(404)}
        </p>
        <h1 className="type-title-m">{t("title")}</h1>
        <p className="text-muted">{t("text")}</p>
        <div className="mt-1 flex w-full flex-col gap-2.5">
          <ButtonLink size="lg" render={<Link href={routes.home} />}>
            {t("home")}
          </ButtonLink>
          <ButtonLink variant="outline" size="lg" render={<Link href={routes.categories} />}>
            {t("browse")}
          </ButtonLink>
          <ButtonLink
            variant="whatsapp"
            size="lg"
            href={whatsappUrl(whatsappNumber, shell("whatsappMessages.help"))}
            target="_blank"
            rel="noopener"
          >
            <WhatsAppIcon />
            {t("whatsapp")}
          </ButtonLink>
        </div>
      </div>
    </PageFrame>
  );
}
