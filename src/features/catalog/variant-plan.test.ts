import { describe, expect, it } from "vitest";
import {
  archivedLabel,
  planVariants,
  type ExistingVariant,
  type WantedSize,
  type WantedVariants,
} from "./variant-plan";

// covers: AC-3, AC-4, AC-5, AC-6, AC-7 (spec 0006)

const RED = "c0000000-0000-4000-8000-000000000001";
const BLUE = "c0000000-0000-4000-8000-000000000002";
const NOW = new Date("2026-10-21T10:00:00Z");

const size = (label: string, price: number, originalLabel: string | null = label): WantedSize => ({
  originalLabel,
  label,
  price,
});

const row = (
  id: string,
  sizeLabel: string | null,
  colourId: string | null,
  extra: Partial<ExistingVariant> = {},
): ExistingVariant => ({
  id,
  sizeLabel,
  colourId,
  sizeSort: 0,
  sort: 0,
  archivedAt: null,
  ...extra,
});

/** Every size with every colour, all ticked unless listed in `off` as `size:colour`. */
function grid(
  sizes: readonly WantedSize[],
  colours: readonly string[],
  off: readonly string[] = [],
): WantedVariants {
  const sizeIdx = sizes.length ? sizes.map((_, i) => i) : [null];
  const colourIdx = colours.length ? colours.map((_, i) => i) : [null];
  const pairs = sizeIdx.flatMap((s) =>
    colourIdx.map((c) => ({
      size: s,
      colour: c,
      available: !off.includes(`${s ?? "-"}:${c ?? "-"}`),
    })),
  );
  return { sizes, colours, pairs: sizes.length || colours.length ? pairs : [], price: null };
}

const simple = (price: number): WantedVariants => ({ sizes: [], colours: [], pairs: [], price });
const none = new Set<string>();

describe("planVariants: a simple product", () => {
  it("creates the one plain default row, always available", () => {
    const plan = planVariants(simple(12_500), [], none);
    expect(plan.inserts).toEqual([
      {
        key: "-:-",
        sizeLabel: null,
        sizeSort: 0,
        colourId: null,
        sort: 0,
        price: 12_500,
        isAvailable: true,
      },
    ]);
    expect(plan.defaultKey).toBe("-:-");
    expect([...plan.updates, ...plan.restores, ...plan.deletes, ...plan.archives]).toEqual([]);
  });

  it("updates the price on its plain row", () => {
    const plan = planVariants(simple(9_900), [row("v1", null, null)], none);
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: "v1", price: 9_900, moved: false }),
    ]);
    expect(plan.inserts).toEqual([]);
  });
});

describe("planVariants: sizes", () => {
  it("adds a size next to the existing ones, each pair carrying its size's price", () => {
    const existing = [row("vS", "صغير", null), row("vL", "كبير", null, { sizeSort: 1 })];
    const plan = planVariants(
      grid([size("صغير", 100), size("كبير", 200), size("وسط", 150, null)], []),
      existing,
      none,
    );
    expect(plan.updates.map((u) => [u.id, u.sizeSort, u.price])).toEqual([
      ["vS", 0, 100],
      ["vL", 1, 200],
    ]);
    expect(plan.inserts).toEqual([
      expect.objectContaining({ sizeLabel: "وسط", sizeSort: 2, price: 150, colourId: null }),
    ]);
  });

  it("renames a size on the same rows, so an order line keeps its row", () => {
    const plan = planVariants(
      grid([size("كبير جدًا", 300, "كبير")], []),
      [row("vL", "كبير", null)],
      new Set(["vL"]),
    );
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: "vL", sizeLabel: "كبير جدًا", moved: true }),
    ]);
    expect([...plan.inserts, ...plan.deletes, ...plan.archives]).toEqual([]);
  });

  it("swaps two labels as two moved updates, for the two pass rename", () => {
    const existing = [row("vA", "A", null), row("vB", "B", null, { sizeSort: 1 })];
    const plan = planVariants(grid([size("B", 1, "A"), size("A", 2, "B")], []), existing, none);
    expect(plan.updates.map((u) => [u.id, u.sizeLabel, u.moved])).toEqual([
      ["vA", "B", true],
      ["vB", "A", true],
    ]);
    expect(plan.relabels).toEqual([]);
  });

  it("deletes a removed pair nothing points at, and archives one an order or draft points at", () => {
    const existing = [
      row("vS", "S", null),
      row("vM", "M", null, { sizeSort: 1 }),
      row("vL", "L", null, { sizeSort: 2 }),
    ];
    const plan = planVariants(grid([size("S", 1)], []), existing, new Set(["vL"]));
    expect(plan.deletes).toEqual(["vM"]);
    expect(plan.archives).toEqual(["vL"]);
  });

  it("restores the archived row when the same size and colour are added again", () => {
    const existing = [row("vS", "S", null), row("vL", "L", null, { archivedAt: NOW })];
    const plan = planVariants(grid([size("S", 1), size("L", 5, null)], []), existing, none);
    expect(plan.restores).toEqual([
      expect.objectContaining({ id: "vL", sizeLabel: "L", price: 5 }),
    ]);
    expect(plan.inserts).toEqual([]);
  });

  it("relabels an archived row whose label a renamed live row needs", () => {
    const existing = [row("vM", "M", null), row("vL", "L", null, { archivedAt: NOW })];
    const plan = planVariants(grid([size("L", 9, "M")], []), existing, none);
    expect(plan.updates).toEqual([expect.objectContaining({ id: "vM", sizeLabel: "L" })]);
    expect(plan.restores).toEqual([]);
    expect(plan.relabels).toEqual([{ id: "vL", sizeLabel: archivedLabel("vL") }]);
  });

  it("relabels a row archived now when a new size row takes its label", () => {
    const plan = planVariants(
      grid([size("L", 9, null)], []),
      [row("vL", "L", null)],
      new Set(["vL"]),
    );
    expect(plan.archives).toEqual(["vL"]);
    expect(plan.relabels).toEqual([{ id: "vL", sizeLabel: archivedLabel("vL") }]);
    expect(plan.inserts).toEqual([expect.objectContaining({ sizeLabel: "L" })]);
  });
});

