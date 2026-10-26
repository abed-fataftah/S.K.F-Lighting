import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type * as React from "react";
import { ChevronNext } from "@/components/icons/directional";
import { cn } from "@/lib/utils";

// design.md section 6: 13px muted, links at least 44 high, the current page 700 ink, and
// a chevron separator that follows the reading direction. Pass aria-label="مسار التنقل".
function Breadcrumb(props: React.ComponentProps<"nav">) {
  return <nav data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-x-1 type-small break-words text-muted",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center", className)}
      {...props}
    />
  );
}

// For a Next link: render={<Link href="…" />}.
function BreadcrumbLink({ className, render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center underline underline-offset-4",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "breadcrumb-link" },
  });
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("inline-flex min-h-11 items-center font-bold text-ink", className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden
      className={cn("inline-flex", className)}
      {...props}
    >
      <ChevronNext className="size-4" />
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
