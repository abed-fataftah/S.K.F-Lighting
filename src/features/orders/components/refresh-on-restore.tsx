"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Coming back from WhatsApp through the browser's back and forward cache shows the page as it was
// left, maybe before the cancel painted; a refresh brings the current state (spec 0016 AC-5).
export function RefreshOnRestore() {
  const router = useRouter();

  useEffect(() => {
    const refresh = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };
    window.addEventListener("pageshow", refresh);
    return () => window.removeEventListener("pageshow", refresh);
  }, [router]);

  return null;
}
