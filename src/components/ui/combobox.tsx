"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// A text field with a list of suggestions on Base UI Combobox (spec 0020 AC-7: the product field
// of a quick order line). The parts of the shadcn `base-maia` combobox, restyled like the dropdown
// menu: the field is the shared Input, the list a white card with a 1px border and no shadow,
// rows at least 44 high, the highlighted one on the muted fill. Base UI gives the combobox ARIA,
// the arrow keys, Enter, and Escape.

const Combobox = ComboboxPrimitive.Root;

function ComboboxInput(props: ComboboxPrimitive.Input.Props) {
  return <ComboboxPrimitive.Input data-slot="combobox-input" render={<Input />} {...props} />;
}

function ComboboxContent({
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        className="z-(--z-sheet)"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "flex max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) flex-col overflow-hidden rounded-card border border-border bg-white text-ink",
            className,
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "flex flex-col overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxItem({ className, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-btn px-2 py-1.5 type-body select-none data-disabled:cursor-not-allowed data-disabled:text-muted data-highlighted:bg-fill-muted",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("px-3 py-3 type-body text-muted empty:hidden", className)}
      {...props}
    />
  );
}

/** A live line for "loading" or "failed" while the list has nothing to show. */
function ComboboxStatus({ className, ...props }: ComboboxPrimitive.Status.Props) {
  return (
    <ComboboxPrimitive.Status
      data-slot="combobox-status"
      className={cn("px-3 py-3 type-body text-muted empty:hidden", className)}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxStatus,
};
