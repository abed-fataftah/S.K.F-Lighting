"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

// An on and off switch on Base UI Switch (spec 0008: "ظاهر في المتجر"). Not drawn on the boards,
// so it borrows the checkbox colours: control border and white when off, ink with a yellow thumb
// when on. The tap area is 44 by 48 around a 44 by 28 track; the thumb moves to the end side,
// which flips in RTL. It submits `on` with its form when checked, like a checkbox.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group inline-flex h-11 w-12 shrink-0 cursor-pointer items-center justify-center rounded-btn data-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex h-7 w-11 items-center rounded-full border border-control-border bg-white p-0.5 group-data-checked:border-ink group-data-checked:bg-ink group-data-disabled:bg-fill-muted"
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className="size-5.5 rounded-full border border-ink bg-white transition-transform duration-(--dur-sheet) data-checked:translate-x-4 data-checked:bg-yellow rtl:data-checked:-translate-x-4"
        />
      </span>
    </SwitchPrimitive.Root>
  );
}

export { Switch };
