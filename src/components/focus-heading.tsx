"use client";

import { useEffect, useRef, type ComponentProps } from "react";

// A page h1 that takes focus on load, so a screen reader announces the new page
// (confirmation.md, Accessibility).
export function FocusHeading(props: ComponentProps<"h1">) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return <h1 ref={ref} tabIndex={-1} {...props} />;
}
