import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton rows shaped like the products list while it loads (design.md section 7).
export default function ProductsLoading() {
  return (
    <LoadingStatus className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-36 rounded-card" />
      <div className="flex flex-col gap-2 rounded-card border border-border bg-white p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-(--size-tile-table) rounded-btn" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}
