"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

// A menu of actions on Base UI Menu (spec 0014 AC-5: "خيارات أخرى" on the status card). Same
// surface as the dialogs: a white card with a 1px border, no shadow. Items are 44 high; the
// highlighted one takes the muted fill. Arrow keys move, Escape closes and returns focus.

function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="z-(--z-sheet)"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "flex max-h-(--available-height) min-w-(--anchor-width) flex-col overflow-y-auto rounded-card border border-border bg-white p-1 text-ink",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-btn px-3 type-body select-none data-disabled:cursor-not-allowed data-disabled:text-muted data-highlighted:bg-fill-muted",
        className,
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger };
