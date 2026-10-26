import { TriangleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6 (notice banner): tint fill, 1px ink border, radius 12,
// padding 12 14, bold, a 22px warning icon, announced as an alert.
function Alert({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        "flex w-full items-start gap-2.5 rounded-card border border-ink bg-yellow-tint px-3.5 py-3 type-body font-bold text-ink",
        className,
      )}
      {...props}
    >
      <TriangleAlert aria-hidden className="size-5.5 shrink-0" />
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("font-extrabold", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={className} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
