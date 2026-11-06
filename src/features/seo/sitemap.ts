import { buildNavigation, type NavCategory } from "@/features/catalog/category-rules";
import { policySlugs } from "@/features/policies/slugs";
import { routes } from "@/lib/routes";

// `sitemap.xml` (spec 0026 AC-3): one standard `urlset`, no `priority` and no `changefreq`.

export type SitemapEntry = {
  /** Absolute; path segments are already percent encoded by `routes`. */
  readonly loc: string;
  readonly lastmod: Date | null;
};

const XML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

export const escapeXml = (text: string) => text.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c);

/** The W3C datetime in UTC, for example `2026-11-06T09:30:00.000Z`. */
export const sitemapDate = (date: Date) => date.toISOString();

export function buildSitemapXml(entries: readonly SitemapEntry[]): string {
  const urls = entries.map((entry) =>
    entry.lastmod
      ? `<url><loc>${escapeXml(entry.loc)}</loc><lastmod>${sitemapDate(entry.lastmod)}</lastmod></url>`
      : `<url><loc>${escapeXml(entry.loc)}</loc></url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

export type SitemapData = {
  /** Listed products (`listedProduct`), with the category each sits on. */
  readonly products: readonly {
    readonly slug: string;
    readonly categoryId: string;
    readonly updatedAt: Date;
  }[];
  /** Every category row; which are shown is decided by the navigation rule. */
  readonly categories: readonly (NavCategory & { readonly updatedAt: Date })[];
  readonly pages: readonly { readonly slug: string; readonly updatedAt: Date }[];
};

/**
 * Every indexable page (AC-3): home, `/c`, each shown category holding a listed product by the
 * category page's own count rule (a main counts its products and its shown subs', never a hidden
 * sub's), each listed product, and each policy page with a row.
 */
export function collectSitemapEntries(siteUrl: string, data: SitemapData): readonly SitemapEntry[] {
  const listed = new Map<string, number>();
  for (const product of data.products) {
    listed.set(product.categoryId, (listed.get(product.categoryId) ?? 0) + 1);
  }
  const updatedOf = new Map(data.categories.map((row) => [row.slug, row.updatedAt]));
  const categoryEntries = buildNavigation(data.categories, listed).flatMap((main) => [
    { loc: `${siteUrl}${routes.category(main.slug)}`, lastmod: updatedOf.get(main.slug) ?? null },
    ...main.subs.map((sub) => ({
      loc: `${siteUrl}${routes.subcategory(main.slug, sub.slug)}`,
      lastmod: updatedOf.get(sub.slug) ?? null,
    })),
  ]);
  return [
    { loc: `${siteUrl}${routes.home}`, lastmod: null },
    { loc: `${siteUrl}${routes.categories}`, lastmod: null },
    ...categoryEntries,
    ...data.products.map((product) => ({
      loc: `${siteUrl}${routes.product(product.slug)}`,
      lastmod: product.updatedAt,
    })),
    ...policySlugs.flatMap((slug) => {
      const page = data.pages.find((row) => row.slug === slug);
      return page ? [{ loc: `${siteUrl}${routes.policy(slug)}`, lastmod: page.updatedAt }] : [];
    }),
  ];
}
