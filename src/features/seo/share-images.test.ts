import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_IMAGE, SHOP_LOGO_PATH } from "./share";

// covers: AC-13 (spec 0026). The PNG header holds the width and height at bytes 16 to 23.
const png = (path: string) => readFileSync(join(process.cwd(), "public", path));
const size = (file: Buffer) => ({ width: file.readUInt32BE(16), height: file.readUInt32BE(20) });

describe("the committed share images", () => {
  it("has a 1200 by 630 share image under 300 KB", () => {
    const file = png(SHOP_IMAGE.path);

    expect(file.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(size(file)).toEqual({ width: SHOP_IMAGE.width, height: SHOP_IMAGE.height });
    expect(file.byteLength).toBeLessThan(300 * 1024);
  });

  it("has a 512 by 512 logo for the Store block", () => {
    const file = png(SHOP_LOGO_PATH);

    expect(file.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(size(file)).toEqual({ width: 512, height: 512 });
  });
});
