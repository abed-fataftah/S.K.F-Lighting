import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH, launchPages, pickFromSitemap } from "./pages";

// covers: AC-12, AC-13 (spec 0028): seven pages, built from routes, in their two groups.
describe("launchPages", () => {
  const pages = launchPages({
    base: "https://shop.example",
    category: "ثريات",
    product: "ثريا-كريستال-demo-2",
    search: DEFAULT_SEARCH,
    order: "26-00042",
  });

  it("lists the seven pages, cold first, then warm", () => {
    expect(pages.map((page) => [page.key, page.group])).toEqual([
      ["home", "cold"],
      ["category", "cold"],
      ["product", "cold"],
      ["search", "cold"],
      ["cart", "warm"],
      ["checkout", "warm"],
      ["order", "warm"],
    ]);
  });

  it("builds every address on the base through routes, Arabic encoded", () => {
    const url = Object.fromEntries(pages.map((page) => [page.key, page.url]));
    expect(url.home).toBe("https://shop.example/");
    expect(url.category).toBe(`https://shop.example/c/${encodeURIComponent("ثريات")}`);
    expect(url.product).toBe(`https://shop.example/p/${encodeURIComponent("ثريا-كريستال-demo-2")}`);
    expect(new URL(url.search!).pathname).toBe("/search");
    expect(new URL(url.search!).searchParams.get("q")).toBe("ثريا");
    expect(url.cart).toBe("https://shop.example/cart");
    expect(url.checkout).toBe("https://shop.example/checkout");
    expect(url.order).toBe("https://shop.example/orders/26-00042");
  });

  it("keeps a base with a trailing slash on the same host", () => {
    const [home] = launchPages({
      base: "http://localhost:8787/",
      category: "a",
      product: "b",
      search: "c",
      order: "26-00001",
    });
    expect(home!.url).toBe("http://localhost:8787/");
  });
});

const sitemap = (...locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((loc) => `<url><loc>${loc}</loc><lastmod>2026-11-01</lastmod></url>`)
    .join("")}</urlset>`;

// covers: AC-12 (spec 0028): the category and product come from the live sitemap when not given.
describe("pickFromSitemap", () => {
  it("takes the first /c/ and the first /p/ entry, decoded", () => {
    const xml = sitemap(
      "https://shop.example/",
      "https://shop.example/c",
      `https://shop.example/c/${encodeURIComponent("ثريات")}`,
      `https://shop.example/c/${encodeURIComponent("إنارة")}`,
      "https://shop.example/policies/privacy",
      `https://shop.example/p/${encodeURIComponent("لمبة-led-demo-1")}`,
      "https://shop.example/p/second",
    );
    expect(pickFromSitemap(xml)).toEqual({ category: "ثريات", product: "لمبة-led-demo-1" });
  });

  it("takes the main category of a sub category entry, and reads XML entities", () => {
    const xml = sitemap(
      "https://shop.example/c/main/sub",
      "https://shop.example/p/a-b?v=1&amp;x=2",
    );
    expect(pickFromSitemap(xml)).toEqual({ category: "main", product: "a-b" });
  });

  it.each([
    ["an HTML page", "<!doctype html><html><body>Not found</body></html>"],
    ["an empty body", ""],
    ["a sitemap with no product", sitemap("https://shop.example/c/main")],
    ["a sitemap with no category", sitemap("https://shop.example/p/one")],
    [
      "a sitemap with only the category index",
      sitemap("https://shop.example/c", "https://shop.example/p/one"),
    ],
  ])("gives null for %s", (_name, xml) => {
    expect(pickFromSitemap(xml)).toBeNull();
  });
});
