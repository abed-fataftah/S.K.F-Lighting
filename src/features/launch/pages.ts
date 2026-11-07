// The seven launch pages (spec 0028 AC-12, AC-13), every path from `routes`. The cold group opens
// with nothing stored; the warm group shares one browser profile that holds a cart and an unlocked
// order, so its pages show what a customer sees.
import { routes } from "@/lib/routes";

export type LaunchPageKey =
  "home" | "category" | "product" | "search" | "cart" | "checkout" | "order";

export type LaunchPage = {
  readonly key: LaunchPageKey;
  readonly group: "cold" | "warm";
  readonly url: string;
};

export type LaunchTargets = {
  readonly base: string;
  readonly category: string;
  readonly product: string;
  readonly search: string;
  readonly order: string;
};

/** `ثريا`: a word the shop's catalog always holds, unless `--search` says otherwise. */
export const DEFAULT_SEARCH = "ثريا";

export function launchPages(targets: LaunchTargets): readonly LaunchPage[] {
  const at = (path: string) => new URL(path, targets.base).toString();
  return [
    { key: "home", group: "cold", url: at(routes.home) },
    { key: "category", group: "cold", url: at(routes.category(targets.category)) },
    { key: "product", group: "cold", url: at(routes.product(targets.product)) },
    { key: "search", group: "cold", url: at(routes.search(targets.search)) },
    { key: "cart", group: "warm", url: at(routes.cart) },
    { key: "checkout", group: "warm", url: at(routes.checkout) },
    { key: "order", group: "warm", url: at(routes.order(targets.order)) },
  ];
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/** The first segment after `prefix` in a path, decoded, or null. */
function firstSegment(path: string, prefix: "/c/" | "/p/"): string | null {
  if (!path.startsWith(prefix)) return null;
  const segment = path.slice(prefix.length).split("/")[0];
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * The first category and the first product the sitemap lists, as slugs, or null when the text is
 * not a sitemap (preview hosts serve none, spec 0026 AC-2) or lacks either.
 */
export function pickFromSitemap(
  xml: string,
): { readonly category: string; readonly product: string } | null {
  if (!/<urlset[\s>]/.test(xml)) return null;
  const paths = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].flatMap((match) => {
    const loc = match[1]!.replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => XML_ENTITIES[entity]!);
    return URL.canParse(loc) ? [new URL(loc).pathname] : [];
  });
  const category = paths.map((path) => firstSegment(path, "/c/")).find((slug) => slug !== null);
  const product = paths.map((path) => firstSegment(path, "/p/")).find((slug) => slug !== null);
  return category && product ? { category, product } : null;
}
