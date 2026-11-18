import { describe, expect, it } from "vitest";
import {
  bannerHref,
  buildHomeCircles,
  builtCircleLines,
  changesSide,
  circleSteps,
  circleSubline,
  COVERFLOW_SWIPE,
  coverflowPlacement,
  HOME_LIMITS,
  featuredBadge,
  heroChoice,
  isStale,
  isTargetLive,
  joinSubNames,
  planHomepageSave,
  planNewBanner,
  shopNowTarget,
  stepForKey,
  swipeStep,
  targetLabel,
  type BannerTarget,
  type HomeCategoryRow,
} from "./home-rules";

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

// covers: AC-4 (spec 0011)
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

describe("buildHomeCircles", () => {
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
    expect(buildHomeCircles(rows, withOff).map((circle) => circle.slug)).toEqual([
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
    expect(buildHomeCircles(rows, listed)).toEqual([
      { slug: "lamps", name: "قسم lamps", imageKey: "categories/a.webp", line: "مودرن وكريستال" },
      { slug: "walls", name: "قسم walls", imageKey: null, line: "داخلية و خارجية" },
    ]);
  });

  it("gives no line to a main without menu subs or its own line", () => {
    expect(buildHomeCircles([row("lamps")], listed)[0].line).toBeNull();
  });

  it("builds the dialog hint from the same menu subs", () => {
    const rows = [row("walls"), row("wall-in", { parentId: "walls", name: "داخلية" })];
    expect(builtCircleLines(rows, listed).get("walls")).toBe("داخلية");
  });
});

describe("circleSubline", () => {
  it("lists the first six circle names", () => {
    const circles = Array.from({ length: 8 }, (_, i) => ({
      slug: `c${i}`,
      name: `ق${i}`,
      imageKey: null,
      line: null,
    }));
    expect(circleSubline(circles)).toBe("ق0، ق1، ق2، ق3، ق4، ق5");
  });
});

describe("the circle carousel", () => {
  const sides = (centre: number, count: number) =>
    Array.from({ length: count }, (_, index) => circleSteps(index, centre, count));

  it("starts at two circles; one shows alone", () => {
    expect(HOME_LIMITS.carouselFrom).toBe(2);
  });

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
  it("goes to the circles, else nowhere (spec 0030 AC-3)", () => {
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
