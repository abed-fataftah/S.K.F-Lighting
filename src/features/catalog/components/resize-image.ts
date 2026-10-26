// Shrinks a picked photo in the browser before upload (spec 0006 AC-8): longest edge at most
// 2,000 px (never enlarged), WebP at 0.85, or JPEG at 0.85 when the browser cannot make WebP.
// Browser only. `null` means the browser cannot read it or the result is still too heavy.
// `cropImage` does the same for the homepage pictures, after cutting the centred area (spec 0011).
import { MEDIA_LIMITS, type CropRule } from "../media-rules";

export type ResizedImage = {
  readonly blob: Blob;
  readonly contentType: "image/webp" | "image/jpeg";
  readonly width: number;
  readonly height: number;
};

const QUALITY = 0.85;

/** The size to draw at: the longest edge at most `maxEdge`, never larger than the original. */
export function fitWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The centred area of a `width` by `height` source with the rule's aspect, and the size to draw it
 * at (at most `maxWidth` wide, never enlarged), or `too_small` when the area is under `minWidth`.
 */
export function cropPlan(width: number, height: number, rule: CropRule) {
  const aspect = rule.aspectWidth / rule.aspectHeight;
  const wide = width / height > aspect;
  const sw = wide ? Math.round(height * aspect) : width;
  const sh = wide ? height : Math.round(width / aspect);
  if (sw < rule.minWidth) return "too_small" as const;
  const scale = Math.min(1, rule.maxWidth / sw);
  return {
    sx: Math.round((width - sw) / 2),
    sy: Math.round((height - sh) / 2),
    sw,
    sh,
    width: Math.max(1, Math.round(sw * scale)),
    height: Math.max(1, Math.round(sh * scale)),
  };
}

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

type Area = { sx: number; sy: number; sw: number; sh: number; width: number; height: number };

/** Draws `area` of the bitmap, then WebP 0.85, or JPEG 0.85 when the browser cannot make WebP. */
async function draw(bitmap: ImageBitmap, area: Area): Promise<ResizedImage | null> {
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, area.sx, area.sy, area.sw, area.sh, 0, 0, area.width, area.height);

  // Safari and some Android browsers return PNG for an unknown type: fall back to JPEG then.
  const webp = await encode(canvas, "image/webp");
  const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg");
  if (!blob || blob.size > MEDIA_LIMITS.imageMaxBytes) return null;
  const contentType = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  if (blob.type !== contentType) return null;
  return { blob, contentType, width: area.width, height: area.height };
}

async function readBitmap(file: Blob): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

export async function resizeImage(file: Blob): Promise<ResizedImage | null> {
  const bitmap = await readBitmap(file);
  if (!bitmap) return null;
  try {
    const size = fitWithin(bitmap.width, bitmap.height, MEDIA_LIMITS.maxEdge);
    return await draw(bitmap, { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height, ...size });
  } finally {
    bitmap.close();
  }
}

/** The centred crop of a picked picture (spec 0011 AC-10, AC-11), or why it cannot be used. */
export async function cropImage(
  file: Blob,
  rule: CropRule,
): Promise<ResizedImage | "too_small" | null> {
  const bitmap = await readBitmap(file);
  if (!bitmap) return null;
  try {
    const plan = cropPlan(bitmap.width, bitmap.height, rule);
    return plan === "too_small" ? plan : await draw(bitmap, plan);
  } finally {
    bitmap.close();
  }
}
