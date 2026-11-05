import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6: fill-muted blocks shaped like the real content, pulsing at
// --dur-skeleton (0s, so still, under reduced motion). Radius 4 for blocks; pass
// rounded-btn or rounded-card for buttons and large areas. Hidden from screen readers:
// LoadingStatus announces the loading instead.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn("animate-skeleton rounded-chip bg-fill-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
