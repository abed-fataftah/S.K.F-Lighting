import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { PageFrame } from "@/components/page-frame";

// Home loading (spec 0011 AC-7, spec 0030 AC-14): skeletons of the real layout, announced once as
// "جارٍ التحميل". The hero's shape first, on the black hero surface: two headline lines, the
// subline, the centre card, the dots, and the two buttons; then the circles and the trust cards.
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
        <div className="flex flex-col items-center gap-3 px-(--page-pad)">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
          <div className="flex gap-3.5 pt-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="size-24 rounded-full" />
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
