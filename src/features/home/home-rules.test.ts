import { describe, expect, it } from "vitest";
import {
  bannerHref,
  buildHomeCategories,
  builtCircleLines,
  categoryCacheReducer,
  categoryPanelState,
  categoryTurn,
  changesSide,
  circleSteps,
  COVERFLOW_SWIPE,
  coverflowPlacement,
  firstCategory,
  HOME_LIMITS,
  featuredBadge,
  heroChoice,
  indexForKey,
  isStale,
  isTargetLive,
  joinSubNames,
  needsFetch,
  planHomepageSave,
  planNewBanner,
  seedCategoryCache,
  shopNowTarget,
  stepForKey,
  swipeStep,
  targetLabel,
  type BannerTarget,
  type CategoryCache,
  type CategoryCacheAction,
  type HomeCategoryRow,
} from "./home-rules";
import type { CardProduct } from "@/features/catalog/card-view";

const row = (
  id: string,
  fields: Partial<HomeCategoryRow> & { readonly parentId?: string | null } = {},
): HomeCategoryRow => ({
  id,
  slug: id,
  name: fields.name ?? `قسم ${id}`,
  sort: 0,
  parentId: null,
  isVisible: true,
  showOnHome: true,
  homeSubtitle: null,
  imageKey: null,
  ...fields,
});

// covers: AC-4 (spec 0011), AC-2 (spec 0031)
describe("joinSubNames", () => {
  it.each([
    [[], null],
    [["أ"], "أ"],
    [["أ", "ب"], "أ و ب"],
    [["أ", "ب", "ج"], "أ، ب و ج"],
    [["أ", "ب", "ج", "د"], "أ، ب و ج"],
  ] as const)("joins %j as %j", (names, line) => {
    expect(joinSubNames(names)).toBe(line);
  });
});

describe("buildHomeCategories", () => {
  const listed = new Map([
    ["lamps", 1],
    ["walls", 2],
    ["wall-in", 1],
    ["wall-out", 1],
    ["empty-sub", 0],
    ["hidden-sub", 3],
  ]);

  it("lists the mains the menu lists, ticked for Home, in category order", () => {
    const rows = [
      row("walls", { sort: 1 }),
      row("lamps", { sort: 0 }),
      row("off", { sort: 2, showOnHome: false }),
      row("empty", { sort: 3 }),
      row("hidden", { sort: 4, isVisible: false }),
    ];
    const withOff = new Map([...listed, ["off", 4], ["hidden", 4]]);
    expect(buildHomeCategories(rows, withOff).map((circle) => circle.slug)).toEqual([
      "lamps",
      "walls",
    ]);
  });

  it("uses the owner's line, else the names of the first three menu subs", () => {
    const rows = [
      row("lamps", { homeSubtitle: "مودرن وكريستال", imageKey: "categories/a.webp" }),
      row("walls", { sort: 1 }),
      row("wall-in", { parentId: "walls", name: "داخلية", sort: 0 }),
      row("wall-out", { parentId: "walls", name: "خارجية", sort: 1 }),
      row("empty-sub", { parentId: "walls", name: "فارغ", sort: 2 }),
      row("hidden-sub", { parentId: "walls", name: "مخفي", sort: 3, isVisible: false }),
    ];
    expect(buildHomeCategories(rows, listed)).toEqual([
      { slug: "lamps", name: "قسم lamps", imageKey: "categories/a.webp", line: "مودرن وكريستال" },
      { slug: "walls", name: "قسم walls", imageKey: null, line: "داخلية و خارجية" },
    ]);
  });

  it("gives no line to a main without menu subs or its own line", () => {
    expect(buildHomeCategories([row("lamps")], listed)[0].line).toBeNull();
  });

  it("builds the dialog hint from the same menu subs", () => {
    const rows = [row("walls"), row("wall-in", { parentId: "walls", name: "داخلية" })];
    expect(builtCircleLines(rows, listed).get("walls")).toBe("داخلية");
  });
});

