import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { policySlugs } from "@/features/policies/slugs";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { SettingsPolicy } from "../server/settings-db";

// "صفحات السياسات" (spec 0025 AC-10): the three pages in tab order, each with its last saved date
// and a link to its editor.
export async function PoliciesCard({ policies }: { readonly policies: readonly SettingsPolicy[] }) {
  const t = await getTranslations("AdminSettings");
  const rows = policySlugs.flatMap((slug) => policies.filter((page) => page.slug === slug));

  return (
    <Card>
      <h2 className="type-title-s">{t("policiesTitle")}</h2>
      <ul aria-label={t("policiesTitle")} className="flex flex-col border-t border-border">
        {rows.map((page) => (
          <li
            key={page.slug}
            className="flex flex-wrap items-center gap-3 border-b border-border py-2.5"
            data-testid={`policy-row-${page.slug}`}
          >
            <span className="flex min-w-0 flex-1 basis-48 flex-col">
              <span className="font-extrabold">{page.title}</span>
              <span className="type-small text-muted">
                {t("updated", { date: formatDate(page.updatedAt) })}
              </span>
            </span>
            <ButtonLink
              variant="outline"
              render={<Link href={routes.admin.policy(page.slug)} />}
              aria-label={t("editLabel", { title: page.title })}
            >
              {t("edit")}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
