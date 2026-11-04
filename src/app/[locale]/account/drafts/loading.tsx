import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Drafts loading (spec 0020 AC-20): the title and three cards shaped like the real ones.
export default async function DraftsLoading() {
  const t = await getTranslations("Drafts");
  return (
    <LoadingStatus label={t("loading")} className="flex flex-col gap-2.5 px-(--page-pad) pt-3 pb-8">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-5 w-64" />
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5"
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-44" />
          <div className="flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-btn" />
            <Skeleton className="size-11 rounded-btn" />
          </div>
        </div>
      ))}
    </LoadingStatus>
  );
}
