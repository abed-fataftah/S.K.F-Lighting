import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton rows shaped like the customers list while it loads (spec 0019 AC-16).
export default function CustomersLoading() {
  return (
    <LoadingStatus className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-12 rounded-btn" />
      <div className="flex flex-col gap-3 rounded-card border border-border bg-white p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}
