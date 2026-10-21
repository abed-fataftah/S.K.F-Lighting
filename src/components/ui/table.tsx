import type * as React from "react";
import { cn } from "@/lib/utils";

// design.md section 6 (dashboard table): a white box with its own sideways scroll, so
// the page never scrolls sideways. Header row on the page colour, 13/700 muted, padding 10 12.
// The scroll box is a named, focusable region so a keyboard can scroll it: pass aria-label.
// It is `relative`, so a visually hidden (absolute) header label stays inside it instead of
// widening the page in right to left.
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      role="region"
      aria-label={props["aria-label"]}
      tabIndex={0}
      className="relative w-full overflow-x-auto rounded-card border border-border bg-white"
    >
      <table
        data-slot="table"
        className={cn("w-full border-collapse type-body text-ink", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("bg-page", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-b-0", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr data-slot="table-row" className={cn("border-b border-border", className)} {...props} />
  );
}

function TableHead({ className, scope = "col", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        "px-3 py-2.5 text-start align-middle type-small font-bold whitespace-nowrap text-muted",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td data-slot="table-cell" className={cn("px-3 py-2.5 align-middle", className)} {...props} />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("sr-only", className)} {...props} />;
}

export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow };
