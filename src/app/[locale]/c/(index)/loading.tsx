import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// `/c` loading (spec 0008 AC-15): the title and three skeleton cards.
export default async function CategoriesLoading() {
  const t = await getTranslations("Categories");
  return (
    <LoadingStatus
      label={t("loadingCategories")}
      className="flex flex-col gap-3 px-(--page-pad) pt-5 pb-8"
    >
      <Skeleton className="h-8 w-32" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-card" />
      ))}
    </LoadingStatus>
  );
}
