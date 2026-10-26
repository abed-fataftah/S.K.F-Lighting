"use client";

import { useEffect, useRef, useState } from "react";

/** Smooth unless the visitor asked for less motion (AC-10). */
export function scrollBehaviour(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

/**
 * Tracks which item of a scroll snap strip is in view (threshold 0.6, AC-10). Items carry
 * `data-index`; moving uses `scrollIntoView` on the target, so no RTL scroll offset math is needed.
 */
export function useStripPosition(count: number, start = 0) {
  const strip = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const [current, setCurrent] = useState(start);

  useEffect(() => {
    const root = strip.current;
    if (!root || count < 2) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    for (const item of items.current) if (item) observer.observe(item);
    return () => observer.disconnect();
  }, [count]);

  const goTo = (index: number, behavior: ScrollBehavior = scrollBehaviour()) => {
    items.current[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior });
  };
  const itemRef = (index: number) => (element: HTMLElement | null) => {
    items.current[index] = element;
  };
  return { strip, current, goTo, itemRef };
}
