import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { PageFrame } from "@/components/page-frame";
import { cn } from "@/lib/utils";

// Home loading (spec 0011 AC-7, spec 0030 AC-14): skeletons of the real layout, announced once as
// "جارٍ التحميل". The hero's shape first, on the black hero surface: two headline lines, the
// subline, the centre card, the dots, and the two buttons; then the category cards with their grid
// (spec 0031 AC-9) and the trust cards.
export default async function HomeLoading() {
  const t = await getTranslations("Home");
  const block = "bg-sidebar-active";
  return (
    <LoadingStatus label={t("loading")} className="flex flex-col">
      <div className="mx-(--page-pad) mt-3.5 overflow-hidden rounded-hero bg-ink md:mx-0 md:mt-0 md:rounded-none">
        <div className="mx-auto flex w-full max-w-(--content-max) flex-col items-start px-5 pt-6.5 pb-5 md:px-(--page-pad) md:pt-8 md:pb-6 lg:items-center lg:pt-10 lg:pb-8">
          <Skeleton className={`h-10 w-44 ${block}`} />
          <Skeleton className={`mt-1 h-10 w-36 ${block}`} />
          <Skeleton className={`mt-4 h-5 w-52 ${block}`} />
          <Skeleton
            className={`mt-5 aspect-4/5 w-(--coverflow-card) self-center rounded-card ${block}`}
          />
          <div className="mt-6 flex gap-6 self-center">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className={`size-2.5 rounded-full ${block}`} />
            ))}
          </div>
          <div className="mt-5 flex w-full gap-2.5 md:w-(--form-max) md:max-w-full">
            <Skeleton className={`h-13 flex-1 rounded-card ${block}`} />
            <Skeleton className={`h-13 flex-[1.25] rounded-card ${block}`} />
          </div>
        </div>
      </div>
      <PageFrame width="wide" className="flex flex-col gap-8.5 pt-7.5 pb-8">
        <div className="flex flex-col gap-3 px-(--page-pad)">
          <Skeleton className="h-7 w-44 self-center" />
          <div className="flex gap-3 overflow-hidden pt-3 md:justify-center md:gap-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="aspect-4/5 w-(--category-card) shrink-0 rounded-card" />
            ))}
          </div>
          <Skeleton className="mt-3 h-6 w-32" />
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-3 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-(--h-card-image) rounded-card",
                  i >= 2 && "hidden md:block",
                  i >= 3 && "md:hidden lg:block",
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
      </PageFrame>
    </LoadingStatus>
  );
}
