import { describe, expect, it } from "vitest";
import {
  appliedChips,
  compareSizeKeys,
  EMPTY_FILTERS,
  isFiltered,
  parseListFilters,
  priceBounds,
  resolveFilters,
  serializeListFilters,
  sizeChoices,
  toListFilters,
  withoutChip,
  type FilterChoices,
} from "./list-filters";

// covers: AC-8, AC-10, AC-13, AC-16 (spec 0010)

const choices: FilterChoices = {
  sizes: [
    { key: "60سم", label: "60 سم" },
    { key: "80سم", label: "80 سم" },
  ],
  colours: [
    { id: "c-gold", name: "ذهبي", hex: "gold" },
    { id: "c-black", name: "أسود", hex: null },
  ],
  price: { min: 50, max: 900 },
};

describe("parseListFilters", () => {
  it("reads every filter from a record of params", () => {
    expect(
      parseListFilters({
        size: ["60سم", "80سم"],
        colour: "ذهبي",
        min: "100",
        max: "200",
        available: "1",
      }),
    ).toEqual({ sizes: ["60سم", "80سم"], colours: ["ذهبي"], min: 100, max: 200, available: true });
  });

  it("reads URLSearchParams the same way", () => {
    const params = new URLSearchParams("size=60سم&colour=ذهبي&min=10&available=1");
    expect(parseListFilters(params)).toEqual({
      sizes: ["60سم"],
      colours: ["ذهبي"],
      min: 10,
      max: null,
      available: true,
    });
  });

  it("is empty for no params", () => {
    expect(parseListFilters({})).toEqual(EMPTY_FILTERS);
  });

  it.each(["0", "abc", "12.5", "-3", "1000000", "", " "])("drops min=%j", (min) => {
    expect(parseListFilters({ min }).min).toBeNull();
  });

  it("accepts Arabic digits and tidies values", () => {
    expect(parseListFilters({ min: "١٢٠", colour: "  ذهبي ", size: "٦٠سم" })).toMatchObject({
      min: 120,
      colours: ["ذهبي"],
      sizes: ["60سم"],
    });
  });

  it("swaps min and max when min is larger", () => {
    expect(parseListFilters({ min: "500", max: "100" })).toMatchObject({ min: 100, max: 500 });
  });

  it("drops empty values and duplicates, and keeps at most 20 of each", () => {
    const many = Array.from({ length: 25 }, (_, i) => `s${i}`);
    const parsed = parseListFilters({ size: [...many, "s0", ""], colour: ["ذهبي", "ذهبي", ""] });
    expect(parsed.sizes).toHaveLength(20);
    expect(parsed.sizes[0]).toBe("s0");
    expect(parsed.colours).toEqual(["ذهبي"]);
  });

  it.each(["0", "true", "yes", "2"])("treats available=%j as off", (available) => {
    expect(parseListFilters({ available }).available).toBe(false);
  });
});

describe("resolveFilters", () => {
  it("keeps only offered sizes and colours and attaches colour ids", () => {
    const resolved = resolveFilters(
      parseListFilters({ size: ["60سم", "999سم"], colour: ["أسود", "بنفسجي"], max: "300" }),
      choices,
    );
    expect(resolved).toEqual({
      sizes: [{ key: "60سم", label: "60 سم" }],
      colours: [{ id: "c-black", name: "أسود", hex: null }],
      min: null,
      max: 300,
      available: false,
    });
  });

  it("makes a list whose every filter was dropped unfiltered", () => {
    const resolved = resolveFilters(parseListFilters({ colour: "بنفسجي" }), choices);
    expect(isFiltered(resolved)).toBe(false);
  });

  it("counts available alone as an active filter", () => {
    expect(isFiltered(resolveFilters(parseListFilters({ available: "1" }), choices))).toBe(true);
  });
});

describe("serializeListFilters", () => {
  it("writes q, size, colour, min, max, available, page in that order", () => {
    expect(
      serializeListFilters(
        { sizes: ["a"], colours: ["b"], min: 1, max: 2, available: true },
        { q: "ثريا", page: 2 },
      ),
    ).toBe(`q=${encodeURIComponent("ثريا")}&size=a&colour=b&min=1&max=2&available=1&page=2`);
  });

  it("leaves out empty values and page 1", () => {
    expect(serializeListFilters(EMPTY_FILTERS, { q: "", page: 1 })).toBe("");
  });

  it("round trips: parse then serialize then parse gives the same", () => {
    const address = "size=60سم&size=80سم&colour=ذهبي&min=500&max=100&available=1";
    const once = parseListFilters(new URLSearchParams(address));
    const query = serializeListFilters(once);
    expect(parseListFilters(new URLSearchParams(query))).toEqual(once);
    expect(serializeListFilters(parseListFilters(new URLSearchParams(query)))).toBe(query);
  });
});

describe("applied chips", () => {
  const resolved = resolveFilters(
    parseListFilters({ size: "60سم", colour: ["ذهبي", "أسود"], min: "100", available: "1" }),
    choices,
  );

  it("has one chip per size and colour, one for price, one for available", () => {
    expect(appliedChips(resolved)).toEqual([
      { kind: "size", key: "60سم", label: "60 سم" },
      { kind: "colour", name: "ذهبي" },
      { kind: "colour", name: "أسود" },
      { kind: "price", min: 100, max: null },
      { kind: "available" },
    ]);
  });

  it("gives the badge count as the number of chips", () => {
    expect(appliedChips(resolved)).toHaveLength(5);
    expect(appliedChips(resolveFilters(EMPTY_FILTERS, choices))).toHaveLength(0);
  });

  it("removes exactly one chip's filter", () => {
    const filters = toListFilters(resolved);
    expect(withoutChip(filters, { kind: "colour", name: "ذهبي" }).colours).toEqual(["أسود"]);
    expect(withoutChip(filters, { kind: "price", min: 100, max: null })).toMatchObject({
      min: null,
      max: null,
      sizes: ["60سم"],
    });
    expect(withoutChip(filters, { kind: "available" }).available).toBe(false);
    expect(withoutChip(filters, { kind: "size", key: "60سم", label: "60 سم" }).sizes).toEqual([]);
  });
});

describe("size choices", () => {
  it("orders by leading number, then keys with none, then text", () => {
    const keys = ["كبير", "120سم", "60x40", "صغير", "60سم", "2.5سم"];
    expect([...keys].sort(compareSizeKeys)).toEqual([
      "2.5سم",
      "60سم",
      "60x40",
      "120سم",
      "صغير",
      "كبير",
    ]);
  });

  it("labels each key with its most common label, ties going to the label that sorts first", () => {
    expect(
      sizeChoices([
        { sizeKey: "60سم", sizeLabel: "60 سم", count: 1 },
        { sizeKey: "60سم", sizeLabel: "60سم", count: 2 },
        { sizeKey: "80سم", sizeLabel: "80 سم", count: 3 },
        { sizeKey: "80سم", sizeLabel: "80سم", count: 3 },
        { sizeKey: null, sizeLabel: null, count: 9 },
      ]),
    ).toEqual([
      { key: "60سم", label: "60سم" },
      { key: "80سم", label: "80 سم" },
    ]);
  });
});

describe("priceBounds", () => {
  it("rounds the lowest price down and the highest up, in shekels", () => {
    expect(priceBounds({ min: 4_550, max: 89_001 })).toEqual({ min: 45, max: 891 });
  });

  it("is null with no live option", () => {
    expect(priceBounds({ min: null, max: null })).toBeNull();
    expect(priceBounds(null)).toBeNull();
  });
});
