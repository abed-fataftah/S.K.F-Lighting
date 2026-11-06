// The browser side of the monitoring switches (spec 0027 AC-6, AC-13). Both the beacon and the
// browser Sentry client run only on the production host and only when their value is set. A bad
// inlined value means "off", never a crash.
import { shouldReport } from "@/lib/error-scrub";
import { parsePublicEnv, type PublicEnv } from "@/lib/public-env";

/** The public env, or null when it does not parse. */
export function safePublicEnv(): PublicEnv | null {
  try {
    return parsePublicEnv();
  } catch {
    return null;
  }
}

/** The beacon token to load on `host`, or null to leave the beacon out. */
export function beaconTokenFor(env: PublicEnv | null, host: string): string | null {
  if (!env?.cfBeaconToken) return null;
  return shouldReport(host, env.siteUrl) ? env.cfBeaconToken : null;
}

/** The DSN to start browser Sentry with on `host`, or null to start nothing. */
export function browserDsnFor(env: PublicEnv | null, host: string): string | null {
  if (!env?.sentryDsn) return null;
  return shouldReport(host, env.siteUrl) ? env.sentryDsn : null;
}
