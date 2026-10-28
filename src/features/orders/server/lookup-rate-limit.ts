import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { rateKey } from "@/features/checkout/rate-limit";
import { checkLookupRate, type LookupRateCheck } from "../lookup-rate-limit";

// Reads the `ORDER_LOOKUP_IP_LIMITER` and `ORDER_LOOKUP_NUMBER_LIMITER` bindings (wrangler.jsonc)
// for `lookupOrder` (spec 0015 AC-6). Under `next dev` they are missing; the check is then skipped.

let warnedUnchecked = false;

export async function lookupRateCheck(number: string): Promise<LookupRateCheck> {
  const { env } = await getCloudflareContext({ async: true });
  const bindings = env as Partial<CloudflareEnv>;
  const check = await checkLookupRate(
    { ip: bindings.ORDER_LOOKUP_IP_LIMITER, number: bindings.ORDER_LOOKUP_NUMBER_LIMITER },
    { ip: rateKey((await headers()).get("cf-connecting-ip")), number },
  );
  if (check === "unchecked" && process.env.NODE_ENV !== "production" && !warnedUnchecked) {
    // Logged once per process, so `next dev` says why the limit is not applied.
    warnedUnchecked = true;
    console.warn(JSON.stringify({ event: "order_lookup_unchecked" }));
  }
  return check;
}