// covers: AC-2, AC-3, AC-5, AC-7, AC-8, AC-11 (spec 0031)
describe("the category cards", () => {
  const category = (slug: string) => ({ slug, name: slug, imageKey: null, line: null });
  const turns = (selected: number, count: number, perRow: number, dir: 1 | -1) =>
    Array.from({ length: count }, (_, index) => categoryTurn(index, selected, perRow, dir));

  it("selects the first category in the owner's order, none with no card", () => {
    expect(firstCategory([category("a"), category("b")])?.slug).toBe("a");
    expect(firstCategory([])).toBeNull();
  });

  it("keeps the selected card flat and turns the others in its row to face it", () => {
    // Left to right: the cards before sit on the physical left (positive), after on the right.
    expect(turns(2, 5, 5, 1)).toEqual([1, 1, 0, -1, -1]);
    // Right to left: the cards before sit on the physical right.
    expect(turns(2, 5, 5, -1)).toEqual([-1, -1, 0, 1, 1]);
    expect(turns(0, 3, 3, 1)).toEqual([0, -1, -1]);
    expect(turns(2, 3, 3, -1)).toEqual([-1, -1, 0]);
  });

  it("turns only the selected card's own visual row; the other rows rest flat", () => {
    expect(turns(1, 7, 3, 1)).toEqual([1, 0, -1, 0, 0, 0, 0]);
    expect(turns(4, 7, 3, 1)).toEqual([0, 0, 0, 1, 0, -1, 0]);
    expect(turns(6, 7, 3, 1)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    // A bad count never divides by zero.
    expect(turns(0, 2, 0, 1)).toEqual([0, 0]);
  });

  it("maps the keys to the physical side, with Home, End, and wrapping", () => {
    expect(indexForKey("ArrowRight", 1, 4, 1)).toBe(2);
    expect(indexForKey("ArrowLeft", 1, 4, 1)).toBe(0);
    // Right to left: the physical right is the inline start.
    expect(indexForKey("ArrowRight", 1, 4, -1)).toBe(0);
    expect(indexForKey("ArrowLeft", 1, 4, -1)).toBe(2);
    expect(indexForKey("ArrowLeft", 3, 4, -1)).toBe(0);
    expect(indexForKey("ArrowRight", 0, 4, -1)).toBe(3);
    expect(indexForKey("Home", 2, 4, 1)).toBe(0);
    expect(indexForKey("End", 0, 4, -1)).toBe(3);
    expect(indexForKey("Enter", 0, 4, 1)).toBeNull();
    expect(indexForKey("ArrowRight", 0, 0, 1)).toBeNull();
  });

  it("shows eight products a category", () => {
    expect(HOME_LIMITS.categoryProducts).toBe(8);
  });
});

describe("the category grid's cache", () => {
  const product = (slug: string) => ({ slug }) as unknown as CardProduct;
  const first = { slug: "a", name: "a", imageKey: null, line: null };
  const run = (cache: CategoryCache, ...actions: CategoryCacheAction[]) =>
    actions.reduce(categoryCacheReducer, cache);

  it("seeds the first category ready with the page's eight, or failed when that read failed", () => {
    expect(seedCategoryCache(first, [product("p")]).get("a")).toEqual({
      kind: "ready",
      products: [product("p")],
    });
    expect(seedCategoryCache(first, null).get("a")).toEqual({ kind: "failed" });
    expect(seedCategoryCache(null, null).size).toBe(0);
  });

  it("fetches an unknown or failed category, never a loading or cached one", () => {
    expect(needsFetch(undefined)).toBe(true);
    expect(needsFetch({ kind: "failed" })).toBe(true);
    expect(needsFetch({ kind: "loading" })).toBe(false);
    expect(needsFetch({ kind: "ready", products: [] })).toBe(false);
  });

  it("goes loading, then ready; a ready entry never changes", () => {
    const ready = run(
      new Map(),
      { type: "start", slug: "b" },
      { type: "done", slug: "b", products: [product("p")] },
    );
    expect(ready.get("b")).toEqual({ kind: "ready", products: [product("p")] });
    expect(run(ready, { type: "start", slug: "b" })).toBe(ready);
    expect(run(ready, { type: "fail", slug: "b" })).toBe(ready);
    expect(run(ready, { type: "done", slug: "b", products: [] })).toBe(ready);
  });

  it("goes failed, then loading again on retry", () => {
    const failed = run(new Map(), { type: "start", slug: "b" }, { type: "fail", slug: "b" });
    expect(failed.get("b")).toEqual({ kind: "failed" });
    expect(run(failed, { type: "start", slug: "b" }).get("b")).toEqual({ kind: "loading" });
  });

  it("stores a late answer for another category without touching the selected one's panel", () => {
    const seeded = seedCategoryCache(first, [product("p")]);
    const after = run(
      seeded,
      { type: "start", slug: "b" },
      { type: "done", slug: "b", products: [product("q")] },
    );
    expect(categoryPanelState(after.get("a"))).toBe("grid");
    expect(after.get("a")).toBe(seeded.get("a"));
    expect(after.get("b")).toEqual({ kind: "ready", products: [product("q")] });
  });

  it("shows the grid, the skeleton, the notice, or the empty line", () => {
    expect(categoryPanelState({ kind: "ready", products: [product("p")] })).toBe("grid");
    expect(categoryPanelState({ kind: "ready", products: [] })).toBe("empty");
    expect(categoryPanelState({ kind: "loading" })).toBe("skeleton");
    expect(categoryPanelState(undefined)).toBe("skeleton");
    expect(categoryPanelState({ kind: "failed" })).toBe("notice");
  });
});

describe("the coverflow's steps", () => {
  const sides = (centre: number, count: number) =>
    Array.from({ length: count }, (_, index) => circleSteps(index, centre, count));

  it("keeps the other of two circles on the end side, so each step swaps them", () => {
    expect(sides(0, 2)).toEqual([0, 1]);
    expect(sides(1, 2)).toEqual([1, 0]);
  });

  it("puts one of three circles on each side", () => {
    expect(sides(0, 3)).toEqual([0, 1, -1]);
    expect(sides(1, 3)).toEqual([-1, 0, 1]);
    expect(sides(2, 3)).toEqual([1, -1, 0]);
  });

  it("wraps the far half of a longer list to the start side", () => {
    expect(sides(0, 4)).toEqual([0, 1, 2, -1]);
    expect(sides(0, 5)).toEqual([0, 1, 2, -2, -1]);
  });

  it("fades only a circle that crosses the centre", () => {
    // Three circles, next: the start side one wraps to the end side.
    expect(changesSide(circleSteps(2, 0, 3), circleSteps(2, 1, 3))).toBe(true);
    expect(changesSide(circleSteps(1, 0, 3), circleSteps(1, 1, 3))).toBe(false);
    // Two circles swap through the centre, never across it.
    expect(changesSide(circleSteps(0, 0, 2), circleSteps(0, 1, 2))).toBe(false);
    expect(changesSide(circleSteps(1, 0, 2), circleSteps(1, 1, 2))).toBe(false);
  });
});

describe("shopNowTarget", () => {
  it("goes to the category cards, else nowhere (spec 0030 AC-3)", () => {
    expect(shopNowTarget(3)).toBe("categories");
    expect(shopNowTarget(0)).toBeNull();
  });
});

// covers: AC-2, AC-4, AC-6, AC-7, AC-9, AC-11 (spec 0030)
describe("the hero coverflow", () => {
  const sides = (centre: number, count: number) =>
    Array.from({ length: count }, (_, index) => circleSteps(index, centre, count));

  it("shows the coverflow with one or more products, else the fallback card", () => {
    expect(heroChoice([{}])).toBe("coverflow");
    expect(heroChoice([])).toBe("card");
    expect(heroChoice(null)).toBe("card");
  });

  it("places 1, 2, 3, and 8 products by their signed steps from the centre", () => {
    expect(sides(0, 1)).toEqual([0]);
    // Two: the other one waits on the inline end side and each step swaps them.
    expect(sides(0, 2)).toEqual([0, 1]);
    expect(sides(1, 2)).toEqual([1, 0]);
    expect(sides(1, 3)).toEqual([-1, 0, 1]);
    expect(sides(0, 8)).toEqual([0, 1, 2, 3, 4, -3, -2, -1]);
    expect(sides(5, 8)).toEqual([3, 4, -3, -2, -1, 0, 1, 2]);
  });

  it("gives the centre card full size, facing, top of the stack", () => {
    expect(coverflowPlacement(0, 1, -1)).toEqual({
      x: 0,
      angle: 0,
      scale: 1,
      opacity: 1,
      tint: 0,
      z: 10,
      hidden: false,
    });
  });

  it("turns a neighbour toward the centre, smaller and tinted, below lg", () => {
    // One step toward the inline end, the physical right in left to right: moved right, its
    // inner (left) edge back, so a negative rotateY.
    expect(coverflowPlacement(1, 1, 1)).toEqual({
      x: 0.78,
      angle: -35,
      scale: 0.74,
      opacity: 0.75,
      tint: 0.3,
      z: 9,
      hidden: false,
    });
    // The same step in right to left sits on the physical left and turns the other way.
    expect(coverflowPlacement(1, 1, -1)).toMatchObject({ x: -0.78, angle: 35 });
    expect(coverflowPlacement(-1, 1, -1)).toMatchObject({ x: 0.78, angle: -35 });
  });

  it("hides the second card out below lg at the next out place, and the third from lg", () => {
    expect(coverflowPlacement(2, 1, 1)).toEqual({
      x: 1.4,
      angle: -45,
      scale: 0.56,
      opacity: 0,
      tint: 0.5,
      z: 8,
      hidden: true,
    });
    expect(coverflowPlacement(2, 2, 1)).toMatchObject({
      x: 1.4,
      angle: -45,
      scale: 0.56,
      opacity: 0.5,
      z: 8,
      hidden: false,
    });
    expect(coverflowPlacement(3, 2, 1)).toMatchObject({
      x: 1.9,
      scale: 0.42,
      angle: -50,
      opacity: 0,
      z: 7,
      hidden: true,
    });
    // Anything further sits at the same place, hidden.
    expect(coverflowPlacement(-4, 2, 1)).toEqual(coverflowPlacement(-3, 2, 1));
    expect(coverflowPlacement(-4, 1, 1)).toEqual(coverflowPlacement(-2, 1, 1));
  });

  it("fades only a card that crosses to the other side", () => {
    // Eight products, next: the furthest start side one (-3) wraps to the end side (4).
    expect(changesSide(circleSteps(5, 0, 8), circleSteps(5, 1, 8))).toBe(true);
    expect(changesSide(circleSteps(1, 0, 8), circleSteps(1, 1, 8))).toBe(false);
    // The tie card (4) only comes one step nearer: no crossing.
    expect(changesSide(circleSteps(4, 0, 8), circleSteps(4, 1, 8))).toBe(false);
    // Three products, back: the end side one crosses to the start side.
    expect(changesSide(circleSteps(1, 0, 3), circleSteps(1, 2, 3))).toBe(true);
    // Two products swap through the centre, never across it.
    expect(changesSide(circleSteps(1, 0, 2), circleSteps(1, 1, 2))).toBe(false);
  });

  it("maps the arrow keys to the physical side, in both directions", () => {
    const press = (key: string, mod: Partial<Parameters<typeof stepForKey>[0]> = {}) => ({
      key,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      ...mod,
    });
    // Right to left: the physical left card is the inline end, one step on.
    expect(stepForKey(press("ArrowLeft"), -1)).toBe(1);
    expect(stepForKey(press("ArrowRight"), -1)).toBe(-1);
    expect(stepForKey(press("ArrowLeft"), 1)).toBe(-1);
    expect(stepForKey(press("ArrowRight"), 1)).toBe(1);
    expect(stepForKey(press("ArrowUp"), -1)).toBeNull();
    expect(stepForKey(press("Enter"), -1)).toBeNull();
    expect(stepForKey(press("ArrowLeft", { shiftKey: true }), -1)).toBeNull();
    expect(stepForKey(press("ArrowRight", { ctrlKey: true }), -1)).toBeNull();
  });

  it("steps on a sideways move of 40px or more, the cards following the finger", () => {
    expect(COVERFLOW_SWIPE).toEqual({ step: 40, tap: 10 });
    // Right to left: a move to the right brings the physical left (inline end) card in.
    expect(swipeStep(40, 0, -1)).toBe(1);
    expect(swipeStep(-40, 10, -1)).toBe(-1);
    expect(swipeStep(60, 0, 1)).toBe(-1);
    expect(swipeStep(-60, 0, 1)).toBe(1);
    expect(swipeStep(39, 0, -1)).toBe(0);
    // More up and down than sideways is the page scrolling, not a swipe.
    expect(swipeStep(50, 60, -1)).toBe(0);
    expect(swipeStep(50, 50, -1)).toBe(0);
  });
});

// covers: AC-10 (spec 0011)
describe("banner links", () => {
  const main = { slug: "lamps", name: "ثريات", isVisible: true };
  const category = (fields: Partial<Extract<BannerTarget, { kind: "category" }>> = {}) =>
    ({
      kind: "category",
      id: "c1",
      slug: "crystal",
      name: "كريستال",
      isVisible: true,
      parent: main,
      ...fields,
    }) as const;
  const product = (listed: boolean) =>
    ({ kind: "product", id: "p1", slug: "lamp-1", name: "ثريا", listed }) as const;

  it("is live for a shown category or a listed product only", () => {
    expect(isTargetLive(category())).toBe(true);
    expect(isTargetLive(category({ isVisible: false }))).toBe(false);
    expect(isTargetLive(category({ parent: { ...main, isVisible: false } }))).toBe(false);
    expect(isTargetLive(product(true))).toBe(true);
    expect(isTargetLive(product(false))).toBe(false);
  });

  it("links a live target and leaves the rest as plain pictures", () => {
    expect(bannerHref(category())).toBe("/c/lamps/crystal");
    expect(bannerHref(category({ parent: null, slug: "lamps" }))).toBe("/c/lamps");
    expect(bannerHref(product(true))).toBe("/p/lamp-1");
    expect(bannerHref(product(false))).toBeNull();
    expect(bannerHref(null)).toBeNull();
  });

  it("names a sub after its main in the editor", () => {
    expect(targetLabel(category())).toBe("ثريات › كريستال");
    expect(targetLabel(product(true))).toBe("ثريا");
  });
});

// covers: AC-8 (spec 0011)
describe("featuredBadge", () => {
  it.each([
    [{ status: "archived", categoryShown: true, inStock: true }, "archived"],
    [{ status: "hidden", categoryShown: false, inStock: false }, "hidden"],
    [{ status: "active", categoryShown: false, inStock: true }, "category_hidden"],
    [{ status: "active", categoryShown: true, inStock: false }, "out_of_stock"],
    [{ status: "active", categoryShown: true, inStock: true }, null],
  ] as const)("marks %j as %j", (product, badge) => {
    expect(featuredBadge(product)).toBe(badge);
  });
});

// covers: AC-9, AC-10 (spec 0011)
describe("saves", () => {
  it("is stale when the versions differ", () => {
    expect(isStale(4, 4)).toBe(false);
    expect(isStale(5, 4)).toBe(true);
  });

  it("puts a new banner last, active while fewer than five are, and refuses an eleventh", () => {
    expect(planNewBanner({ count: 0, activeCount: 0, maxSort: null })).toEqual({
      kind: "insert",
      sort: 0,
      isActive: true,
    });
    expect(planNewBanner({ count: 6, activeCount: 5, maxSort: 7 })).toEqual({
      kind: "insert",
      sort: 8,
      isActive: false,
    });
    expect(planNewBanner({ count: 10, activeCount: 2, maxSort: 9 })).toEqual({
      kind: "too_many_banners",
    });
  });

  const stored = {
    version: 3,
    bannerIds: ["b1", "b2"],
    productStatus: new Map([
      ["p1", "active"],
      ["p2", "hidden"],
      ["p3", "archived"],
    ] as const),
  };
  const input = {
    version: 3,
    banners: [
      { id: "b2", isActive: false },
      { id: "b1", isActive: true },
    ],
    featured: ["p2", "p1"],
    homeCategoryIds: ["m1"],
  };

  it("plans the page order and the featured sort from the page's lists", () => {
    expect(planHomepageSave(stored, input)).toEqual({
      kind: "save",
      banners: [
        { id: "b2", sort: 0, isActive: false },
        { id: "b1", sort: 1, isActive: true },
      ],
      featured: [
        { productId: "p2", sort: 0 },
        { productId: "p1", sort: 1 },
      ],
    });
  });

  it("is stale on another version or when the page holds other banners than are stored", () => {
    expect(planHomepageSave(stored, { ...input, version: 2 }).kind).toBe("stale");
    expect(
      planHomepageSave(stored, { ...input, banners: [{ id: "b1", isActive: true }] }).kind,
    ).toBe("stale");
    expect(
      planHomepageSave(stored, {
        ...input,
        banners: [...input.banners, { id: "b9", isActive: false }],
      }).kind,
    ).toBe("stale");
  });

  it("refuses a sixth active banner and a ninth pick", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, isActive: true }));
    expect(
      planHomepageSave({ ...stored, bannerIds: six.map((b) => b.id) }, { ...input, banners: six })
        .kind,
    ).toBe("too_many_active");
    const nine = Array.from({ length: 9 }, (_, i) => `p${i}`);
    const statuses = new Map(nine.map((id) => [id, "active" as const]));
    expect(
      planHomepageSave({ ...stored, productStatus: statuses }, { ...input, featured: nine }).kind,
    ).toBe("too_many_featured");
  });

  it("names archived and deleted picks, and allows a hidden one", () => {
    expect(planHomepageSave(stored, { ...input, featured: ["p2", "p3", "gone"] })).toEqual({
      kind: "product_unavailable",
      productIds: ["p3", "gone"],
    });
  });

  it("refuses repeated picks or mains as invalid", () => {
    expect(planHomepageSave(stored, { ...input, featured: ["p1", "p1"] }).kind).toBe("invalid");
    expect(planHomepageSave(stored, { ...input, homeCategoryIds: ["m1", "m1"] }).kind).toBe(
      "invalid",
    );
  });
});
