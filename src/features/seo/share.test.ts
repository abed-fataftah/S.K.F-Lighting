import { describe, expect, it } from "vitest";
import {
  categoryShareImage,
  defaultShareMetadata,
  fittedShareSize,
  productShareImage,
  shareImageUrl,
  shareMetadata,
  shopImage,
} from "./share";

// covers: AC-5, AC-6, AC-7, AC-13, AC-14 (spec 0026)

const supabaseUrl = "https://abc.supabase.co";
const shop = shopImage("https://skf.example", "شعار S.K.F للإنارة");

describe("shopImage", () => {
  it("is the absolute 1200 by 630 file with its alt", () => {
    expect(shop).toEqual({
      url: "https://skf.example/brand/share.png",
      alt: "شعار S.K.F للإنارة",
      width: 1200,
      height: 630,
    });
  });
});

describe("shareImageUrl", () => {
  it("fits the photo inside 1200 by 630 through the render endpoint, never cropped", () => {
    expect(shareImageUrl(supabaseUrl, "products/p1/a b.webp")).toBe(
      "https://abc.supabase.co/storage/v1/render/image/public/product-media/products/p1/a%20b.webp?width=1200&height=630&resize=contain&quality=80",
    );
  });
});

describe("fittedShareSize", () => {
  it("scales a tall photo to the frame's height", () => {
    expect(fittedShareSize(2000, 3000)).toEqual({ width: 420, height: 630 });
  });

  it("scales a wide photo to the frame's width", () => {
    expect(fittedShareSize(2400, 1000)).toEqual({ width: 1200, height: 500 });
  });

  it("never enlarges a small photo", () => {
    expect(fittedShareSize(600, 400)).toEqual({ width: 600, height: 400 });
  });

  it.each([
    [null, 600],
    [800, null],
    [0, 600],
    [-1, 600],
  ])("leaves the size out for %s by %s", (width, height) => {
    expect(fittedShareSize(width, height)).toBeNull();
  });
});

describe("productShareImage", () => {
  const photo = { key: "products/p1/1.webp", width: 2000, height: 3000, alt: "ثريا ذهبية" };

  it("uses the first photo, its fitted size, and its alt", () => {
    expect(productShareImage({ photo, supabaseUrl, fallbackAlt: "ثريا، صورة 1", shop })).toEqual({
      url: shareImageUrl(supabaseUrl, photo.key),
      alt: "ثريا ذهبية",
      width: 420,
      height: 630,
    });
  });

  it("fills a missing alt and leaves an unknown size out", () => {
    const image = productShareImage({
      photo: { ...photo, alt: "  ", width: null },
      supabaseUrl,
      fallbackAlt: "ثريا، صورة 1",
      shop,
    });

    expect(image).toEqual({ url: shareImageUrl(supabaseUrl, photo.key), alt: "ثريا، صورة 1" });
  });

  it("falls back to the shop image with no photo", () => {
    expect(productShareImage({ photo: null, supabaseUrl, fallbackAlt: "x", shop })).toBe(shop);
  });
});

describe("categoryShareImage", () => {
  it("uses the main's photo with the page's name", () => {
    expect(
      categoryShareImage({
        mainImageKey: "categories/c1.webp",
        name: "أباجورات",
        supabaseUrl,
        shop,
      }),
    ).toEqual({ url: shareImageUrl(supabaseUrl, "categories/c1.webp"), alt: "أباجورات" });
  });

  it("falls back to the shop image when the main has no photo", () => {
    expect(categoryShareImage({ mainImageKey: null, name: "أباجورات", supabaseUrl, shop })).toBe(
      shop,
    );
  });
});

describe("shareMetadata", () => {
  const tags = shareMetadata({
    siteName: "S.K.F للإنارة",
    title: "ثريا كريستال",
    description: "ثريا من الكريستال",
    canonical: "https://skf.example/p/%D8%AB%D8%B1%D9%8A%D8%A7",
    image: { url: "https://abc.supabase.co/x.webp", alt: "ثريا", width: 420, height: 630 },
  });

  it("always carries the site name, locale, type, and og:url equal to the canonical", () => {
    expect(tags.openGraph).toEqual({
      type: "website",
      siteName: "S.K.F للإنارة",
      locale: "ar_AR",
      title: "ثريا كريستال",
      description: "ثريا من الكريستال",
      url: "https://skf.example/p/%D8%AB%D8%B1%D9%8A%D8%A7",
      images: [{ url: "https://abc.supabase.co/x.webp", alt: "ثريا", width: 420, height: 630 }],
    });
  });

  it("gives X the large card and the same image", () => {
    expect(tags.twitter).toEqual({
      card: "summary_large_image",
      title: "ثريا كريستال",
      description: "ثريا من الكريستال",
      images: [{ url: "https://abc.supabase.co/x.webp", alt: "ثريا", width: 420, height: 630 }],
    });
  });

  it("leaves the size out when the image has none", () => {
    const { openGraph } = shareMetadata({
      siteName: "S",
      title: "t",
      description: "d",
      canonical: "https://skf.example/",
      image: { url: "https://skf.example/a.png", alt: "a" },
    });

    expect(openGraph?.images).toEqual([{ url: "https://skf.example/a.png", alt: "a" }]);
  });
});

describe("defaultShareMetadata", () => {
  it("sets the shared tags with no page title or address", () => {
    expect(defaultShareMetadata({ siteName: "S.K.F للإنارة", image: shop })).toEqual({
      openGraph: {
        type: "website",
        siteName: "S.K.F للإنارة",
        locale: "ar_AR",
        images: [{ url: shop.url, alt: shop.alt }],
      },
      twitter: { card: "summary_large_image", images: [{ url: shop.url, alt: shop.alt }] },
    });
  });
});
