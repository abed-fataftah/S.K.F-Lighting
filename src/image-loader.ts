"use client";

import type { ImageLoaderProps } from "next/image";

/**
 * Serves product media through Supabase image transformations (spec 0001).
 * `src` is the object key inside the `product-media` bucket,
 * for example `products/<productId>/<uuid>.webp`.
 */
export default function supabaseImageLoader({ src, width, quality }: ImageLoaderProps) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const params = new URLSearchParams({ width: String(width), quality: String(quality ?? 75) });
  return `${base}/storage/v1/render/image/public/product-media/${src}?${params}`;
}
