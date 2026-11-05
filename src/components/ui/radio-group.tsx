"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { useCheckRowLabelId } from "@/components/ui/check-row";
import { cn } from "@/lib/utils";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

// design.md section 6: a 22px circle, control border, ink ring and dot when checked.
// Put it in a <label> row at least 44 high (CheckRow).
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  const rowLabelId = useCheckRowLabelId();

  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      aria-labelledby={rowLabelId}
      className={cn(
        "flex size-5.5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-control-border bg-white data-checked:border-2 data-checked:border-ink data-disabled:cursor-not-allowed data-disabled:bg-fill-muted",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="size-2.5 rounded-full bg-ink"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
