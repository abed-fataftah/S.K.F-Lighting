import { CircleCheck, FileText } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteDraftDialog } from "@/features/drafts/components/delete-draft-dialog";
import { requireElectricianPage } from "@/features/drafts/server/guard";
import { readMyDrafts } from "@/features/drafts/server/read-draft";
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("drafts"), robots: { index: false } };
}

// My drafts (spec 0020 AC-3, AC-15; docs/design/pages/drafts.md), electricians only: one card per
// draft, newest edit first. At most 30 drafts exist, so there is no paging.
export default async function DraftsPage({ searchParams }: PageProps<"/[locale]/account/drafts">) {
  const [account, query, t] = await Promise.all([
    requireElectricianPage(routes.drafts),
    searchParams,
    getTranslations("Drafts"),
  ]);
  const drafts = await readMyDrafts(await getDb(), account.userId);
  const newDraft = (
    <ButtonLink render={<Link href={routes.quickOrder} />} data-testid="new-draft">
      {t("newDraft")}
    </ButtonLink>
  );

  return (
    <div className="flex flex-col gap-2.5 px-(--page-pad) pt-3 pb-8">
      <div className="flex flex-col gap-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="type-title-l">{t("title")}</h1>
          {drafts.length > 0 ? newDraft : null}
        </div>
        <p className="text-muted">{t("intro")}</p>
      </div>
      {query.notice === "deleted" ? (
        <p role="status" className="flex items-center gap-2 font-bold" data-testid="draft-deleted">
          <CircleCheck aria-hidden className="size-5.5 shrink-0" />
          {t("deleted")}
        </p>
      ) : null}
      {drafts.length === 0 ? (
        <EmptyState icon={FileText} title={t("emptyTitle")} text={t("intro")} actions={newDraft} />
      ) : (
        <ul className="flex flex-col gap-2.5" data-testid="drafts-list">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Card data-testid="draft-card">
                <div className="flex flex-col gap-0.5">
                  <h2 className="type-lead font-extrabold">{draft.name}</h2>
                  <p className="type-small text-muted">
                    {t("meta", {
                      lines: t("lines", {
                        count: draft.lineCount,
                        shown: formatNumber(draft.lineCount),
                      }),
                      date: formatDate(draft.updatedAt),
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ButtonLink
                    className="flex-1"
                    render={<Link href={routes.quickOrderDraft(draft.id)} />}
                    data-testid="open-draft"
                  >
                    {t("open")}
                  </ButtonLink>
                  <DeleteDraftDialog draftId={draft.id} name={draft.name} variant="icon" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
