"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { isOrderPagePath, REFRESH_EVERY_MS, shouldRefresh } from "../auto-refresh";

// The dashboard's live refresh (spec 0014 AC-16): new orders, the dot, the sidebar count, and an
// open order's status arrive without a reload. Every minute, and when the tab is shown again, it
// refreshes unless the owner is typing in a field or has a dialog open. Leaving an order page
// refreshes at once, since the layout does not render again on its own.

const isBusy = () => {
  const active = document.activeElement;
  return (
    (active instanceof HTMLElement && active.matches("input, textarea, select")) ||
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  );
};

export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const lastAt = useRef(0);
  const lastPath = useRef(pathname);

  useEffect(() => {
    lastAt.current = Date.now();
    const check = () => {
      const now = Date.now();
      const visible = document.visibilityState === "visible";
      if (!shouldRefresh({ lastAt: lastAt.current, now, visible, busy: isBusy() })) return;
      lastAt.current = now;
      router.refresh();
    };
    const timer = setInterval(check, REFRESH_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);

  useEffect(() => {
    const left = lastPath.current;
    lastPath.current = pathname;
    if (left === pathname || !isOrderPagePath(left)) return;
    lastAt.current = Date.now();
    router.refresh();
  }, [pathname, router]);

  return null;
}
