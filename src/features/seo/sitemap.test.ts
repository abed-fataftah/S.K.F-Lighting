import { describe, expect, it } from "vitest";
import { buildSitemapXml, collectSitemapEntries, type SitemapData } from "./sitemap";

// covers: AC-3 (spec 0026)

const siteUrl = "https://skf.example";
const at = (iso: string) => new Date(iso);

const category = (
  id: string,
  slug: string,
  over: Partial<SitemapData["categories"][number]> = {},
): SitemapData["categories"][number] => ({
  id,
  slug,
  name: slug,
  sort: 0,
  parentId: null,
  isVisible: true,
  updatedAt: at("2026-10-01T08:00:00.000Z"),
  ...over,
});

const product = (slug: string, categoryId: string, iso = "2026-11-01T10:00:00.000Z") => ({
  slug,
  categoryId,
  updatedAt: at(iso),
});

const empty: SitemapData = { products: [], categories: [], pages: [] };
const locs = (data: SitemapData) => collectSitemapEntries(siteUrl, data).map((entry) => entry.loc);

describe("collectSitemapEntries", () => {
  it("always lists home and /c with no date", () => {
    expect(collectSitemapEntries(siteUrl, empty)).toEqual([
      { loc: "https://skf.example/", lastmod: null },
      { loc: "https://skf.example/c", lastmod: null },
    ]);
  });

  it("lists each listed product with its updated_at and its category with its own", () => {
    const entries = collectSitemapEntries(siteUrl, {
      ...empty,
      categories: [category("c1", "lamps", { updatedAt: at("2026-09-09T09:09:09.000Z") })],
      products: [product("desk-lamp", "c1")],
    });

    expect(entries).toContainEqual({
      loc: "https://skf.example/c/lamps",
      lastmod: at("2026-09-09T09:09:09.000Z"),
    });
    expect(entries).toContainEqual({
      loc: "https://skf.example/p/desk-lamp",
      lastmod: at("2026-11-01T10:00:00.000Z"),
    });
  });

  it("lists a main with no products of its own when a shown sub holds one", () => {
    const urls = locs({
      ...empty,
      categories: [category("m", "lighting"), category("s", "chandeliers", { parentId: "m" })],
      products: [product("gold", "s")],
    });

    expect(urls).toContain("https://skf.example/c/lighting");
    expect(urls).toContain("https://skf.example/c/lighting/chandeliers");
  });

  it("leaves out a main whose only products sit in a hidden sub, and the hidden sub", () => {
    const urls = locs({
      ...empty,
      categories: [
        category("m", "lighting"),
        category("s", "chandeliers", { parentId: "m", isVisible: false }),
      ],
      // The read applies `listedProduct`, so a hidden sub's product never arrives; the count
      // rule alone must still keep the main out if one ever did.
      products: [product("gold", "s")],
    });

    expect(urls).not.toContain("https://skf.example/c/lighting");
    expect(urls).not.toContain("https://skf.example/c/lighting/chandeliers");
  });

  it("leaves out a hidden main and an empty category", () => {
    const urls = locs({
      ...empty,
      categories: [category("h", "hidden", { isVisible: false }), category("e", "empty")],
      products: [product("x", "h")],
    });

    expect(urls.filter((url) => url.includes("/c/"))).toEqual([]);
  });

  it("lists each policy page that has a row, in tab order", () => {
    const entries = collectSitemapEntries(siteUrl, {
      ...empty,
      pages: [
        { slug: "returns", updatedAt: at("2026-10-02T00:00:00.000Z") },
        { slug: "privacy", updatedAt: at("2026-10-01T00:00:00.000Z") },
        { slug: "about", updatedAt: at("2026-10-03T00:00:00.000Z") },
      ],
    });

    expect(entries.slice(2)).toEqual([
      { loc: "https://skf.example/policies/privacy", lastmod: at("2026-10-01T00:00:00.000Z") },
      { loc: "https://skf.example/policies/returns", lastmod: at("2026-10-02T00:00:00.000Z") },
    ]);
  });

  it("percent encodes an Arabic slug through routes", () => {
    expect(
      locs({ ...empty, categories: [category("c", "c")], products: [product("ثريا", "c")] }),
    ).toContain("https://skf.example/p/%D8%AB%D8%B1%D9%8A%D8%A7");
  });
});

describe("buildSitemapXml", () => {
  it("writes one urlset with loc and a UTC lastmod, and no priority or changefreq", () => {
    const xml = buildSitemapXml([
      { loc: "https://skf.example/", lastmod: null },
      { loc: "https://skf.example/p/%D8%AB", lastmod: new Date(Date.UTC(2026, 10, 6, 9, 30)) },
    ]);

    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "<url><loc>https://skf.example/</loc></url>",
        "<url><loc>https://skf.example/p/%D8%AB</loc><lastmod>2026-11-06T09:30:00.000Z</lastmod></url>",
        "</urlset>",
        "",
      ].join("\n"),
    );
    expect(xml).not.toMatch(/priority|changefreq/);
  });

  it("escapes & and < in a loc", () => {
    expect(buildSitemapXml([{ loc: "https://skf.example/a?b=1&c=<", lastmod: null }])).toContain(
      "<loc>https://skf.example/a?b=1&amp;c=&lt;</loc>",
    );
  });
});
