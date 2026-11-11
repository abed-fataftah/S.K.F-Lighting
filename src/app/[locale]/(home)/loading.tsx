import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { PageFrame } from "@/components/page-frame";
import { cn } from "@/lib/utils";

// Home loading (spec 0011 AC-7): skeletons of the real layout, the hero or banner, the circles,
// two product cards, and the four trust cards, announced once as "جارٍ التحميل". From md it takes
// the wide Home shape (spec 0029 AC-13): a side card beside the banner at lg, wider grids.
export default async function HomeLoading() {
  const t = await getTranslations("Home");
  return (
    <PageFrame width="wide">
      <LoadingStatus label={t("loading")} className="flex flex-col gap-8.5 pt-3.5 pb-8">
        <div className="px-(--page-pad) lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-4">
          <Skeleton className="aspect-video w-full rounded-hero md:mx-auto md:max-w-(--prose-max) lg:max-w-none" />
          <Skeleton className="hidden rounded-hero lg:block" />
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
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-72 rounded-card",
                  i >= 2 && "hidden md:block",
                  i === 3 && "md:hidden lg:block",
                )}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-(--page-pad) lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      </LoadingStatus>
    </PageFrame>
  );
}
