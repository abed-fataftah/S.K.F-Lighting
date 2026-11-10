"use client";

import { usePathname } from "@/i18n/navigation";
import { routes } from "@/lib/routes";

// The yellow delivery strip (handoff section 6, spec 0011 AC-6): on the home page only. The shop
// layout builds `text` from the active delivery zones; null (no zone, or a failed read) hides it.
// `show` forces it on (the gallery).
export function InfoStrip({
  text,
  show,
}: {
  readonly text: string | null;
  readonly show?: boolean;
}) {
  const pathname = usePathname();
  if (text === null || (!show && pathname !== routes.home)) return null;

  // Full width from md, its words inside the content box (spec 0029 AC-3).
  return (
    <p className="bg-yellow px-3 py-2 text-center type-caption font-extrabold text-ink md:px-(--page-pad)">
      <span className="mx-auto block max-w-(--content-max)">{text}</span>
    </p>
  );
}
