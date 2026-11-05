// The order spam limit (spec 0004 AC-10): 5 submissions a minute per IP, from the Workers rate
// limiting binding. It fails open: a missing or broken limiter never stops a sale. Pure, so the
// rule is tested with a stand in limiter.

/** The part of the Workers `RateLimit` binding this uses. */
export type OrderLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type RateCheck = "allowed" | "limited" | "unchecked";

/** The client IP Cloudflare sends; missing (local dev) shares one key. */
export function rateKey(connectingIp: string | null | undefined): string {
  return connectingIp?.trim() || "local";
}

export async function checkOrderRate(
  limiter: OrderLimiter | undefined,
  key: string,
): Promise<RateCheck> {
  if (!limiter) return "unchecked";
  try {
    return (await limiter.limit({ key })).success ? "allowed" : "limited";
  } catch {
    return "unchecked";
  }
}
