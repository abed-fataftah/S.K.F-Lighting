"use client";

import type { MouseEvent, ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { sectionHeadingId } from "../section-ids";

// "تسوّق الآن" (spec 0011 AC-3): moves to a Home section, smoothly unless the visitor asked for
// reduced motion, then puts focus on the section's heading so keyboard and screen reader users
// land there too. Without JavaScript it is a plain `#section` link.
export function SectionJump({
  section,
  className,
  children,
}: {
  readonly section: "categories" | "featured";
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const jump = (event: MouseEvent<HTMLAnchorElement>) => {
    const heading = document.getElementById(sectionHeadingId(section));
    if (!heading) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  };

  return (
    <ButtonLink href={`#${section}`} size="lg" onClick={jump} className={className}>
      {children}
    </ButtonLink>
  );
}
