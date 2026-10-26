import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Home loading (spec 0011 AC-7): skeletons of the real layout, the hero or banner, the circles,
// two product cards, and the four trust cards, announced once as "جارٍ التحميل".
export default async function HomeLoading() {
  const t = await getTranslations("Home");
  return (
    <LoadingStatus label={t("loading")} className="flex flex-col gap-8.5 pt-3.5 pb-8">
      <div className="px-(--page-pad)">
        <Skeleton className="aspect-video w-full rounded-hero" />
      </div>
      <div className="flex flex-col items-center gap-3 px-(--page-pad)">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-3.5 pt-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="size-24 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-(--page-pad)">
        <Skeleton className="h-7 w-36" />
        <div className="grid grid-cols-2 gap-2.5">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-(--page-pad)">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
    </LoadingStatus>
  );
}
