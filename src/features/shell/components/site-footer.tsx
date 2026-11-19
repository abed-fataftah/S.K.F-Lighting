import { useTranslations } from "next-intl";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Ltr } from "@/components/ltr";
import { Link } from "@/i18n/navigation";
import { shopYear } from "@/lib/format";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { contactLine, type ContactLine } from "../contact";
import { policyLinks } from "../nav";
import { Logo } from "./logo";
import type { MenuCategory } from "./menu-sheet";

/** How many navigation mains the desktop footer lists before "جميع المنتجات". */
const FOOTER_CATEGORIES = 6;

const footerLink =
  "flex min-h-11 items-center transition-colors duration-(--dur-hover) hover:text-brand hover:underline";

// SiteFooter (handoff section 6, spec 0003 AC-15): black, 13px light grey text; the logo,
// the shop's phone and address from shop_settings (a missing part is hidden), "تتبّع طلبك"
// (spec 0015 AC-15), and the three policy links, each 44 high. The bottom padding keeps the last
// link clear of the WhatsApp float and the bottom bar when scrolled to the very end.
// Below lg exactly that, in one column. From lg (spec 0029 AC-8) three columns inside the content
// box: the brand (logo, contact line, a WhatsApp button), "تسوّق" (the first navigation mains and
// "جميع المنتجات"), and "خدمة العملاء" (track order and the policies), then a line with the copyright,
// with room under it for the float alone.
export function SiteFooter({
  contact,
  whatsappNumber,
  categories = [],
}: {
  readonly contact: ContactLine;
  readonly whatsappNumber: string;
  /** The navigation mains (the menu sheet's list); empty hides the "تسوّق" column. */
  readonly categories?: readonly MenuCategory[];
}) {
  const t = useTranslations("Shell");
  const line = contactLine(contact);
  const shop = categories.slice(0, FOOTER_CATEGORIES);

  return (
    <footer className="on-dark mt-8.5 bg-ink type-small text-on-dark-muted">
      <div className="mx-auto w-full max-w-(--content-max) px-4.5 pt-6 pb-[calc(var(--fab-bottom)+var(--size-fab)-var(--h-bottom-bar)+var(--sp-12))] md:px-(--page-pad) lg:pt-10 lg:pb-[calc(var(--fab-bottom)+var(--size-fab)+var(--sp-4))]">
        <div className="flex flex-col lg:grid lg:grid-cols-[2fr_1fr_1fr] lg:gap-10">
          <div className="flex flex-col lg:items-start">
            <Logo place="footer" className="self-end lg:self-start" />
            {line ? (
              <p className="mt-3 mb-3.5 lg:mb-0" data-testid="footer-contact">
                {line.phone ? <Ltr>{line.phone}</Ltr> : null}
                {line.phone && line.address ? " · " : null}
                {line.address}
              </p>
            ) : null}
            <a
              href={whatsappUrl(whatsappNumber, t("whatsappMessages.general"))}
              target="_blank"
              rel="noopener"
              className="mt-5 hidden h-11 items-center gap-2 rounded-btn bg-whatsapp px-4 type-body font-bold text-white transition-[filter] duration-(--dur-hover) hover:brightness-95 lg:inline-flex"
              data-testid="footer-whatsapp"
            >
              <WhatsAppIcon className="size-5" />
              {t("menuWhatsapp")}
            </a>
          </div>
          {shop.length ? (
            <nav aria-labelledby="footer-shop" className="hidden lg:block">
              <h2 id="footer-shop" className="mb-2 type-lead text-white">
                {t("footerShop")}
              </h2>
              <ul>
                {shop.map((category) => (
                  <li key={category.slug}>
                    <Link href={routes.category(category.slug)} className={footerLink}>
                      {category.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href={routes.categories} className={`${footerLink} font-bold text-brand`}>
                    {t("allCategories")}
                  </Link>
                </li>
              </ul>
            </nav>
          ) : null}
          <div className="lg:col-start-3">
            <h2 className="mb-2 hidden type-lead text-white lg:block">{t("footerHelp")}</h2>
            <nav aria-label={t("footerLinks")}>
              <ul className="flex flex-col">
                <li>
                  <Link href={routes.orderTrack} className={footerLink}>
                    {t("footerTrack")}
                  </Link>
                </li>
                {policyLinks.map(({ id, href }) => (
                  <li key={id}>
                    <Link href={href} className={footerLink}>
                      {t(`policies.${id}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        <p
          className="mt-8 hidden border-t border-on-dark-muted/30 pt-5 lg:block"
          data-testid="footer-copyright"
        >
          <Ltr>© {shopYear(new Date())}</Ltr> {t("footerCopyright")}
        </p>
      </div>
    </footer>
  );
}
