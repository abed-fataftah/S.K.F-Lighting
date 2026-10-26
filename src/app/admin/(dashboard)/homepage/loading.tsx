import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton cards shaped like the editor's three cards while it loads (design.md section 7).
export default async function HomepageLoading() {
  const t = await getTranslations("AdminHomepage");
  return (
    <LoadingStatus label={t("loading")} className="flex max-w-(--admin-form-max) flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-36 rounded-btn" />
      </div>
      {Array.from({ length: 3 }, (_, card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5"
        >
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 2 }, (_, row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="h-14 w-30 rounded-btn" />
              <Skeleton className="h-4 w-56" />
            </div>
          ))}
        </div>
      ))}
    </LoadingStatus>
  );
}
