import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { checkOrderRate, rateKey, type RateCheck } from "../rate-limit";

// Reads the `ORDER_RATE_LIMITER` binding (wrangler.jsonc) for `placeOrder` step 2 (spec 0004
// AC-10). Under `next dev` the binding may be missing; the check is then skipped.

let warnedUnchecked = false;

export async function orderRateCheck(): Promise<RateCheck> {
  const { env } = await getCloudflareContext({ async: true });
  const limiter = (env as Partial<CloudflareEnv>).ORDER_RATE_LIMITER;
  const check = await checkOrderRate(limiter, rateKey((await headers()).get("cf-connecting-ip")));
  if (check === "unchecked" && process.env.NODE_ENV !== "production" && !warnedUnchecked) {
    // Logged once per process, so `next dev` says why the limit is not applied.
    warnedUnchecked = true;
    console.warn(JSON.stringify({ event: "order_rate_unchecked" }));
  }
  return check;
}
