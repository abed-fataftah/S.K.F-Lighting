"use client";

import type { ImageLoaderProps } from "next/image";

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
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const params = new URLSearchParams({
    width: String(width),
    quality: String(quality ?? 75),
    resize: "contain",
  });
  return `${base}/storage/v1/render/image/public/product-media/${src}?${params}`;
}
