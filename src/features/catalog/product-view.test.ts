import { describe, expect, it } from "vitest";
import {
  applyRequestedVariant,
  buildProductOptions,
  buildProductPage,
  chooseColour,
  chooseSize,
  colourChips,
  galleryItems,
  hasOptions,
  parseRequestedVariant,
  priceLine,
  reconcileSelection,
  selectedValues,
  selectionText,
  sizeChips,
  stepIndex,
  type ProductPageInput,
  type ReadVariant,
} from "./product-view";

// covers: AC-1 to AC-10, AC-19 (spec 0009)

const product = { status: "active", isAvailable: true, categoryShown: true } as const;
const GOLD = "c-gold";
const BLACK = "c-black";

const variant = (over: Partial<ReadVariant> & { id: string }): ReadVariant => ({
  sizeLabel: null,
  sizeSort: 0,
  colourId: null,
  colourName: null,
  colourHex: null,
  price: 10_000,
  isAvailable: true,
  archivedAt: null,
  isDefault: false,
  sort: 0,
  ...over,
});

const gold = { colourId: GOLD, colourName: "ذهبي", colourHex: "hex-gold" };
const black = { colourId: BLACK, colourName: "أسود", colourHex: "hex-black" };

// 2 sizes × 2 colours; 60 سم in black is unticked.
const grid: readonly ReadVariant[] = [
  variant({
    id: "40-gold",
    sizeLabel: "40 سم",
    sizeSort: 1,
    ...gold,
    price: 30_000,
    sort: 0,
    isDefault: true,
  }),
  variant({ id: "40-black", sizeLabel: "40 سم", sizeSort: 1, ...black, price: 30_000, sort: 1 }),
  variant({ id: "60-gold", sizeLabel: "60 سم", sizeSort: 2, ...gold, price: 45_000, sort: 2 }),
  variant({
    id: "60-black",
    sizeLabel: "60 سم",
    sizeSort: 2,
    ...black,
    price: 45_000,
    sort: 3,
    isAvailable: false,
  }),
];

const options = buildProductOptions(product, grid);

describe("buildProductOptions", () => {
  it("makes one chip per distinct size by lowest size_sort and per colour by lowest sort", () => {
    expect(options.sizes).toEqual([{ label: "40 سم" }, { label: "60 سم" }]);
    expect(options.colours).toEqual([
      { id: GOLD, name: "ذهبي", hex: "hex-gold" },
      { id: BLACK, name: "أسود", hex: "hex-black" },
    ]);
  });

  it("orders sizes by size_sort, ties by label, and colours by sort, ties by name", () => {
    const built = buildProductOptions(product, [
      variant({ id: "b", sizeLabel: "ب", sizeSort: 5, colourId: "y", colourName: "ي", sort: 3 }),
      variant({ id: "a", sizeLabel: "أ", sizeSort: 5, colourId: "x", colourName: "س", sort: 3 }),
      variant({ id: "c", sizeLabel: "ج", sizeSort: 1, colourId: "x", colourName: "س", sort: 9 }),
    ]);
    expect(built.sizes.map((s) => s.label)).toEqual(["ج", "أ", "ب"]);
    expect(built.colours.map((c) => c.name)).toEqual(["س", "ي"]);
  });

  it("leaves archived variants out and marks an unavailable one not sellable", () => {
    const built = buildProductOptions(product, [
      variant({ id: "old", sizeLabel: "1", archivedAt: new Date() }),
      variant({ id: "off", sizeLabel: "2", isAvailable: false }),
    ]);
    expect(built.sizes).toEqual([{ label: "2" }]);
    expect(built.variants).toEqual([
      { id: "off", sizeLabel: "2", colourId: null, price: 10_000, sellable: false },
    ]);
  });

  it("never sells a variant missing a size the others have", () => {
    const built = buildProductOptions(product, [
      variant({ id: "bare", sort: 0 }),
      variant({ id: "sized", sizeLabel: "40", sort: 1 }),
    ]);
    expect(built.variants.find((v) => v.id === "bare")?.sellable).toBe(false);
    expect(built.variants.find((v) => v.id === "sized")?.sellable).toBe(true);
  });

  it("marks everything not sellable when the product is unavailable", () => {
    const built = buildProductOptions({ ...product, isAvailable: false }, grid);
    expect(built.variants.every((v) => !v.sellable)).toBe(true);
  });

  it("shows no groups for a product with no options", () => {
    const built = buildProductOptions(product, [variant({ id: "only", isDefault: true })]);
    expect(hasOptions(built)).toBe(false);
    expect(hasOptions(options)).toBe(true);
  });
});

