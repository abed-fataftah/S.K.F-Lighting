"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { beaconTokenFor, safePublicEnv } from "@/lib/monitoring-env";

const BEACON_SRC = "https://static.cloudflareinsights.com/beacon.min.js";

const subscribeNever = () => () => {};

/** The token for this browser's host, or null; always null on the server. */
function useBeaconToken() {
  return useSyncExternalStore(
    subscribeNever,
    () => beaconTokenFor(safePublicEnv(), window.location.host),
    () => null,
  );
}

// The Cloudflare Web Analytics beacon (spec 0027 AC-6): cookieless, storefront only, and only on
// the production host with a token set. The host is known only in the browser, so the script is
// added after hydration. SPA mode counts in app navigation as page views.
export function AnalyticsBeacon() {
  const token = useBeaconToken();
  if (token === null) return null;
  return (
    <Script
      src={BEACON_SRC}
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token, spa: true })}
    />
  );
}
