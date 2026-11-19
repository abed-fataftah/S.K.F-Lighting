import { cn } from "@/lib/utils";

// The owner's logo (white "SKF" with its swoosh, an orange glowing bulb, orange "LIGHTING"), for
// black surfaces only. The original is docs/design/brand/skf-logo-source.png; this is a 240px
// high WebP made from it. A plain <img>: files in /public skip the image loader.
const LOGO_SRC = "/brand/skf-logo.webp";
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
    // eslint-disable-next-line @next/next/no-img-element -- a static WebP from /public, no resizing needed
    <img
      src={LOGO_SRC}
      alt={decorative ? "" : LOGO_ALT}
      width={460}
      height={240}
      className={cn("w-auto", heights[place], className)}
    />
  );
}
