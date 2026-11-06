import { handleSitemap, readSitemap } from "@/features/seo/server/handlers";
import { parsePublicEnv } from "@/lib/public-env";

// Every public page, built live from the database (spec 0026 AC-3, AC-4); 404 off the production host.
export function GET(request: Request) {
  return handleSitemap(request, { siteUrl: parsePublicEnv().siteUrl, read: readSitemap });
}
