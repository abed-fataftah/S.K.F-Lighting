"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

// design.md section 6 (sign in tabs): two equal buttons, 48 high, radius 8, 15px.
// Selected: yellow fill, ink border, 800. Others: white, control border.
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List data-slot="tabs-list" className={cn("flex gap-2", className)} {...props} />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-12 flex-1 cursor-pointer items-center justify-center rounded-btn border border-control-border bg-white px-3 type-control text-ink data-active:border-ink data-active:bg-yellow data-active:font-extrabold data-disabled:cursor-not-allowed data-disabled:bg-fill-muted data-disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel data-slot="tabs-content" className={cn("flex-1", className)} {...props} />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
