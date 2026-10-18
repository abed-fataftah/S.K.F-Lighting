import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import supabaseImageLoader from "./image-loader";

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
      "https://project.supabase.co/storage/v1/render/image/public/product-media/products/p1/a.webp?width=640&quality=80",
    );
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

  it("keeps the object key path intact under the bucket", () => {
    const url = new URL(supabaseImageLoader({ src: "products/abc-123/f00d.png", width: 100 }));

    expect(url.pathname).toBe(
      "/storage/v1/render/image/public/product-media/products/abc-123/f00d.png",
    );
  });
});
