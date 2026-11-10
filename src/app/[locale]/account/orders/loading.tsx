import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { PageFrame } from "@/components/page-frame";

// My Orders loading (spec 0018 AC-9): the title and three cards shaped like the real ones.
export default async function MyOrdersLoading() {
  const t = await getTranslations("MyOrders");
  return (
    <PageFrame width="wide">
      <LoadingStatus
        label={t("loading")}
        className="flex flex-col gap-2.5 px-(--page-pad) pt-3 pb-8"
      >
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-11 w-40 rounded-btn" />
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-20 rounded-btn" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-11 rounded-btn" />
            </div>
          ))}
        </div>
      </LoadingStatus>
    </PageFrame>
  );
}
