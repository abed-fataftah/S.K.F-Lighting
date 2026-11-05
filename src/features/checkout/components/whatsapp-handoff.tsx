"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

const handedOffKey = (orderId: string) => `skf-wa-${orderId}`;

function alreadyHandedOff(orderId: string): boolean {
  try {
    if (sessionStorage.getItem(handedOffKey(orderId))) return true;
    sessionStorage.setItem(handedOffKey(orderId), "1");
    return false;
  } catch {
    // Storage blocked (private mode): the wa=1 flag is already gone, so this still runs once.
    return false;
  }
}

// The one time hand off to WhatsApp after placing (spec 0004 AC-11): drop the `wa=1` flag first,
// so a reload or the back button never opens WhatsApp again, then send the tab to W5.
export function WhatsAppHandoff({
  orderId,
  url,
  autoOpen,
}: {
  readonly orderId: string;
  readonly url: string;
  readonly autoOpen: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!autoOpen) return;
    router.replace(pathname);
    if (!alreadyHandedOff(orderId)) window.location.assign(url);
  }, [autoOpen, orderId, url, router, pathname]);

  return null;
}
