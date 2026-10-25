import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { GridSkeleton } from "@/features/catalog/components/list-results";

// `/search` loading (spec 0010 AC-6): the title area and six skeleton cards.
export default async function SearchLoading() {
  const t = await getTranslations("Search");
  return (
    <div className="flex flex-col gap-3 px-(--page-pad) pt-5 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="type-title-l">{t("title")}</h1>
        <Skeleton className="h-4 w-40" />
      </div>
      <GridSkeleton label={t("loading")} />
    </div>
  );
}
