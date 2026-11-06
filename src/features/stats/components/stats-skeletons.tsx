import { useTranslations } from "next-intl";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Each section's skeleton while its call is out (spec 0027 AC-7), shaped like what it becomes.
export function VisitsSkeleton() {
  const t = useTranslations("Stats");
  return (
    <LoadingStatus label={t("loading")} className="flex flex-col gap-3">
      <Skeleton className="h-72 rounded-card" />
    </LoadingStatus>
  );
}

export function ListSkeleton() {
  const t = useTranslations("Stats");
  return (
    <LoadingStatus label={t("loading")} className="flex min-w-0 flex-[1_1_22rem] flex-col gap-3">
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-11 rounded-btn" />
      ))}
    </LoadingStatus>
  );
}
