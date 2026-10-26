import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// One titled block of the gallery, linked from the table of contents by its id.
export function GallerySection({
  id,
  title,
  text,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} id={id} className="scroll-mt-4">
      <h2 id={`${id}-title`} className="type-title-m">
        {title}
      </h2>
      <p className="mt-1 max-w-(--page-max) text-muted">{text}</p>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </section>
  );
}

// A white card holding one group of samples, with a small heading.
export function SampleGroup({
  title,
  className,
  children,
}: {
  readonly title: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={cn("rounded-card border border-border bg-white p-3.5", className)}>
      <h3 className="type-lead">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

// A sample with its caption underneath (state name, size, token).
export function Labelled({
  label,
  className,
  children,
}: {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <figure className={cn("flex flex-col items-start gap-1.5", className)}>
      {children}
      <figcaption className="type-caption text-muted">{label}</figcaption>
    </figure>
  );
}