describe("chips", () => {
  it("enables a size when any sellable variant has it", () => {
    expect(sizeChips(options)).toEqual([
      { label: "40 سم", enabled: true },
      { label: "60 سم", enabled: true },
    ]);
  });

  it("follows the size: the unticked pair's colour is disabled for that size only", () => {
    expect(colourChips(options, "60 سم").map((c) => [c.id, c.enabled])).toEqual([
      [GOLD, true],
      [BLACK, false],
    ]);
    expect(colourChips(options, "40 سم").every((c) => c.enabled)).toBe(true);
  });

  it("enables a colour by its own variant on a product with colours only", () => {
    const built = buildProductOptions(product, [
      variant({ id: "g", ...gold, sort: 0 }),
      variant({ id: "b", ...black, sort: 1, isAvailable: false }),
    ]);
    expect(colourChips(built, null).map((c) => c.enabled)).toEqual([true, false]);
  });

  it("disables a size with no sellable variant and every colour with no size chosen", () => {
    const built = buildProductOptions(product, [
      variant({ id: "a", sizeLabel: "1", ...gold, isAvailable: false }),
    ]);
    expect(sizeChips(built)).toEqual([{ label: "1", enabled: false }]);
    expect(colourChips(built, null)[0].enabled).toBe(false);
  });

  it("reads the pressed chips from the selection", () => {
    expect(selectedValues(options, "60-gold")).toEqual({ size: "60 سم", colourId: GOLD });
    expect(selectedValues(options, null)).toEqual({ size: null, colourId: null });
  });
});

describe("choosing", () => {
  it("keeps the colour when the new size's pair sells", () => {
    expect(chooseSize(options, "40-gold", "60 سم")).toBe("60-gold");
  });

  it("moves to the first enabled colour when the pair does not sell", () => {
    expect(chooseSize(options, "40-black", "60 سم")).toBe("60-gold");
  });

  it("does not move to a size with nothing to sell", () => {
    const built = buildProductOptions(product, [
      variant({ id: "a", sizeLabel: "1", sort: 0 }),
      variant({ id: "b", sizeLabel: "2", sort: 1, isAvailable: false }),
    ]);
    expect(chooseSize(built, "a", "2")).toBe("a");
    expect(chooseSize(built, "a", "1")).toBe("a");
  });

  it("chooses a colour for the current size, and ignores a pair that does not sell", () => {
    expect(chooseColour(options, "40-gold", BLACK)).toBe("40-black");
    expect(chooseColour(options, "60-gold", BLACK)).toBe("60-gold");
  });

  it("chooses on a product with colours only", () => {
    const built = buildProductOptions(product, [
      variant({ id: "g", ...gold, sort: 0 }),
      variant({ id: "b", ...black, sort: 1 }),
    ]);
    expect(chooseColour(built, "g", BLACK)).toBe("b");
  });
});

const input = (over: Partial<ProductPageInput> = {}): ProductPageInput => ({
  product: {
    id: "p",
    slug: "ثريا",
    name: "ثريا كريستال",
    code: "CH-1",
    description: null,
    specs: [],
    status: "active",
    isAvailable: true,
  },
  category: { name: "ثريات", slug: "chandeliers" },
  parent: null,
  variants: grid,
  media: [],
  ...over,
});

