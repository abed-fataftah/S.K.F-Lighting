import { describe, expect, it } from "vitest";
import { metaDescription, productJsonLd, productSummary } from "./product-seo";
import type { ProductOptions } from "./product-view";

// covers: AC-15, AC-19 (spec 0009)

const options = (variants: readonly { price: number; sellable: boolean }[]): ProductOptions => ({
  sizes: [],
  colours: [],
  variants: variants.map((v, i) => ({ id: `v${i}`, sizeLabel: null, colourId: null, ...v })),
});

const base = {
  name: "ثريا كريستال",
  code: "CH-1",
  description: null,
  images: [],
  url: "https://skf.example/p/ch-1",
  inStock: true,
};

describe("the meta description", () => {
  it("collapses whitespace and cuts at 155 code points", () => {
    expect(productSummary("  ثريا\n\nكريستال \t كبيرة ")).toBe("ثريا كريستال كبيرة");
    const long = "😀".repeat(200);
    expect(Array.from(productSummary(long)!)).toHaveLength(155);
  });

  it("falls back when there is no description", () => {
    expect(metaDescription(null, "ثريات")).toBe("ثريات");
    expect(metaDescription("   ", "ثريات")).toBe("ثريات");
    expect(metaDescription("وصف", "ثريات")).toBe("وصف");
  });
});

describe("productJsonLd", () => {
  it("gives one Offer when the counted variants share a price", () => {
    const json = productJsonLd({
      ...base,
      options: options([
        { price: 1990, sellable: true },
        { price: 1990, sellable: true },
        { price: 5000, sellable: false },
      ]),
    });
    expect(json.offers).toEqual({
      "@type": "Offer",
      url: base.url,
      price: "19.90",
      priceCurrency: "ILS",
      availability: "https://schema.org/InStock",
    });
    expect(json).not.toHaveProperty("description");
    expect(json).not.toHaveProperty("image");
  });

  it("gives an AggregateOffer when prices differ", () => {
    const json = productJsonLd({
      ...base,
      options: options([
        { price: 125_000, sellable: true },
        { price: 45_000, sellable: true },
      ]),
    });
    expect(json.offers).toEqual({
      "@type": "AggregateOffer",
      lowPrice: "450",
      highPrice: "1250",
      offerCount: 2,
      priceCurrency: "ILS",
      availability: "https://schema.org/InStock",
    });
  });

  it("counts every live variant and says OutOfStock when out of stock", () => {
    const json = productJsonLd({
      ...base,
      inStock: false,
      options: options([
        { price: 1000, sellable: false },
        { price: 2000, sellable: false },
      ]),
    });
    expect(json.offers).toMatchObject({
      "@type": "AggregateOffer",
      offerCount: 2,
      availability: "https://schema.org/OutOfStock",
    });
  });

  it("leaves offers out with no live variant and keeps up to 8 images", () => {
    const images = Array.from({ length: 9 }, (_, i) => `https://img/${i}`);
    const json = productJsonLd({ ...base, description: "وصف", images, options: options([]) });
    expect(json).not.toHaveProperty("offers");
    expect(json).toMatchObject({ sku: "CH-1", description: "وصف", url: base.url });
    expect((json as { image: string[] }).image).toHaveLength(8);
  });
});
