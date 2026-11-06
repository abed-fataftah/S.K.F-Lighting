import type { Metadata } from "next";

// Share tags (spec 0026 AC-5 to AC-7): what WhatsApp, Facebook, and X read to draw a link preview.
// Next merges metadata shallowly, so a page's `openGraph` replaces the layout's whole object. Every
// page builds its share tags here, so the site name, locale, type, image, and card are never lost.

export type ShareImage = {
  /** Absolute. */
  readonly url: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
};

/** The shop image (AC-13): made by `scripts/make-share-images.mjs`. */
export const SHOP_IMAGE = { path: "/brand/share.png", width: 1200, height: 630 } as const;

/** The square logo the Store block names (AC-9), made by the same script. */
export const SHOP_LOGO_PATH = "/brand/logo.png";

export const SHARE_LOCALE = "ar_AR";

const SHARE_WIDTH = 1200;
const SHARE_HEIGHT = 630;

export function shopImage(siteUrl: string, alt: string): ShareImage {
  return {
    url: `${siteUrl}${SHOP_IMAGE.path}`,
    alt,
    width: SHOP_IMAGE.width,
    height: SHOP_IMAGE.height,
  };
}

/** A `product-media` photo fitted inside 1200 by 630 on Supabase, never cropped (AC-6). */
export function shareImageUrl(supabaseUrl: string, key: string): string {
  const path = key.split("/").map(encodeURIComponent).join("/");
  const params = new URLSearchParams({
    width: String(SHARE_WIDTH),
    height: String(SHARE_HEIGHT),
    resize: "contain",
    quality: "80",
  });
  return `${supabaseUrl}/storage/v1/render/image/public/product-media/${path}?${params}`;
}

/**
 * The photo's size once fitted inside 1200 by 630, never enlarged, rounded (AC-6); null when
 * either side is unknown or not above 0. Best effort: the transform decides the real output.
 */
export function fittedShareSize(
  width: number | null,
  height: number | null,
): { readonly width: number; readonly height: number } | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const scale = Math.min(1, SHARE_WIDTH / width, SHARE_HEIGHT / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * The `openGraph` and `twitter` tags of one page. `title` is the bare name (no site suffix);
 * `canonical` is absolute and becomes `og:url`.
 */
export function shareMetadata(input: {
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly image: ShareImage;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = {
    url: input.image.url,
    alt: input.image.alt,
    ...(input.image.width && input.image.height
      ? { width: input.image.width, height: input.image.height }
      : {}),
  };
  return {
    openGraph: {
      type: "website",
      siteName: input.siteName,
      locale: SHARE_LOCALE,
      title: input.title,
      description: input.description,
      url: input.canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}

/** The layout's defaults for every other page (AC-5): no title, description, or address of its own. */
export function defaultShareMetadata(input: {
  readonly siteName: string;
  readonly image: ShareImage;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const image = { url: input.image.url, alt: input.image.alt };
  return {
    openGraph: {
      type: "website",
      siteName: input.siteName,
      locale: SHARE_LOCALE,
      images: [image],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

/**
 * A product's share image (AC-6): its first photo in gallery order, fitted, with the photo's alt
 * (else "<name>، صورة 1"); the shop image when it has none.
 */
export function productShareImage(input: {
  readonly photo: {
    readonly key: string;
    readonly width: number | null;
    readonly height: number | null;
    readonly alt: string | null;
  } | null;
  readonly supabaseUrl: string;
  readonly fallbackAlt: string;
  readonly shop: ShareImage;
}): ShareImage {
  const { photo } = input;
  if (!photo) return input.shop;
  const size = fittedShareSize(photo.width, photo.height);
  return {
    url: shareImageUrl(input.supabaseUrl, photo.key),
    alt: photo.alt?.trim() || input.fallbackAlt,
    ...(size ?? {}),
  };
}

/** A category's share image (AC-7): the main's photo (also on a sub page), else the shop image. */
export function categoryShareImage(input: {
  readonly mainImageKey: string | null;
  readonly name: string;
  readonly supabaseUrl: string;
  readonly shop: ShareImage;
}): ShareImage {
  return input.mainImageKey
    ? { url: shareImageUrl(input.supabaseUrl, input.mainImageKey), alt: input.name }
    : input.shop;
}
