import { describe, expect, it } from "vitest";
import {
  parseStatsResponse,
  productSlugFromPath,
  referrerLabel,
  summarizeVisits,
  topProducts,
  topSources,
  viewsBySlug,
  type StatsRow,
} from "./shape";

const hourRow = (datetimeHour: string, count: number, visits: number): StatsRow => ({
  count,
  sum: { visits },
  dimensions: { datetimeHour },
});
const pathRow = (requestPath: string, count: number): StatsRow => ({
  count,
  sum: { visits: 0 },
  dimensions: { requestPath },
});
const hostRow = (refererHost: string | null, visits: number): StatsRow => ({
  count: visits,
  sum: { visits },
  dimensions: { refererHost },
});

describe("parseStatsResponse", () => {
  const rows = [hourRow("2026-11-06T10:00:00Z", 3, 1)];
  const body = (groups: unknown, errors: unknown = null) => ({
    data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: groups }] } },
    errors,
  });

  it("returns the rows", () => {
    expect(parseStatsResponse(body(rows))).toEqual(rows);
  });

  it("reads no account row as no data yet", () => {
    expect(parseStatsResponse({ data: { viewer: { accounts: [] } }, errors: null })).toEqual([]);
  });

  it("fails on GraphQL errors, a missing data block, or another shape", () => {
    expect(parseStatsResponse(body(rows, [{ message: "bad" }]))).toBeNull();
    expect(parseStatsResponse({ data: null, errors: [{ message: "x" }] })).toBeNull();
    expect(parseStatsResponse({ data: null })).toBeNull();
    expect(parseStatsResponse("<html>")).toBeNull();
    expect(parseStatsResponse(body([{ count: "3" }]))).toBeNull();
  });
});

// covers: AC-2 (spec 0027): shop day bars, zero filled, and the two totals.
describe("summarizeVisits", () => {
  const week = { from: "2026-11-01", to: "2026-11-07" };

  it("puts each hour on its shop day, not its UTC day", () => {
    const summary = summarizeVisits(
      [
        // 21:00 UTC on the 5th is 23:00 shop time on the 5th; 22:00 UTC is midnight on the 6th.
        hourRow("2026-11-05T21:00:00Z", 4, 2),
        hourRow("2026-11-05T22:00:00Z", 5, 3),
        hourRow("2026-11-06T09:00:00Z", 1, 1),
      ],
      week,
    );
    expect(summary.days.find((d) => d.day === "2026-11-05")).toEqual({
      day: "2026-11-05",
      pageViews: 4,
      visits: 2,
    });
    expect(summary.days.find((d) => d.day === "2026-11-06")).toEqual({
      day: "2026-11-06",
      pageViews: 6,
      visits: 4,
    });
  });

  it("fills every day of the period, a day with no rows as zero", () => {
    const summary = summarizeVisits([hourRow("2026-11-03T08:00:00Z", 2, 1)], week);
    expect(summary.days.map((d) => d.day)).toEqual([
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ]);
    expect(summary.days[0]).toEqual({ day: "2026-11-01", pageViews: 0, visits: 0 });
  });

  it("totals page views and visits over the period only", () => {
    const summary = summarizeVisits(
      [
        hourRow("2026-11-02T08:00:00Z", 10, 4),
        hourRow("2026-11-07T08:00:00Z", 5, 2),
        // After the period's last shop day: not counted.
        hourRow("2026-11-07T23:00:00Z", 100, 100),
        hourRow("not a time", 100, 100),
      ],
      week,
    );
    expect(summary.pageViews).toBe(15);
    expect(summary.visits).toBe(6);
  });

  it("gives all zeros with no rows", () => {
    expect(summarizeVisits([], { from: "2026-11-07", to: "2026-11-07" })).toEqual({
      pageViews: 0,
      visits: 0,
      days: [{ day: "2026-11-07", pageViews: 0, visits: 0 }],
    });
  });
});

// covers: AC-3 (spec 0027): the product path rule.
describe("productSlugFromPath", () => {
  it.each([
    ["/p/lamp-ch-1020", "lamp-ch-1020"],
    ["/p/lamp-ch-1020/", "lamp-ch-1020"],
    [`/p/${encodeURIComponent("ثريا-كريستال-ch-1020")}`, "ثريا-كريستال-ch-1020"],
    // A decomposed letter (NFD) and the composed one (NFC) read as the same slug.
    ["/p/café", "café"],
  ])("reads %s as %s", (path, slug) => {
    expect(productSlugFromPath(path)).toBe(slug);
  });

  it.each(["/p/", "/p", "/p/a/b", "/c/lamps", "/p/a//", "/products/a"])("drops %s", (path) => {
    expect(productSlugFromPath(path)).toBeNull();
  });

  it("keeps a slug with a broken escape as it is, like the product page", () => {
    expect(productSlugFromPath("/p/lamp%E0")).toBe("lamp%E0");
  });
});