describe("buildProductPage", () => {
  it("picks the default variant first and is in stock", () => {
    const data = buildProductPage(input());
    expect(data.selectedId).toBe("40-gold");
    expect(data.inStock).toBe(true);
    expect(data.mutedPrice).toBe(30_000);
  });

  it("picks the first sellable by sort when the default does not sell", () => {
    const variants = grid.map((v) => (v.id === "40-gold" ? { ...v, isAvailable: false } : v));
    expect(buildProductPage(input({ variants })).selectedId).toBe("40-black");
  });

  it("is out of stock with no selection when the product is unavailable", () => {
    const data = buildProductPage(input({ product: { ...input().product, isAvailable: false } }));
    expect(data).toMatchObject({ selectedId: null, inStock: false, mutedPrice: 30_000 });
  });

  it("falls back to the first live variant's price, and to none with no live variant", () => {
    const variants = [
      variant({ id: "late", sort: 4, price: 900, isAvailable: false }),
      variant({ id: "early", sort: 1, price: 500, isAvailable: false }),
    ];
    expect(buildProductPage(input({ variants })).mutedPrice).toBe(500);
    expect(buildProductPage(input({ variants: [] })).mutedPrice).toBeNull();
  });

  it("builds the breadcrumb from the main and the sub", () => {
    const data = buildProductPage(
      input({ parent: { name: "إنارة", slug: "light" }, category: { name: "ثريات", slug: "ch" } }),
    );
    expect(data.breadcrumb).toEqual({
      main: { name: "إنارة", slug: "light" },
      sub: { name: "ثريات", slug: "ch" },
    });
    expect(buildProductPage(input()).breadcrumb.sub).toBeNull();
  });

  it("splits photos in order from the video", () => {
    const data = buildProductPage(
      input({
        media: [
          { kind: "image", key: "a.webp", width: 10, height: 10, alt: null },
          { kind: "image", key: "b.webp", width: 10, height: 10, alt: "ب" },
          { kind: "video", key: "v.mp4", width: null, height: null, alt: null },
        ],
      }),
    );
    expect(data.photos.map((p) => p.key)).toEqual(["a.webp", "b.webp"]);
    expect(data.video).toEqual({ key: "v.mp4" });
  });
});

describe("first selection with ?v", () => {
  const data = buildProductPage(input());
  const id = "0f8b6a52-3c7e-4c1a-9d1e-5b6f7a8c9d0e";

  it("reads the first value and only a uuid", () => {
    expect(parseRequestedVariant(id)).toBe(id);
    expect(parseRequestedVariant([id, "x"])).toBe(id);
    expect(parseRequestedVariant("abc")).toBeNull();
    expect(parseRequestedVariant(undefined)).toBeNull();
    expect(parseRequestedVariant([])).toBeNull();
  });

  it("selects a sellable variant of this product", () => {
    expect(applyRequestedVariant(data, "60-gold").selectedId).toBe("60-gold");
  });

  it.each([
    ["no v", null],
    ["a variant that does not sell", "60-black"],
    ["another product's variant", id],
  ])("keeps the server's pick for %s", (_name, requested) => {
    expect(applyRequestedVariant(data, requested).selectedId).toBe("40-gold");
  });
});

describe("reconcileSelection", () => {
  it("keeps the current choice while it sells, else takes the refreshed pick", () => {
    expect(reconcileSelection(options, "60-gold", "40-gold")).toBe("60-gold");
    expect(reconcileSelection(options, "60-black", "40-gold")).toBe("40-gold");
    expect(reconcileSelection(options, null, null)).toBeNull();
  });
});

describe("priceLine and selectionText", () => {
  it("shows the selected variant's price and size", () => {
    expect(priceLine(options, "60-gold", 30_000)).toEqual({
      price: 45_000,
      size: "60 سم",
      muted: false,
    });
  });

  it("shows the muted price with no note when nothing is selected", () => {
    expect(priceLine(options, null, 30_000)).toEqual({ price: 30_000, size: null, muted: true });
  });

  it("names the size and colour, whichever exist", () => {
    expect(selectionText(options, "40-black")).toBe("40 سم أسود");
    const sizesOnly = buildProductOptions(product, [variant({ id: "s", sizeLabel: "40" })]);
    expect(selectionText(sizesOnly, "s")).toBe("40");
    const bare = buildProductOptions(product, [variant({ id: "x" })]);
    expect(selectionText(bare, "x")).toBe("");
    expect(selectionText(options, null)).toBe("");
  });
});

describe("galleryItems", () => {
  const alt = (n: number) => `ثريا، صورة ${n}`;

  it("puts the photos in order, then the video, with the alt or the fallback", () => {
    const items = galleryItems(
      [
        { key: "a", width: 1, height: 1, alt: "  " },
        { key: "b", width: 1, height: 1, alt: "الوجه الأمامي" },
      ],
      { key: "v" },
      alt,
    );
    expect(items).toEqual([
      { kind: "photo", key: "a", alt: "ثريا، صورة 1", n: 1 },
      { kind: "photo", key: "b", alt: "الوجه الأمامي", n: 2 },
      { kind: "video", key: "v" },
    ]);
  });

  it("is empty with no photos and no video", () => {
    expect(galleryItems([], null, alt)).toEqual([]);
  });

  it("steps and loops at both ends", () => {
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});
