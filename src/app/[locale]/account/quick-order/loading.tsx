import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Quick order loading (spec 0020 AC-20): the title, the name card, and one line card.
export default async function QuickOrderLoading() {
  const t = await getTranslations("QuickOrder");
  return (
    <LoadingStatus label={t("loading")} className="flex flex-col gap-3 px-(--page-pad) pt-3 pb-8">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-5 w-64" />
      <div className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 rounded-card" />
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-btn" />
          <Skeleton className="h-11 flex-1 rounded-btn" />
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-12 rounded-card" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-12 rounded-card" />
          <Skeleton className="h-12 rounded-card" />
          <Skeleton className="h-12 rounded-card" />
        </div>
      </div>
    </LoadingStatus>
  );
}
