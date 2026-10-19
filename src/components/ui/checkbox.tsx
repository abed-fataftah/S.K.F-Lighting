"use client";

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import { useCheckRowLabelId } from "@/components/ui/check-row";
import { cn } from "@/lib/utils";

// design.md section 6: a 22px box, control border, ink when checked. Put it in a
// <label> row at least 44 high (CheckRow) so the whole row is the tap target.
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  const rowLabelId = useCheckRowLabelId();

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      aria-labelledby={rowLabelId}
      className={cn(
        "flex size-5.5 shrink-0 cursor-pointer items-center justify-center rounded-chip border border-control-border bg-white text-white aria-invalid:border-danger data-checked:border-ink data-checked:bg-ink data-disabled:cursor-not-allowed data-disabled:bg-fill-muted",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex">
        <CheckIcon aria-hidden className="size-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
