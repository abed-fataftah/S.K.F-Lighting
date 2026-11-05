import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6: like Input, 72 to 110 high, padding 12 14.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content max-h-27.5 min-h-18 w-full resize-none rounded-card border border-control-border bg-white px-3.5 py-3 type-control text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-fill-muted aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
