// The guest lookup limits (spec 0015 AC-6): 5 tries a minute per IP, then 5 a minute per order
// number, from two Workers rate limiting bindings. Like the order limit it fails open: a missing
// or broken binding never blocks a customer. Pure, so the rule is tested with stand in limiters.
import { checkOrderRate, type OrderLimiter } from "@/features/checkout/rate-limit";

export type LookupRateCheck = "allowed" | "unchecked" | { readonly limited: "ip" | "number" };

/**
 * One try from the IP limiter, then one from the number limiter. Either over is `limited` (the
 * number limiter is not asked once the IP is over); either unchecked, with neither over, is
 * `unchecked`.
 */
export async function checkLookupRate(
  limiters: {
    readonly ip: OrderLimiter | undefined;
    readonly number: OrderLimiter | undefined;
  },
  keys: { readonly ip: string; readonly number: string },
): Promise<LookupRateCheck> {
  const byIp = await checkOrderRate(limiters.ip, keys.ip);
  if (byIp === "limited") return { limited: "ip" };
  const byNumber = await checkOrderRate(limiters.number, keys.number);
  if (byNumber === "limited") return { limited: "number" };
  return byIp === "unchecked" || byNumber === "unchecked" ? "unchecked" : "allowed";
}
