import { routes } from "@/lib/routes";

// `robots.txt` (spec 0026 AC-1, AC-2). The `noindex` pages (account, cart, checkout, orders,
// search) are not disallowed, so crawlers can still read their `noindex` tag.

const PRIVATE_PATHS = [routes.admin.home, "/auth", "/api", routes.designSystem] as const;

export const SITEMAP_PATH = "/sitemap.xml";

export function buildRobotsTxt(siteUrl: string, production: boolean): string {
  const lines = production
    ? [
        "User-agent: *",
        "Allow: /",
        ...PRIVATE_PATHS.map((path) => `Disallow: ${path}`),
        `Sitemap: ${siteUrl}${SITEMAP_PATH}`,
      ]
    : ["User-agent: *", "Disallow: /"];
  return `${lines.join("\n")}\n`;
}
