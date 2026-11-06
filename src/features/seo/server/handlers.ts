import "server-only";
import { getDb } from "@/server/db";
import { withTimeLimit } from "@/server/db/time-limit";
import { isProductionHost, NOINDEX_HEADER } from "../indexing";
import { buildRobotsTxt } from "../robots";
import { buildSitemapXml, collectSitemapEntries, type SitemapData } from "../sitemap";
import { readSitemapData } from "./sitemap-entries";

// `GET /robots.txt` and `GET /sitemap.xml` (spec 0026 AC-1 to AC-4). The proxy matcher skips
// paths with a dot, so off the production host both set `X-Robots-Tag` themselves.

export const SITEMAP_TIMEOUT_MS = 3000;

const offProduction = (production: boolean): Record<string, string> =>
  production ? {} : { [NOINDEX_HEADER.name]: NOINDEX_HEADER.value };

export function handleRobots(request: Request, siteUrl: string): Response {
  const production = isProductionHost(new URL(request.url).host, siteUrl);
  return new Response(buildRobotsTxt(siteUrl, production), {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...offProduction(production) },
  });
}

export const readSitemap = async (): Promise<SitemapData> => readSitemapData(await getDb());

export type SitemapDeps = {
  readonly siteUrl: string;
  readonly read: () => Promise<SitemapData>;
};

/** Built live on each fetch; a failed or slow read is a 503, never an empty or partial list. */
export async function handleSitemap(request: Request, deps: SitemapDeps): Promise<Response> {
  if (!isProductionHost(new URL(request.url).host, deps.siteUrl)) {
    return new Response(null, { status: 404, headers: offProduction(false) });
  }
  const result = await withTimeLimit(deps.read, SITEMAP_TIMEOUT_MS);
  if (!result.ok) {
    console.error("sitemap: read failed", {
      error: result.error === "timeout" ? "timeout" : errorName(result.cause),
    });
    return new Response(null, { status: 503, headers: { "Retry-After": "3600" } });
  }
  return new Response(buildSitemapXml(collectSitemapEntries(deps.siteUrl, result.data)), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

const errorName = (cause: unknown) => (cause instanceof Error ? cause.name : "unknown");
