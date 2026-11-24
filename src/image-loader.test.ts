import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supabaseImageLoader, { coverLoader } from "./image-loader";

describe("supabaseImageLoader", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a Supabase render URL for the product-media bucket with width and quality", () => {
    const url = supabaseImageLoader({ src: "products/p1/a.webp", width: 640, quality: 80 });

    expect(url).toBe(
      "https://project.supabase.co/storage/v1/render/image/public/product-media/products/p1/a.webp?width=640&quality=80&resize=contain",
    );
  });

  // Regression (scope feature 44): without `resize=contain` the endpoint's default `cover` keeps
  // the photo's full height and cuts the width to the middle strip, so every frame got a cropped
  // photo no matter what CSS the frame used.
  it("asks for resize=contain so a width alone scales the whole photo instead of cropping it", () => {
    const url = new URL(supabaseImageLoader({ src: "products/p1/a.webp", width: 300 }));

    expect(url.searchParams.get("resize")).toBe("contain");
    expect(url.searchParams.has("height")).toBe(false);
  });

  it("defaults quality to 75 when next/image passes none", () => {
    const url = new URL(supabaseImageLoader({ src: "products/p1/a.webp", width: 320 }));

    expect(url.searchParams.get("quality")).toBe("75");
    expect(url.searchParams.get("width")).toBe("320");
  });

  it("returns a different URL for each width, so srcset entries are distinct", () => {
    const small = supabaseImageLoader({ src: "products/p1/a.webp", width: 320 });
    const large = supabaseImageLoader({ src: "products/p1/a.webp", width: 1080 });

    expect(small).not.toBe(large);
  });

  describe("coverLoader", () => {
    it("asks for the frame's height at the requested width and a cover crop", () => {
      const url = new URL(coverLoader(4 / 5)({ src: "categories/c1.webp", width: 384 }));

      expect(url.searchParams.get("width")).toBe("384");
      expect(url.searchParams.get("height")).toBe("480");
      expect(url.searchParams.get("resize")).toBe("cover");
      expect(url.searchParams.get("quality")).toBe("75");
      expect(url.pathname).toBe("/storage/v1/render/image/public/product-media/categories/c1.webp");
    });

    it("rounds the height to whole pixels and keeps the given quality", () => {
      const url = new URL(coverLoader(16 / 9)({ src: "banners/b1.webp", width: 750, quality: 60 }));

      expect(url.searchParams.get("height")).toBe("422");
      expect(url.searchParams.get("quality")).toBe("60");
    });
  });

  it("encodes each key segment, so a space, hash, or question mark reaches the object", () => {
    const url = new URL(supabaseImageLoader({ src: "products/p1/a b#1?.webp", width: 100 }));

    expect(url.pathname).toBe(
      "/storage/v1/render/image/public/product-media/products/p1/a%20b%231%3F.webp",
    );
    expect(url.hash).toBe("");
    expect(url.searchParams.get("width")).toBe("100");
    expect(url.searchParams.get("resize")).toBe("contain");
  });

  it("keeps the object key path intact under the bucket", () => {
    const url = new URL(supabaseImageLoader({ src: "products/abc-123/f00d.png", width: 100 }));

    expect(url.pathname).toBe(
      "/storage/v1/render/image/public/product-media/products/abc-123/f00d.png",
    );
  });
});
