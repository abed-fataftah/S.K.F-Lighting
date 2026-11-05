import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton cards shaped like the categories list while it loads (design.md section 7).
export default async function CategoriesLoading() {
  const t = await getTranslations("AdminCategories");
  return (
    <LoadingStatus label={t("loading")} className="flex max-w-(--admin-column-max) flex-col gap-3">
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-11 w-48 rounded-btn" />
          </div>
          <Skeleton className="h-4 w-56" />
        </div>
      ))}
    </LoadingStatus>
  );
}
