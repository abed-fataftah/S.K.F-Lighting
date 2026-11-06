import { describe, expect, it } from "vitest";
import { buildRobotsTxt } from "./robots";

// covers: AC-1, AC-2 (spec 0026)
describe("buildRobotsTxt", () => {
  it("opens the shop and points at the sitemap on the production host", () => {
    expect(buildRobotsTxt("https://skf.example", true)).toBe(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /auth",
        "Disallow: /api",
        "Disallow: /design-system",
        "Sitemap: https://skf.example/sitemap.xml",
        "",
      ].join("\n"),
    );
  });

  it("does not block the noindex pages, so crawlers can read their tag", () => {
    const text = buildRobotsTxt("https://skf.example", true);

    for (const path of ["/account", "/cart", "/checkout", "/orders", "/search"]) {
      expect(text).not.toContain(`Disallow: ${path}`);
    }
  });

  it("closes everything on any other host", () => {
    expect(buildRobotsTxt("https://skf.example", false)).toBe("User-agent: *\nDisallow: /\n");
  });
});
