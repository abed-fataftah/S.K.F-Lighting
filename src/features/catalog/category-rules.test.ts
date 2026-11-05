import { describe, expect, it } from "vitest";
import {
  buildNavigation,
  categoryNameKey,
  categorySlugBase,
  compareCategories,
  inCategoryOrder,
  isCategoryShown,
  planMove,
  type NavCategory,
} from "./category-rules";

// covers: AC-2, AC-4, AC-6, AC-14 (spec 0008)

const row = (id: string, sort: number, name = id) => ({ id, name, sort });

describe("categorySlugBase", () => {
  it("slugifies the name", () => {
    expect(categorySlugBase("ثريات ونجف")).toBe("ثريات-ونجف");
    expect(categorySlugBase("LED Spots")).toBe("led-spots");
  });

  it("falls back to qism when nothing is left", () => {
    expect(categorySlugBase("!!! ---")).toBe("qism");
    expect(categorySlugBase("")).toBe("qism");
  });
});

describe("categoryNameKey", () => {
  it("compares names ignoring case and outer spaces", () => {
    expect(categoryNameKey(" LED ")).toBe(categoryNameKey("led"));
    expect(categoryNameKey("ثريات")).not.toBe(categoryNameKey("ثريا"));
  });
});

describe("category order", () => {
  it("orders by sort, then name, then id", () => {
    const ordered = inCategoryOrder([
      row("c", 1, "ب"),
      row("b", 0, "ب"),
      row("a", 0, "ب"),
      row("d", 0, "أ"),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["d", "a", "b", "c"]);
  });

  it("is a total order", () => {
    expect(compareCategories(row("a", 0), row("a", 0))).toBe(0);
    expect(compareCategories(row("a", 0), row("b", 0))).toBeLessThan(0);
  });
});

describe("isCategoryShown", () => {
  it.each([
    [{ isVisible: true }, null, true],
    [{ isVisible: false }, null, false],
    [{ isVisible: true }, { isVisible: true }, true],
    [{ isVisible: true }, { isVisible: false }, false],
    [{ isVisible: false }, { isVisible: true }, false],
  ])("%j under %j is %s", (category, parent, shown) => {
    expect(isCategoryShown(category, parent)).toBe(shown);
  });
});

describe("planMove", () => {
  const siblings = [row("a", 0), row("b", 1), row("c", 2)];

  it("swaps a category with the one above", () => {
    expect(planMove(siblings, "b", "up")).toEqual({
      kind: "move",
      sorts: [
        { id: "b", sort: 0 },
        { id: "a", sort: 1 },
      ],
    });
  });

  it("swaps a category with the one below", () => {
    expect(planMove(siblings, "b", "down")).toEqual({
      kind: "move",
      sorts: [
        { id: "c", sort: 1 },
        { id: "b", sort: 2 },
      ],
    });
  });

  it("moves one step even when the import left equal sorts", () => {
    const imported = [row("x", 0, "ب"), row("y", 0, "أ")];
    // Order is y, x (by name); x up swaps them and renumbers both.
    const plan = planMove(imported, "x", "up");
    expect(plan).toEqual({
      kind: "move",
      sorts: [{ id: "y", sort: 1 }],
    });
    // Applying the plan leaves x first, and no two siblings share a sort.
    const applied = imported.map((r) =>
      plan.kind === "move"
        ? { ...r, sort: plan.sorts.find((s) => s.id === r.id)?.sort ?? r.sort }
        : r,
    );
    expect(inCategoryOrder(applied).map((r) => r.id)).toEqual(["x", "y"]);
    expect(new Set(applied.map((r) => r.sort)).size).toBe(2);
  });

  it("renumbers gaps and only writes the rows that change", () => {
    const gappy = [row("a", 5), row("b", 9), row("c", 20)];
    const plan = planMove(gappy, "c", "up");
    expect(plan).toEqual({
      kind: "move",
      sorts: [
        { id: "a", sort: 0 },
        { id: "c", sort: 1 },
        { id: "b", sort: 2 },
      ],
    });
  });

  it("refuses at the edges and for an unknown id", () => {
    expect(planMove(siblings, "a", "up")).toEqual({ kind: "at_edge" });
    expect(planMove(siblings, "c", "down")).toEqual({ kind: "at_edge" });
    expect(planMove(siblings, "z", "up")).toEqual({ kind: "not_found" });
  });
});

describe("buildNavigation", () => {
  const cat = (over: Partial<NavCategory> & { id: string }): NavCategory => ({
    name: over.id,
    slug: over.id,
    sort: 0,
    parentId: null,
    isVisible: true,
    ...over,
  });

  const rows = [
    cat({ id: "lamps", sort: 1 }),
    cat({ id: "chandeliers", sort: 0 }),
    cat({ id: "crystal", parentId: "chandeliers", sort: 0 }),
    cat({ id: "modern", parentId: "chandeliers", sort: 1 }),
    cat({ id: "classic", parentId: "chandeliers", sort: 2, isVisible: false }),
    cat({ id: "hidden-main", isVisible: false, sort: 2 }),
    cat({ id: "under-hidden", parentId: "hidden-main" }),
    cat({ id: "empty-main", sort: 3 }),
  ];

  it("keeps shown categories with listed products, in category order", () => {
    const listed = new Map([
      ["chandeliers", 1],
      ["crystal", 2],
      ["classic", 5],
      ["lamps", 3],
      ["under-hidden", 4],
    ]);
    expect(buildNavigation(rows, listed)).toEqual([
      {
        slug: "chandeliers",
        name: "chandeliers",
        productCount: 3,
        subs: [{ slug: "crystal", name: "crystal", productCount: 2 }],
      },
      { slug: "lamps", name: "lamps", productCount: 3, subs: [] },
    ]);
  });

  it("keeps a main whose products are all in its shown subs", () => {
    const nav = buildNavigation(rows, new Map([["modern", 1]]));
    expect(nav.map((main) => [main.slug, main.productCount])).toEqual([["chandeliers", 1]]);
  });

  it("is empty when nothing is listed", () => {
    expect(buildNavigation(rows, new Map())).toEqual([]);
  });
});
