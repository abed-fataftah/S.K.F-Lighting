import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NewDraftCard } from "@/features/drafts/components/name-card";
import { QuickOrder } from "@/features/drafts/components/quick-order";
import { requireElectricianPage } from "@/features/drafts/server/guard";
import { readDraft } from "@/features/drafts/server/read-draft";
import { isUuid } from "@/lib/uuid";
import { routes } from "@/lib/routes";
import { getDb } from "@/server/db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PageTitles");
  return { title: t("quickOrder"), robots: { index: false } };
}

// Quick order (spec 0020; docs/design/pages/quick-order.md), electricians only. With no `draft`
// it asks for a name first; with one it opens that draft, only when this account owns it. A
// draft id that is not a uuid, missing, someone else's, or already sent lands on the list.
export default async function QuickOrderPage({
  searchParams,
}: PageProps<"/[locale]/account/quick-order">) {
  const query = await searchParams;
  const draftId = typeof query.draft === "string" ? query.draft : null;
  const account = await requireElectricianPage(
    draftId && isUuid(draftId) ? routes.quickOrderDraft(draftId) : routes.quickOrder,
  );
  const t = await getTranslations("QuickOrder");

  const draft =
    draftId === null
      ? null
      : isUuid(draftId)
        ? await readDraft(await getDb(), account.userId, draftId)
        : null;
  if (draftId !== null && !draft) redirect(routes.drafts);

  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="type-title-l">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </div>
      {draft ? (
        <QuickOrder
          draft={draft}
          mine={{ name: account.profile?.fullName ?? null, phone: account.profile?.phone ?? null }}
        />
      ) : (
        <NewDraftCard />
      )}
    </div>
  );
}
