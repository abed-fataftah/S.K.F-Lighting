import { describe, expect, it } from "vitest";
import { isProductionHost } from "./indexing";

// covers: AC-2 (spec 0026)
describe("isProductionHost", () => {
  const siteUrl = "https://skf.example";

  it.each(["skf.example", "SKF.example.", "skf.example:443", "skf.example:80"])(
    "treats %s as production",
    (host) => {
      expect(isProductionHost(host, siteUrl)).toBe(true);
    },
  );

  it.each([
    "skf-pro.abc.workers.dev",
    "www.skf.example",
    "skf.example:8443",
    "preview.skf.example",
  ])("treats %s as not production", (host) => {
    expect(isProductionHost(host, siteUrl)).toBe(false);
  });

  it("counts localhost as production when the site address points at it", () => {
    expect(isProductionHost("localhost:3000", "http://localhost:3000")).toBe(true);
    expect(isProductionHost("localhost:8787", "http://localhost:3000")).toBe(false);
  });
});
