import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { contactLine, type ContactLine } from "../contact";
import { policyLinks } from "../nav";
import { Logo } from "./logo";

// SiteFooter (handoff section 6, spec 0003 AC-15): black, 13px light grey text; the logo,
// the shop's phone and address from shop_settings (a missing part is hidden), "تتبّع طلبك"
// (spec 0015 AC-15), and the three policy links, each 44 high. The bottom padding keeps the last link clear of the WhatsApp
// float and the bottom bar when scrolled to the very end.
// From md the black spans the screen around the content box; from lg it is one row, logo and
// contact at the start, links at the end, with room under it for the float alone (spec 0029 AC-8).
export function SiteFooter({ contact }: { readonly contact: ContactLine }) {
  const t = useTranslations("Shell");
  const line = contactLine(contact);

  return (
    <footer className="on-dark mt-8.5 bg-ink type-small text-on-dark-muted">
      <div className="mx-auto flex w-full max-w-(--content-max) flex-col px-4.5 pt-6 pb-[calc(var(--fab-bottom)+var(--size-fab)-var(--h-bottom-bar)+var(--sp-12))] md:px-(--page-pad) lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:pb-[calc(var(--fab-bottom)+var(--size-fab)+var(--sp-12))]">
        <div className="flex flex-col">
          <Logo place="footer" className="self-end lg:self-start" />
          {line ? (
            <p className="mt-3 mb-3.5 lg:mb-0" data-testid="footer-contact">
              {line.phone ? <Ltr>{line.phone}</Ltr> : null}
              {line.phone && line.address ? " · " : null}
              {line.address}
            </p>
          ) : null}
        </div>
        <nav aria-label={t("footerLinks")}>
          <ul className="flex flex-col lg:flex-row lg:flex-wrap lg:gap-x-6">
            <li>
              <Link href={routes.orderTrack} className="flex min-h-11 items-center hover:underline">
                {t("footerTrack")}
              </Link>
            </li>
            {policyLinks.map(({ id, href }) => (
              <li key={id}>
                <Link href={href} className="flex min-h-11 items-center hover:underline">
                  {t(`policies.${id}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
