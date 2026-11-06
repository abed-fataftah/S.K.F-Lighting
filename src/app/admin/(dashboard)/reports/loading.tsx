import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeletons shaped like the report while it loads (spec 0024 AC-11): the title, the chips, the four
// cards, then the chart and the top products side by side.
export default function ReportsLoading() {
  return (
    <LoadingStatus className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-24 rounded-btn" />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(12.5rem,1fr))] gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-64 min-w-0 flex-[1_1_22rem] rounded-card" />
        <Skeleton className="h-64 min-w-0 flex-[1_1_22rem] rounded-card" />
      </div>
    </LoadingStatus>
  );
}
