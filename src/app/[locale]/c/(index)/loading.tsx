import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";
import { PageFrame } from "@/components/page-frame";

// `/c` loading (spec 0008 AC-15): the title and three skeleton cards.
export default async function CategoriesLoading() {
  const t = await getTranslations("Categories");
  return (
    <PageFrame width="wide">
      <LoadingStatus
        label={t("loadingCategories")}
        className="flex flex-col gap-4 px-(--page-pad) pt-5 pb-8"
      >
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      </LoadingStatus>
    </PageFrame>
  );
}
