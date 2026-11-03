import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeletons shaped like a customer's page while it loads (spec 0019 AC-16).
export default function CustomerLoading() {
  return (
    <LoadingStatus className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <Skeleton className="h-64 flex-[2_1_var(--admin-detail-main)] rounded-card" />
        <Skeleton className="h-64 flex-[1_1_var(--admin-detail-side)] rounded-card" />
      </div>
    </LoadingStatus>
  );
}
