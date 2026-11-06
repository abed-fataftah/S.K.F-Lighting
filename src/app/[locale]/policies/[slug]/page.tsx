import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterChipLink } from "@/features/catalog/components/filter-chip-link";
import { PolicyBody } from "@/features/policies/components/policy-body";
import { getPolicyPage } from "@/features/policies/server/queries";
import { isPolicySlug, policySlugs } from "@/features/policies/slugs";
import { getWhatsappNumber } from "@/features/shell/server/shop-contact";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";

async function loadPage(slug: string) {
  if (!isPolicySlug(slug)) notFound();
  return (await getPolicyPage(slug)) ?? notFound();
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/policies/[slug]">): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("PageTitles")]);
  const page = await loadPage(slug);
  return { title: t("policy", { title: page.title }) };
}

// A policy page (spec 0025 AC-8, AC-13; docs/design/pages/policies.md): the owner's title and
// text, tabs to the other two, the last saved date, and a WhatsApp card for questions. Any other
// slug, or a missing row, is a 404; a failed read goes to the storefront error card.
export default async function PolicyPage({ params }: PageProps<"/[locale]/policies/[slug]">) {
  const { slug } = await params;
  const page = await loadPage(slug);
  const [t, shell, whatsappNumber] = await Promise.all([
    getTranslations("Policies"),
    getTranslations("Shell"),
    getWhatsappNumber(),
  ]);

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <h1 className="py-3 type-title-l">{page.title}</h1>
      <nav aria-label={t("tabsLabel")} className="-mx-(--page-pad) overflow-x-auto px-(--page-pad)">
        <ul className="flex gap-2">
          {policySlugs.map((tab) => (
            <li key={tab}>
              <FilterChipLink href={routes.policy(tab)} current={tab === page.slug} check={false}>
                {shell(`policies.${tab}`)}
              </FilterChipLink>
            </li>
          ))}
        </ul>
      </nav>
      <Card>
        <p className="type-small text-muted" data-testid="policy-updated">
          {t("updated", { date: formatDate(page.updatedAt) })}
        </p>
        <PolicyBody markdown={page.body} />
      </Card>
      <Card>
        <h2 className="type-lead">{t("questionTitle")}</h2>
        <ButtonLink
          variant="whatsapp"
          className="self-start"
          href={whatsappUrl(whatsappNumber, t("whatsappMessage"))}
          target="_blank"
          rel="noopener"
          data-testid="policy-whatsapp"
        >
          <WhatsAppIcon />
          {shell("menuWhatsapp")}
        </ButtonLink>
      </Card>
    </div>
  );
}