describe("viewsBySlug and topProducts", () => {
  const listed = [
    { id: "1", slug: "lamp-a", name: "مصباح أ" },
    { id: "2", slug: "lamp-b", name: "مصباح ب" },
    { id: "3", slug: "ثريا", name: "ثريا" },
  ];

  it("adds paths that normalize to the same slug together", () => {
    const views = viewsBySlug([
      pathRow("/p/lamp-a", 3),
      pathRow("/p/lamp-a/", 2),
      pathRow(`/p/${encodeURIComponent("ثريا")}`, 4),
      pathRow("/p/ثريا", 1),
      pathRow("/p/lamp-a/reviews", 50),
    ]);
    expect(views.get("lamp-a")).toBe(5);
    expect(views.get("ثريا")).toBe(5);
    expect(views.size).toBe(2);
  });

  it("drops a slug with no listed product and lets the next one move up, ties by name", () => {
    const views = new Map([
      ["gone-product", 100],
      ["lamp-b", 7],
      ["lamp-a", 7],
      ["ثريا", 9],
    ]);
    expect(topProducts(views, listed).map((p) => [p.id, p.pageViews])).toEqual([
      ["3", 9],
      ["1", 7],
      ["2", 7],
    ]);
  });

  it("shows at most 10", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `${i}`,
      slug: `s${i}`,
      name: `n${i}`,
    }));
    const views = new Map(many.map((p, i) => [p.slug, i + 1]));
    expect(topProducts(views, many)).toHaveLength(10);
    expect(topProducts(views, many)[0]?.id).toBe("11");
  });

  it("is empty with no matches", () => {
    expect(topProducts(new Map([["x", 1]]), listed)).toEqual([]);
  });
});

// covers: AC-4 (spec 0027): the referrer labels.
describe("referrerLabel", () => {
  const site = "skf.example";

  it.each([
    "google.com",
    "www.google.com",
    "google.ps",
    "google.co.il",
    "www.google.co.il",
    "google.com.eg",
    "news.google.com",
    "GOOGLE.COM",
  ])("labels %s as Google", (host) => {
    expect(referrerLabel(host, site)).toBe("google");
  });

  it.each(["google.com.evil.example", "notgoogle.com", "google.evil.example"])(
    "does not label %s as Google",
    (host) => {
      expect(referrerLabel(host, site)).not.toBe("google");
    },
  );

  it.each([
    ["facebook.com", "facebook"],
    ["m.facebook.com", "facebook"],
    ["l.facebook.com", "facebook"],
    ["fb.com", "facebook"],
    ["fb.me", "facebook"],
    ["instagram.com", "instagram"],
    ["l.instagram.com", "instagram"],
    ["whatsapp.com", "whatsapp"],
    ["web.whatsapp.com", "whatsapp"],
    ["wa.me", "whatsapp"],
  ])("labels %s as %s", (host, label) => {
    expect(referrerLabel(host, site)).toBe(label);
  });

  it.each(["", null, undefined, "skf.example", "www.skf.example", "SKF.example"])(
    "counts %j as direct",
    (host) => {
      expect(referrerLabel(host, site)).toBe("direct");
    },
  );

  it("shows any other host as its bare name", () => {
    expect(referrerLabel("www.Bing.com", site)).toEqual({ host: "bing.com" });
    expect(referrerLabel("notfacebook.com", site)).toEqual({ host: "notfacebook.com" });
  });
});

describe("topSources", () => {
  it("adds hosts with the same label together and orders by visits", () => {
    const sources = topSources(
      [
        hostRow("m.facebook.com", 3),
        hostRow("l.facebook.com", 4),
        hostRow("", 5),
        hostRow(null, 1),
        hostRow("skf.example", 2),
        hostRow("bing.com", 1),
      ],
      "skf.example",
    );
    expect(sources).toEqual([
      { label: "direct", visits: 8 },
      { label: "facebook", visits: 7 },
      { label: { host: "bing.com" }, visits: 1 },
    ]);
  });

  it("shows at most 10, and leaves out sources with no visits", () => {
    const rows = Array.from({ length: 12 }, (_, i) => hostRow(`site${i}.example`, i));
    const sources = topSources(rows, "skf.example");
    expect(sources).toHaveLength(10);
    expect(sources.every((s) => s.visits > 0)).toBe(true);
  });
});
