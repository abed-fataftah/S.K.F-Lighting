import { FolderTree } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { EmptyState } from "@/components/empty-state";
import { PageErrorState } from "@/components/error-state";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getNavigation } from "@/features/catalog/server/queries";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { parsePublicEnv } from "@/lib/public-env";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";
import { withTimeLimit } from "@/server/db/time-limit";

const CATEGORIES_READ_TIMEOUT_MS = 3000;

export async function generateMetadata(): Promise<Metadata> {
  const [t, meta] = await Promise.all([getTranslations("Categories"), getTranslations("Metadata")]);
  const { siteUrl } = parsePublicEnv();
  return {
    title: t("metaTitle"),
    description: meta("description"),
    alternates: { canonical: `${siteUrl}${routes.categories}` },
  };
}

// The categories page (spec 0008 AC-15): every main in navigation, with its count and its
// navigation subs. Not on the design boards; it reuses the card and link sizes of the others.
export default async function CategoriesPage() {
  const [t, shell, result] = await Promise.all([
    getTranslations("Categories"),
    getTranslations("Shell"),
    withTimeLimit(getNavigation, CATEGORIES_READ_TIMEOUT_MS),
  ]);
  const { whatsappNumber } = parsePublicEnv();
  if (!result.ok) console.error("getNavigation: read failed", { error: result.error });

  return (
    <div className="flex flex-col gap-4 px-(--page-pad) pt-5 pb-8">
      <h1 className="type-title-l">{t("title")}</h1>
      {!result.ok ? (
        <PageErrorState title={t("categoriesErrorTitle")} whatsappNumber={whatsappNumber} />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t("noCategoriesTitle")}
          text={t("noCategoriesText")}
          actions={
            <ButtonLink
              variant="whatsapp"
              size="lg"
              href={whatsappUrl(whatsappNumber, shell("whatsappMessages.help"))}
              target="_blank"
              rel="noopener"
            >
              <WhatsAppIcon />
              {t("emptyAsk")}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="category-list">
          {result.data.map((main) => (
            <li key={main.slug}>
              <Card className="gap-1">
                <h2 className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={routes.category(main.slug)}
                    className="inline-flex min-h-11 items-center type-title-s underline-offset-4 hover:underline"
                  >
                    {main.name}
                  </Link>
                  <span className="type-small text-muted">
                    {t("count", { shown: formatNumber(main.productCount) })}
                  </span>
                </h2>
                {main.subs.length ? (
                  <ul className="flex flex-wrap gap-x-4">
                    {main.subs.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          href={routes.subcategory(main.slug, sub.slug)}
                          className="inline-flex min-h-11 items-center underline underline-offset-4"
                        >
                          {sub.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
