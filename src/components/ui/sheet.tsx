"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { useRef } from "react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A side panel on Base UI Dialog (spec 0003, MenuSheet). Logical sides only: "start" is
// the right edge in Arabic. White panel with a 1px border edge, ink overlay at 50%, no
// shadow or blur. It slides over --dur-sheet, which is 0s under reduced motion.

function Sheet(props: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-(--z-sheet) bg-ink/50 transition-opacity duration-(--dur-sheet) data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

// The offset the panel slides from: off the start edge, which flips with the direction.
const sides = {
  start:
    "inset-y-0 start-0 border-e [--sheet-from:-100%] rtl:[--sheet-from:100%] data-ending-style:translate-x-(--sheet-from) data-starting-style:translate-x-(--sheet-from)",
  end: "inset-y-0 end-0 border-s [--sheet-from:100%] rtl:[--sheet-from:-100%] data-ending-style:translate-x-(--sheet-from) data-starting-style:translate-x-(--sheet-from)",
} as const;

function SheetContent({
  className,
  children,
  side = "start",
  closeLabel,
  ...props
}: SheetPrimitive.Popup.Props & {
  readonly side?: keyof typeof sides;
  /** The close button's accessible name, from ar.json. Focus starts on it. */
  readonly closeLabel: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  return (
    <SheetPrimitive.Portal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        initialFocus={closeRef}
        className={cn(
          "ease-out fixed z-(--z-sheet) flex h-full w-[min(var(--w-sheet),85vw)] flex-col overflow-y-auto border-border bg-white text-ink transition-transform duration-(--dur-sheet)",
          sides[side],
          className,
        )}
        {...props}
      >
        <SheetPrimitive.Close
          ref={closeRef}
          data-slot="sheet-close"
          aria-label={closeLabel}
          render={<Button variant="ghost" size="icon" className="absolute end-2 top-2" />}
        >
          <XIcon aria-hidden className="size-6" />
        </SheetPrimitive.Close>
        {children}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex min-h-15 flex-col justify-center gap-1 ps-4 pe-14 pt-2", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("type-title-s", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("type-small text-muted", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
