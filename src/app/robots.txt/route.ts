import { handleRobots } from "@/features/seo/server/handlers";
import { parsePublicEnv } from "@/lib/public-env";

// What crawlers may read (spec 0026 AC-1, AC-2); closed off the production host.
export function GET(request: Request) {
  return handleRobots(request, parsePublicEnv().siteUrl);
}
