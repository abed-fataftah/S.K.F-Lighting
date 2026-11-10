"use client";

import { useEffect } from "react";

/** Tailwind's lg (spec 0029 AC-2). */
const DESKTOP = "(width >= 64rem)";

/**
 * Closes a dialog or sheet whose trigger is hidden from lg when the window grows to lg while it
 * is open (spec 0029 AC-11).
 */
export function useCloseAtDesktop(open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const query = window.matchMedia(DESKTOP);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [open, setOpen]);
}
