import { describe, expect, it } from "vitest";
import {
  colourAfterSize,
  draftTotals,
  lineProblems,
  lineUnavailable,
  productPrice,
  resolveOption,
  type DraftLineView,
  type DraftOption,
  type DraftProduct,
} from "./draft-view";

// covers: AC-6, AC-11, AC-13, AC-14 (spec 0020)

const option = (over: Partial<DraftOption> & { id: string }): DraftOption => ({
  code: null,
  sizeLabel: null,
  colourName: null,
  price: 10_000,
  sellable: true,
  archived: false,
  ...over,
});

const chandelier = [
  option({ id: "60g", sizeLabel: "60 سم", colourName: "ذهبي" }),
  option({ id: "60b", sizeLabel: "60 سم", colourName: "أسود" }),
  option({ id: "40g", sizeLabel: "40 سم", colourName: "ذهبي", price: 8_000 }),
];

const product = (
  options: readonly DraftOption[],
  over: Partial<DraftProduct> = {},
): DraftProduct => ({
  id: "p",
  name: "ثريا",
  code: "CH-1",
  imageKey: null,
  sellable: true,
  options,
  ...over,
});

const line = (over: Partial<DraftLineView> = {}): DraftLineView => ({
  id: "l1",
  sort: 0,
  quantity: 2,
  product: product(chandelier),
  option: chandelier[2],
  ...over,
});

describe("resolveOption", () => {
  it("chooses the only option of a product with no sizes or colours at once", () => {
    const only = [option({ id: "one" })];
    expect(resolveOption(only, undefined, undefined)).toMatchObject({
      showSize: false,
      showColour: false,
      option: { id: "one" },
    });
  });

  it("keeps colour waiting until a size is chosen, then lists the colours of that size", () => {
    const none = resolveOption(chandelier, undefined, undefined);
    expect(none.colourDisabled).toBe(true);
    expect(none.colours).toEqual([]);
    expect(none.sizes.map((s) => s.value)).toEqual(["60 سم", "40 سم"]);
    expect(none.option).toBeNull();

    const sixty = resolveOption(chandelier, "60 سم", undefined);
    expect(sixty.colours.map((c) => c.value)).toEqual(["ذهبي", "أسود"]);
    expect(sixty.option).toBeNull();
    expect(resolveOption(chandelier, "60 سم", "أسود").option?.id).toBe("60b");
  });

  it("settles a size that has one option without waiting for a colour", () => {
    expect(resolveOption(chandelier, "40 سم", undefined).option?.id).toBe("40g");
  });

  it("offers the without choice when only some options carry a dimension", () => {
    const mixed = [option({ id: "a", sizeLabel: "60 سم" }), option({ id: "b" })];
    expect(resolveOption(mixed, undefined, undefined).sizes.map((s) => s.value)).toEqual([
      "60 سم",
      null,
    ]);
    expect(resolveOption(mixed, null, undefined).option?.id).toBe("b");
  });

  it("marks a choice unavailable only when none of its options can be sold", () => {
    const some = [
      option({ id: "a", sizeLabel: "60 سم", sellable: false }),
      option({ id: "b", sizeLabel: "40 سم" }),
    ];
    expect(resolveOption(some, undefined, undefined).sizes).toEqual([
      { value: "60 سم", available: false },
      { value: "40 سم", available: true },
    ]);
  });

  it("clears a colour that does not exist with the new size", () => {
    expect(colourAfterSize(chandelier, "40 سم", "أسود")).toBeUndefined();
    expect(colourAfterSize(chandelier, "40 سم", "ذهبي")).toBe("ذهبي");
  });
});

describe("productPrice", () => {
  it("is the lowest live price, from when prices differ", () => {
    expect(productPrice(product(chandelier))).toEqual({ price: 8_000, from: true });
    expect(productPrice(product([chandelier[0]]))).toEqual({ price: 10_000, from: false });
  });
});

describe("draftTotals", () => {
  it("adds complete sellable lines and the zone fee, and counts the rest", () => {
    const lines = [
      line({ id: "a" }),
      line({ id: "b", quantity: null }),
      line({ id: "c", option: { ...chandelier[0], sellable: false } }),
      line({ id: "d", product: null, option: null, quantity: null }),
      line({ id: "e", option: chandelier[0], quantity: 1 }),
    ];
    expect(draftTotals(lines, 2_000)).toEqual({
      subtotal: 26_000,
      deliveryFee: 2_000,
      total: 28_000,
      excluded: 3,
    });
    expect(draftTotals(lines, null).total).toBe(26_000);
  });

  it("leaves out every line of a product that cannot be sold", () => {
    expect(
      draftTotals([line({ product: product(chandelier, { sellable: false }) })], null),
    ).toEqual({
      subtotal: 0,
      deliveryFee: null,
      total: 0,
      excluded: 1,
    });
  });
});

describe("lineUnavailable", () => {
  it("is true for a product that cannot be sold, or a chosen option that cannot", () => {
    expect(lineUnavailable(line())).toBe(false);
    expect(lineUnavailable(line({ product: null, option: null }))).toBe(false);
    expect(
      lineUnavailable(line({ option: { ...chandelier[2], archived: true, sellable: false } })),
    ).toBe(true);
    expect(
      lineUnavailable(line({ product: product(chandelier, { sellable: false }), option: null })),
    ).toBe(true);
  });
});

describe("lineProblems", () => {
  it("names the first thing each line misses, by position", () => {
    expect(
      lineProblems([
        line({ id: "a" }),
        line({ id: "b", product: null, option: null }),
        line({ id: "c", option: null }),
        line({ id: "d", quantity: null }),
      ]),
    ).toEqual([
      { lineId: "b", position: 2, reason: "no_product" },
      { lineId: "c", position: 3, reason: "no_option" },
      { lineId: "d", position: 4, reason: "no_quantity" },
    ]);
  });
});
