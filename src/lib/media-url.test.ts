import { describe, expect, it } from "vitest";
import { mediaObjectUrl } from "./media-url";

// covers: AC-11, AC-15 (spec 0009)
describe("mediaObjectUrl", () => {
  it("points at the public product-media object", () => {
    expect(mediaObjectUrl("http://127.0.0.1:54321", "products/p1/a b.mp4")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/product-media/products/p1/a%20b.mp4",
    );
  });
});
