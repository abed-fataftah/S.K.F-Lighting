// The one switch for indexing (spec 0026 AC-2): only the host in `NEXT_PUBLIC_SITE_URL` may be
// indexed. A `workers.dev` or branch preview, and `www.`, answer with this header and a closed
// robots file instead.

export const NOINDEX_HEADER = { name: "X-Robots-Tag", value: "noindex, nofollow" } as const;

/** Lowercase, no trailing dot, no default port. */
function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:(443|80)$/, "")
    .replace(/\.$/, "");
}

export function isProductionHost(host: string, siteUrl: string): boolean {
  return normalizeHost(host) === normalizeHost(new URL(siteUrl).host);
}
