"use client";

import type { ImageLoader, ImageLoaderProps } from "next/image";

/**
 * Serves product media through Supabase image transformations (spec 0001).
 * `src` is the object key inside the `product-media` bucket,
 * for example `products/<productId>/<uuid>.webp`.
 *
 * `resize=contain` is required: the render endpoint defaults to `cover`, and with a width alone it
 * keeps the photo's full height and cuts the width to the middle strip (a 1200 by 1500 photo at
 * `width=300` comes back 300 by 1500). `contain` scales the whole photo to the width instead,
 * never enlarging it (scope feature 44).
 */
export default function supabaseImageLoader({ src, width, quality }: ImageLoaderProps) {
  return renderUrl(src, { width, quality: quality ?? 75, resize: "contain" });
}

/**
 * A loader for a frame that crops the photo to `aspect` (width over height) with `object-cover`
 * and may be taller than the photo, like Home's 4:5 category card over its 1:1 upload crop.
 * Supabase cuts the photo to the frame's shape at the requested width, so the browser gets the
 * frame's full height and never enlarges a photo shorter than the frame.
 */
export function coverLoader(aspect: number): ImageLoader {
  return ({ src, width, quality }) =>
    renderUrl(src, {
      width,
      height: Math.round(width / aspect),
      quality: quality ?? 75,
      resize: "cover",
    });
}

function renderUrl(
  src: string,
  options: {
    readonly width: number;
    readonly height?: number;
    readonly quality: number;
    readonly resize: "contain" | "cover";
  },
) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const params = new URLSearchParams({ width: String(options.width) });
  if (options.height !== undefined) params.set("height", String(options.height));
  params.set("quality", String(options.quality));
  params.set("resize", options.resize);
  return `${base}/storage/v1/render/image/public/product-media/${src}?${params}`;
}
