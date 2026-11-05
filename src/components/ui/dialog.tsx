"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type * as React from "react";
import { cn } from "@/lib/utils";

// A form dialog on Base UI Dialog (spec 0008: the category dialog). The same surface as the
// confirm dialog: ink overlay at 50%, a white card with a 1px border, no shadow or blur. Focus
// moves into it, stays there, and returns to the button that opened it; Escape closes it.

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-overlay"
        className="fixed inset-0 z-(--z-sheet) bg-ink/50"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed start-4 end-4 top-1/2 z-(--z-sheet) mx-auto flex max-h-[90dvh] max-w-(--page-max) -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-card border border-border bg-white p-5 text-ink",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("type-title-s", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted", className)}
      {...props}
    />
  );
}

/** The buttons, save first: in RTL it sits at the start (right) edge. */
function DialogActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-actions"
      className={cn("mt-1 flex flex-wrap gap-2.5", className)}
      {...props}
    />
  );
}

const DialogClose = DialogPrimitive.Close;
const DialogTrigger = DialogPrimitive.Trigger;

export {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
};
