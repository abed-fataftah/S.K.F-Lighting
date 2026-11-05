import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6: a field label sits above its control, 13px muted.
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label data-slot="label" className={cn("block type-small text-muted", className)} {...props} />
  );
}

export { Label };
