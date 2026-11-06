import { getTranslations } from "next-intl/server";
import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton cards shaped like the hub's three cards while it loads (design.md section 7).
export default async function SettingsLoading() {
  const t = await getTranslations("AdminSettings");
  return (
    <LoadingStatus label={t("loading")} className="flex max-w-(--admin-column-max) flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 3 }, (_, card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5"
        >
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 2 }, (_, row) => (
            <Skeleton key={row} className="h-11 w-full rounded-btn" />
          ))}
        </div>
      ))}
    </LoadingStatus>
  );
}
