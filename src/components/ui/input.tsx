import { Input as InputPrimitive } from "@base-ui/react/input";
import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6: 48 high, radius 12, control border, white, 15px, padding 0 14.
// Error: pass aria-invalid and aria-describedby pointing at a FieldError.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-card border border-control-border bg-white px-3.5 type-control text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-fill-muted aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
