// Structured data shared by the category and product pages (spec 0008 AC-16, spec 0009 AC-15).

export type BreadcrumbEntry = { readonly name: string; readonly url: string };

/** A schema.org `BreadcrumbList` over absolute URLs, first item first. */
export function breadcrumbJsonLd(items: readonly BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** JSON for a `<script type="application/ld+json">`, with `<` escaped so text cannot close it. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
