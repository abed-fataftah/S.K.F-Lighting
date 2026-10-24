import { toShekelsInput } from "@/lib/money";
import type { ProductOptions } from "./product-view";

// The product page for search engines (spec 0009 AC-15): the meta description and the `Product`
// JSON-LD with one `Offer`, or an `AggregateOffer` when the counted variants differ in price.

const SUMMARY_LENGTH = 155;

/** The description with whitespace collapsed, cut to 155 code points; null when there is none. */
export function productSummary(text: string | null): string | null {
  const collapsed = (text ?? "").replace(/\s+/g, " ").trim();
  return collapsed ? Array.from(collapsed).slice(0, SUMMARY_LENGTH).join("") : null;
}

export function metaDescription(text: string | null, fallback: string): string {
  return productSummary(text) ?? fallback;
}

const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";

/** Counted: the sellable variants when in stock, else all live ones; none, no offers. */
function offers(options: ProductOptions, inStock: boolean, url: string) {
  const counted = inStock ? options.variants.filter((v) => v.sellable) : options.variants;
  if (!counted.length) return null;
  const prices = counted.map((v) => v.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const availability = inStock ? IN_STOCK : OUT_OF_STOCK;
  return low === high
    ? {
        "@type": "Offer",
        url,
        price: toShekelsInput(low),
        priceCurrency: "ILS",
        availability,
      }
    : {
        "@type": "AggregateOffer",
        lowPrice: toShekelsInput(low),
        highPrice: toShekelsInput(high),
        offerCount: counted.length,
        priceCurrency: "ILS",
        availability,
      };
}

export function productJsonLd(product: {
  readonly name: string;
  readonly code: string;
  readonly description: string | null;
  /** Absolute public photo URLs in order; up to 8 are used. */
  readonly images: readonly string[];
  /** The canonical address. */
  readonly url: string;
  readonly options: ProductOptions;
  readonly inStock: boolean;
}) {
  const description = productSummary(product.description);
  const offer = offers(product.options, product.inStock, product.url);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.code,
    ...(description ? { description } : {}),
    ...(product.images.length ? { image: product.images.slice(0, 8) } : {}),
    url: product.url,
    ...(offer ? { offers: offer } : {}),
  };
}
