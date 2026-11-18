import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The database is the boundary: each read is replaced and each test decides how it answers.
vi.mock("server-only", () => ({}));
// A query builder that accepts any chain of calls; `readCards` (mocked) decides the cards.
const chain: unknown = new Proxy(() => chain, {
  get: (_, key) => (key === "then" ? undefined : () => chain),
});
vi.mock("@/server/db", () => ({ getDb: async () => chain }));
const readBannerRows = vi.fn();
const loadCatalogTree = vi.fn();
const readCards = vi.fn();
const readHomeProducts = vi.fn();
vi.mock("./banner-rows", () => ({ readBannerRows }));
const readCategoryHead = vi.fn();
vi.mock("@/features/catalog/server/queries", () => ({
  cardColumns: {},
  loadCatalogTree,
  readCards,
  readCategoryHead,
  readHomeProducts,
}));

const { getHomeSections } = await import("./home");

const hang = () => new Promise(() => {});

// covers: AC-7 (spec 0011)
describe("getHomeSections", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    readBannerRows.mockResolvedValue([]);
    loadCatalogTree.mockResolvedValue({ categories: [], listed: new Map() });
    readHomeProducts.mockResolvedValue([]);
    readCards.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("gives up on a part after 3 seconds and keeps the others", async () => {
    vi.useFakeTimers();
    readBannerRows.mockReturnValue(hang());
    let settled = false;
    const pending = getHomeSections().then((sections) => {
      settled = true;
      return sections;
    });

    await vi.advanceTimersByTimeAsync(2999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    expect(await pending).toEqual({
      banners: null,
      circles: [],
      categoryProducts: null,
      featured: [],
    });
    expect(console.error).toHaveBeenCalledWith(
      JSON.stringify({ event: "home_read_failed", part: "banners", error: "timeout" }),
    );
  });

  it("logs the part and the error's name, never the values", async () => {
    loadCatalogTree.mockRejectedValue(new TypeError("bad row ثريات 0599 123 456"));

    const sections = await getHomeSections();

    expect(sections.circles).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      JSON.stringify({ event: "home_read_failed", part: "circles", error: "TypeError" }),
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("0599");
  });

  it("falls back to the newest products when no pick is left", async () => {
    const newest = [{ slug: "lamp-1" }];
    readCards.mockResolvedValue([]);
    readHomeProducts.mockResolvedValue(newest);

    expect((await getHomeSections()).featured).toBe(newest);
  });

  // covers: AC-6 (spec 0031)
  describe("the first category's products", () => {
    const main = {
      id: "lamps",
      slug: "lamps",
      name: "أباجورات",
      description: null,
      sort: 0,
      parentId: null,
      isVisible: true,
      showOnHome: true,
      homeSubtitle: null,
      imageKey: null,
    };

    beforeEach(() => {
      loadCatalogTree.mockResolvedValue({ categories: [main], listed: new Map([["lamps", 1]]) });
      readCategoryHead.mockReturnValue({ categoryIds: ["lamps"] });
    });

    it("reads the first card's eight after the cards", async () => {
      const eight = [{ slug: "lamp-1" }];
      readCards.mockResolvedValue(eight);

      const sections = await getHomeSections();

      expect(sections.circles?.map((category) => category.slug)).toEqual(["lamps"]);
      expect(sections.categoryProducts).toBe(eight);
      expect(readCategoryHead).toHaveBeenCalledWith(expect.anything(), "lamps", null, 1);
    });

    it("is null with no card, and null and logged when its read fails", async () => {
      loadCatalogTree.mockResolvedValue({ categories: [], listed: new Map() });
      expect((await getHomeSections()).categoryProducts).toBeNull();

      loadCatalogTree.mockResolvedValue({ categories: [main], listed: new Map([["lamps", 1]]) });
      readCards.mockRejectedValue(new TypeError("bad row lamps"));
      const sections = await getHomeSections();

      expect(sections.circles).toHaveLength(1);
      expect(sections.categoryProducts).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        JSON.stringify({ event: "home_read_failed", part: "categoryProducts", error: "TypeError" }),
      );
    });
  });

  it("shows the picks when there are any", async () => {
    const picks = [{ slug: "picked" }];
    readCards.mockResolvedValue(picks);

    expect((await getHomeSections()).featured).toBe(picks);
    expect(readHomeProducts).not.toHaveBeenCalled();
  });
});
