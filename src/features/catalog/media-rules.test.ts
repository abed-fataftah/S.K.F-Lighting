import { describe, expect, it } from "vitest";
import {
  MEDIA_LIMITS,
  isKeyForProduct,
  leftoverKeys,
  mediaKey,
  orderMedia,
  orphanFolders,
  parseMediaKey,
  storedObjectFits,
  type StoredObject,
} from "./media-rules";

// covers: AC-8, AC-15, AC-16 (spec 0006)

const PRODUCT = "1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b";
const OTHER = "2c5f39cb-3ab2-4e4c-b4a6-fa2ac6b8744c";
const FILE = "9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
const NOW = new Date("2026-10-21T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const HOUR = 60 * 60 * 1000;

describe("media keys", () => {
  it("builds the one key shape under the product's folder", () => {
    expect(mediaKey(PRODUCT, FILE, "webp")).toBe(`products/${PRODUCT}/${FILE}.webp`);
    expect(mediaKey(PRODUCT.toUpperCase(), FILE, "mp4")).toBe(`products/${PRODUCT}/${FILE}.mp4`);
  });

  it("reads the kind from the extension", () => {
    expect(parseMediaKey(mediaKey(PRODUCT, FILE, "jpg"))).toEqual({
      productId: PRODUCT,
      ext: "jpg",
      kind: "image",
    });
    expect(parseMediaKey(mediaKey(PRODUCT, FILE, "mp4"))?.kind).toBe("video");
  });

  it.each([
    [`products/${OTHER}/${FILE}.webp`, "another product's folder"],
    [`products/${PRODUCT}/${FILE}.png`, "an extension the server never makes"],
    [`products/${PRODUCT}/../${OTHER}/${FILE}.webp`, "a path that climbs out"],
    [`products/${PRODUCT}/photo.webp`, "a name the browser chose"],
    [`https://example.com/products/${PRODUCT}/${FILE}.webp`, "a URL"],
    [`products/${PRODUCT}/${FILE}.webp/x`, "anything after the name"],
  ])("refuses %s (%s)", (key) => {
    expect(isKeyForProduct(key, PRODUCT)).toBe(false);
  });

  it("accepts the server's own key for this product", () => {
    expect(isKeyForProduct(mediaKey(PRODUCT, FILE, "webp"), PRODUCT)).toBe(true);
  });
});

describe("storedObjectFits", () => {
  const object = (mimetype: string, size: number): StoredObject => ({
    name: "x",
    createdAt: NOW,
    mimetype,
    size,
  });
  const photo = mediaKey(PRODUCT, FILE, "webp");
  const video = mediaKey(PRODUCT, FILE, "mp4");

  it("takes a file whose real type and size fit its key", () => {
    expect(storedObjectFits(photo, object("image/webp", 300_000))).toBe(true);
    expect(storedObjectFits(video, object("video/mp4", MEDIA_LIMITS.videoMaxBytes))).toBe(true);
  });

  it("refuses a missing file, a wrong type, and a size over the limit", () => {
    expect(storedObjectFits(photo, undefined)).toBe(false);
    expect(storedObjectFits(photo, object("image/jpeg", 300_000))).toBe(false);
    expect(storedObjectFits(photo, object("image/webp", MEDIA_LIMITS.imageMaxBytes + 1))).toBe(
      false,
    );
    expect(storedObjectFits(video, object("video/mp4", MEDIA_LIMITS.videoMaxBytes + 1))).toBe(
      false,
    );
    expect(storedObjectFits(photo, { ...object("image/webp", 1), size: null })).toBe(false);
  });
});

describe("orderMedia", () => {
  it("keeps the photo order and always puts the video last", () => {
    const ordered = orderMedia([
      { storageKey: "a", kind: "image" as const },
      { storageKey: "v", kind: "video" as const },
      { storageKey: "b", kind: "image" as const },
    ]);
    expect(ordered.map((m) => [m.storageKey, m.sort])).toEqual([
      ["a", 0],
      ["b", 1],
      ["v", 2],
    ]);
  });
});

describe("leftoverKeys", () => {
  it("removes unsaved files older than an hour and keeps saved or fresh ones", () => {
    const folder: StoredObject[] = [
      { name: "kept.webp", createdAt: ago(5 * HOUR), mimetype: "image/webp", size: 1 },
      { name: "old.webp", createdAt: ago(2 * HOUR), mimetype: "image/webp", size: 1 },
      { name: "fresh.webp", createdAt: ago(10 * 60 * 1000), mimetype: "image/webp", size: 1 },
      { name: "unknown.webp", createdAt: null, mimetype: null, size: null },
    ];
    const kept = new Set([`products/${PRODUCT}/kept.webp`]);
    expect(leftoverKeys(folder, kept, PRODUCT, NOW)).toEqual([`products/${PRODUCT}/old.webp`]);
  });
});

describe("orphanFolders", () => {
  it("picks folders with no product that have been quiet for a day", () => {
    const folders = [
      { productId: PRODUCT, newest: ago(48 * HOUR) },
      { productId: OTHER, newest: ago(48 * HOUR) },
      { productId: FILE, newest: ago(2 * HOUR) },
      { productId: "3d6a4adc-4bc3-4f5d-85b7-ab3bd7c9855d", newest: null },
    ];
    expect(orphanFolders(folders, new Set([PRODUCT]), NOW)).toEqual([
      OTHER,
      "3d6a4adc-4bc3-4f5d-85b7-ab3bd7c9855d",
    ]);
  });
});
