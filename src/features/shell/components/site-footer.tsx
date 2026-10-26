import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { Link } from "@/i18n/navigation";
import { contactLine, type ShopContact } from "../contact";
import { policyLinks } from "../nav";
import { Logo } from "./logo";

// SiteFooter (handoff section 6, spec 0003 AC-15): black, 13px light grey text; the logo,
// the shop's phone and address from shop_settings (a missing part is hidden), and the three
// policy links, each 44 high. The bottom padding keeps the last link clear of the WhatsApp
// float and the bottom bar when scrolled to the very end.
export function SiteFooter({ contact }: { readonly contact: ShopContact }) {
  const t = useTranslations("Shell");
  const line = contactLine(contact);

  return (
    <footer className="on-dark mt-8.5 flex flex-col bg-ink px-4.5 pt-6 pb-[calc(var(--fab-bottom)+var(--size-fab)-var(--h-bottom-bar)+var(--sp-12))] type-small text-on-dark-muted">
      <Logo place="footer" className="self-end" />
      {line ? (
        <p className="mt-3 mb-3.5" data-testid="footer-contact">
          {line.phone ? <Ltr>{line.phone}</Ltr> : null}
          {line.phone && line.address ? " · " : null}
          {line.address}
        </p>
      ) : null}
      <nav aria-label={t("footerLinks")}>
        <ul className="flex flex-col">
          {policyLinks.map(({ id, href }) => (
            <li key={id}>
              <Link href={href} className="flex min-h-11 items-center">
                {t(`policies.${id}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