describe("planVariants: colours and the grid", () => {
  it("makes every size and colour pair with the grid ticks", () => {
    const plan = planVariants(
      grid([size("S", 100, null), size("L", 200, null)], [RED, BLUE], ["1:0"]),
      [],
      none,
    );
    expect(
      plan.inserts.map((r) => [r.key, r.sizeLabel, r.colourId, r.price, r.isAvailable]),
    ).toEqual([
      ["0:0", "S", RED, 100, true],
      ["0:1", "S", BLUE, 100, true],
      ["1:0", "L", RED, 200, false],
      ["1:1", "L", BLUE, 200, true],
    ]);
    expect(plan.inserts.map((r) => [r.sizeSort, r.sort])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it("gives colours only one price for every pair", () => {
    const wanted = { ...grid([], [RED, BLUE], ["-:0"]), price: 4_000 };
    const plan = planVariants(wanted, [], none);
    expect(plan.inserts.map((r) => [r.colourId, r.price, r.isAvailable, r.sizeLabel])).toEqual([
      [RED, 4_000, false, null],
      [BLUE, 4_000, true, null],
    ]);
  });

  it("keeps a colour's rows when colours are reordered", () => {
    const existing = [row("vR", null, RED), row("vB", null, BLUE, { sort: 1 })];
    const plan = planVariants({ ...grid([], [BLUE, RED]), price: 10 }, existing, none);
    expect(plan.updates.map((u) => [u.id, u.sort, u.moved])).toEqual([
      ["vB", 0, false],
      ["vR", 1, false],
    ]);
  });
});

describe("planVariants: simple ⇄ options keeps the plain row's id", () => {
  it("turns the plain row into the first pair when options are added", () => {
    const plan = planVariants(
      grid([size("S", 100, null), size("L", 200, null)], [RED]),
      [row("plain", null, null)],
      none,
    );
    expect(plan.updates).toEqual([
      expect.objectContaining({ id: "plain", sizeLabel: "S", colourId: RED, moved: true }),
    ]);
    expect(plan.inserts.map((r) => r.key)).toEqual(["1:0"]);
    expect(plan.deletes).toEqual([]);
  });

  it("turns the first live pair back into the plain row when every option is removed", () => {
    const existing = [row("vL", "L", null, { sizeSort: 1 }), row("vS", "S", null)];
    const plan = planVariants(simple(500), existing, new Set(["vL"]));
    expect(plan.updates).toEqual([
      expect.objectContaining({
        id: "vS",
        sizeLabel: null,
        colourId: null,
        price: 500,
        moved: true,
      }),
    ]);
    expect(plan.archives).toEqual(["vL"]);
    expect(plan.inserts).toEqual([]);
  });
});

describe("planVariants: the default", () => {
  it("is the first available pair by size then colour order", () => {
    const plan = planVariants(
      grid([size("S", 1, null), size("L", 2, null)], [RED, BLUE], ["0:0", "0:1"]),
      [],
      none,
    );
    expect(plan.defaultKey).toBe("1:0");
  });

  it("falls back to the first pair when nothing is available", () => {
    const plan = planVariants(grid([size("S", 1, null)], [RED], ["0:0"]), [], none);
    expect(plan.defaultKey).toBe("0:0");
  });
});
