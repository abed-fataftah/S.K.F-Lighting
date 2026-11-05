import { LoadingStatus } from "@/components/loading-status";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton shaped like the import page (its title and two upload cards), so it does not borrow
// the products list's table skeleton (design.md section 7).
export default function ProductImportLoading() {
  return (
    <LoadingStatus className="flex max-w-(--admin-form-max) flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-prose" />
      {Array.from({ length: 2 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-card border border-border bg-white p-3.5"
        >
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      ))}
    </LoadingStatus>
  );
}
