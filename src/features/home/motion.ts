import { useSyncExternalStore } from "react";

// Motion helpers shared by Home's carousels (spec 0011 AC-4, spec 0030 AC-7): the reduced motion
// flag, and the motion tokens read as numbers for the Web Animations API.

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True under `prefers-reduced-motion: reduce`; true on the server, so nothing moves before it knows. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );
}

/** A CSS time token ("0.7s" or "700ms") in milliseconds. */
export function tokenMs(element: Element, token: string): number {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return value.endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000;
}

/** The carousel easing token as a keyframe easing, "ease" when it cannot be read. */
export function tokenEasing(element: Element): string {
  return getComputedStyle(element).getPropertyValue("--ease-carousel").trim() || "ease";
}
