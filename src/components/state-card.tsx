import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The empty and error card (design.md section 6): white, 1px border, radius 12, padding
// 32 20, centered; a 72px muted disc with a 34px icon, an 18/800 title, 14px muted text,
// and buttons stacked 10px apart.
export function StateCard({
  icon: Icon,
  title,
  text,
  actions,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  readonly icon: LucideIcon;
  readonly title: ReactNode;
  readonly text?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-border bg-white px-5 py-8 text-center text-ink",
        className,
      )}
      {...props}
    >
      <span className="flex size-18 items-center justify-center rounded-full bg-fill-muted text-muted">
        <Icon aria-hidden className="size-8.5" strokeWidth={1.75} />
      </span>
      <h2 className="type-title-s">{title}</h2>
      {text ? <p className="max-w-(--page-max) text-muted">{text}</p> : null}
      {actions ? <div className="mt-1 flex w-full flex-col gap-2.5">{actions}</div> : null}
    </div>
  );
}
