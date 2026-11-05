import { cn } from "@/lib/utils";

// The owner's logo (white "SKF", yellow bolt, yellow "lighting"), drawn for black surfaces
// only. A trace from the canvas until the owner sends the original files (O-4); replace
// public/brand/skf-logo.svg in place. A plain <img>: files in /public skip the image loader.
const LOGO_SRC = "/brand/skf-logo.svg";
// The brand name as written on the logo, not a translatable string.
const LOGO_ALT = "S.K.F lighting";

const heights = {
  header: "h-(--h-logo-header)",
  footer: "h-(--h-logo-footer)",
  sidebar: "h-(--h-logo-sidebar)",
} as const;

export function Logo({
  place,
  decorative = false,
  className,
}: {
  readonly place: keyof typeof heights;
  /** True when a link around it already says where it goes. */
  readonly decorative?: boolean;
  readonly className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a static SVG from /public, no resizing needed
    <img
      src={LOGO_SRC}
      alt={decorative ? "" : LOGO_ALT}
      width={1810}
      height={852}
      className={cn("w-auto", heights[place], className)}
    />
  );
}
