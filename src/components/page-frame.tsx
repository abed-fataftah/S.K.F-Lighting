import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * How wide a storefront page may grow (spec 0029): `wide` the content box, `form` the narrow
 * pages, `prose` the policy pages. Below 768 the layout already caps every page at 480.
 */
export type PageWidth = "wide" | "form" | "prose";

const maxWidths: Readonly<Record<PageWidth, string>> = {
  wide: "max-w-(--content-max)",
  form: "max-w-(--form-max)",
  prose: "max-w-(--prose-max)",
};

/** The page root's centring and width classes, before the page's own. */
export function pageFrameClass(width: PageWidth, className?: string): string {
  return cn("mx-auto w-full", maxWidths[width], className);
}

// The root of every storefront page (spec 0029 Components): a centred box of the page's width.
// A server component; the page passes its own layout classes through `className`.
export function PageFrame({
  width,
  className,
  ...props
}: ComponentProps<"div"> & { readonly width: PageWidth }) {
  return <div className={pageFrameClass(width, className)} {...props} />;
}
