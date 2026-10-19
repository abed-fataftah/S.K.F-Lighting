import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6: a native <select> in the Input box, padding 0 10, chevron at the end.
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)} data-slot="native-select-wrapper">
      <select
        data-slot="native-select"
        className="h-12 w-full min-w-0 cursor-pointer appearance-none rounded-card border border-control-border bg-white ps-2.5 pe-10 type-control text-ink disabled:cursor-not-allowed disabled:bg-fill-muted aria-invalid:border-danger"
        {...props}
      />
      <ChevronDownIcon
        aria-hidden
        data-slot="native-select-icon"
        className="pointer-events-none absolute end-2.5 top-1/2 size-5 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

function NativeSelectOption(props: React.ComponentProps<"option">) {
  return <option data-slot="native-select-option" {...props} />;
}

function NativeSelectOptGroup(props: React.ComponentProps<"optgroup">) {
  return <optgroup data-slot="native-select-optgroup" {...props} />;
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
