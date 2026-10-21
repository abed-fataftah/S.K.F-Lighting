"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type * as React from "react";
import { cn } from "@/lib/utils";

// A confirm dialog on Base UI AlertDialog (spec 0006: delete product, leave without saving).
// Same surface as the sheet: ink overlay at 50%, a white card with a 1px border, no shadow or blur.
// Focus moves into the dialog, stays there, and returns to the trigger; Escape closes it.

function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogContent({ className, children, ...props }: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-(--z-sheet) bg-ink/50"
      />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          "fixed start-4 end-4 top-1/2 z-(--z-sheet) mx-auto flex max-w-(--page-max) -translate-y-1/2 flex-col gap-3 rounded-card border border-border bg-white p-5 text-ink",
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Popup>
    </AlertDialogPrimitive.Portal>
  );
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("type-title-s", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted", className)}
      {...props}
    />
  );
}

/** The buttons, confirm first: in RTL it sits at the start (right) edge. */
function AlertDialogActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-actions"
      className={cn("mt-1 flex flex-wrap gap-2.5", className)}
      {...props}
    />
  );
}

const AlertDialogClose = AlertDialogPrimitive.Close;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
};
