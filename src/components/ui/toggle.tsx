"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// design.md section 6 (chip): 44 high, radius 8, padding 0 16, 14px. Off: white, control
// border, 400. On: yellow fill, ink border, 800. Disabled: fill-muted, struck through.
// Base UI sets aria-pressed and data-pressed.
const toggleVariants = cva(
  "inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-btn border border-control-border bg-white px-4 type-body whitespace-nowrap text-ink data-disabled:cursor-not-allowed data-disabled:border-fill-muted data-disabled:bg-fill-muted data-disabled:text-muted data-disabled:line-through data-pressed:border-ink data-pressed:bg-yellow data-pressed:font-extrabold [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
);

function Toggle({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive data-slot="toggle" className={cn(toggleVariants(), className)} {...props} />
  );
}

export { Toggle, toggleVariants };
