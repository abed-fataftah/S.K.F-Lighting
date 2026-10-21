// Shrinks a picked photo in the browser before upload (spec 0006 AC-8): longest edge at most
// 2,000 px (never enlarged), WebP at 0.85, or JPEG at 0.85 when the browser cannot make WebP.
// Browser only. `null` means the browser cannot read it or the result is still too heavy.
import { MEDIA_LIMITS } from "../media-rules";

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

const encode = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

export async function resizeImage(file: Blob): Promise<ResizedImage | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MEDIA_LIMITS.maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, width, height);

    // Safari and some Android browsers return PNG for an unknown type: fall back to JPEG then.
    const webp = await encode(canvas, "image/webp");
    const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg");
    if (!blob || blob.size > MEDIA_LIMITS.imageMaxBytes) return null;
    const contentType = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    if (blob.type !== contentType) return null;
    return { blob, contentType, width, height };
  } finally {
    bitmap.close();
  }
}
