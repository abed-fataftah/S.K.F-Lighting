import { afterEach, describe, expect, it, vi } from "vitest";
import type { SitemapData } from "../sitemap";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ getDb: async () => ({}) }));

const { handleRobots, handleSitemap, SITEMAP_TIMEOUT_MS } = await import("./handlers");

// covers: AC-1, AC-2, AC-3, AC-4 (spec 0026)

const siteUrl = "https://skf.example";
const production = (path: string) => new Request(`https://skf.example${path}`);
const preview = (path: string) => new Request(`https://skf-pro.abc.workers.dev${path}`);

const data: SitemapData = {
  products: [{ slug: "lamp", categoryId: "c", updatedAt: new Date("2026-11-01T10:00:00.000Z") }],
  categories: [
    {
      id: "c",
      slug: "lamps",
      name: "أباجورات",
      sort: 0,
      parentId: null,
      isVisible: true,
      updatedAt: new Date("2026-10-01T08:00:00.000Z"),
    },
  ],
  pages: [],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("handleRobots", () => {
  it("answers the open file as plain text on the production host, with no robots header", async () => {
    const response = handleRobots(production("/robots.txt"), siteUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
    expect(await response.text()).toContain("Sitemap: https://skf.example/sitemap.xml");
  });

  it("closes everything off the production host and says noindex", async () => {
    const response = handleRobots(preview("/robots.txt"), siteUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});

describe("handleSitemap", () => {
  it("builds the list live as XML with a crawler cache hint", async () => {
    const read = vi.fn(async () => data);

    const response = await handleSitemap(production("/sitemap.xml"), { siteUrl, read });

    expect(read).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
    const xml = await response.text();
    expect(xml).toContain(
      "<url><loc>https://skf.example/p/lamp</loc><lastmod>2026-11-01T10:00:00.000Z</lastmod></url>",
    );
    expect(xml).toContain("<loc>https://skf.example/c/lamps</loc>");
  });

  it("is a 404 off the production host and never reads", async () => {
    const read = vi.fn(async () => data);

    const response = await handleSitemap(preview("/sitemap.xml"), { siteUrl, read });

    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(read).not.toHaveBeenCalled();
  });

  it("answers 503 with Retry-After when a read fails, never a partial list", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await handleSitemap(production("/sitemap.xml"), {
      siteUrl,
      read: async () => {
        throw new TypeError("connection refused");
      },
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("3600");
    expect(await response.text()).toBe("");
    expect(error).toHaveBeenCalledWith(
      JSON.stringify({ event: "sitemap_read_failed", error: "TypeError" }),
    );
  });

  it("answers 503 when the reads pass the 3 second limit", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const pending = handleSitemap(production("/sitemap.xml"), {
      siteUrl,
      read: () => new Promise<SitemapData>(() => {}),
    });
    await vi.advanceTimersByTimeAsync(SITEMAP_TIMEOUT_MS);

    expect((await pending).status).toBe(503);
  });
});
