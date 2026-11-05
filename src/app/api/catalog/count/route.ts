import { getCloudflareContext } from "@opennextjs/cloudflare";
import { countFor, handleCount } from "@/features/catalog/server/count";

// The live count behind the filters screen (spec 0010 AC-12, AC-15). Public and rate limited.
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  return handleCount(request, {
    limiter: (env as Partial<CloudflareEnv>).CATALOG_COUNT_RATE_LIMITER,
    count: countFor,
    production: process.env.NODE_ENV === "production",
  });
}
