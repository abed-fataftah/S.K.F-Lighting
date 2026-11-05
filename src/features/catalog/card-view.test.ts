import { describe, expect, it } from "vitest";
import {
  buildCardProduct,
  cardChips,
  compareListedProducts,
  pickCardVariant,
  type CardSource,
  type CardVariant,
} from "./card-view";

// covers: AC-10, AC-12 (spec 0008)

const product = { status: "active", isAvailable: true, categoryShown: true } as const;

const variant = (over: Partial<CardVariant> = {}): CardVariant => ({
  id: "v",
  price: 10_000,
  isAvailable: true,
  archivedAt: null,
  isDefault: false,
  sort: 0,
  ...over,
});

const source = (over: Partial<CardSource> = {}): CardSource => ({
  slug: "ثريا-CH-1",
  name: "ثريا",
  code: "CH-1",
  specs: [],
  product,
  variants: [variant({ isDefault: true })],
  imageKey: null,
  ...over,
});

describe("cardChips", () => {
  it("takes the first three values that are not empty, tidied, in stored order", () => {
    expect(
      cardChips([
        { label: "القطر", value: "  60 سم " },
        { label: "اللون", value: "   " },
        { label: "القاعدة", value: "E27" },
        { label: "القدرة", value: "40W" },
        { label: "أخرى", value: "زائد" },
      ]),
    ).toEqual(["60 سم", "E27", "40W"]);
  });

  it("gives fewer chips for fewer rows", () => {
    expect(cardChips([])).toEqual([]);
    expect(cardChips([{ label: "أ", value: "ب" }])).toEqual(["ب"]);
  });
});

describe("pickCardVariant", () => {
  it("takes the lowest sellable price", () => {
    const picked = pickCardVariant(product, [
      variant({ id: "default", isDefault: true, price: 20_000 }),
      variant({ id: "cheap", price: 15_000, sort: 3 }),
      variant({ id: "cheaper but off", price: 1_000, isAvailable: false }),
    ]);
    expect(picked?.id).toBe("cheap");
  });

  it("breaks a price tie by the default, then the lowest sort", () => {
    expect(
      pickCardVariant(product, [
        variant({ id: "a", sort: 0 }),
        variant({ id: "d", isDefault: true, sort: 5 }),
      ])?.id,
    ).toBe("d");
    expect(
      pickCardVariant(product, [variant({ id: "b", sort: 2 }), variant({ id: "a", sort: 1 })])?.id,
    ).toBe("a");
  });

  it("is null when nothing can be sold", () => {
    expect(pickCardVariant({ ...product, categoryShown: false }, [variant()])).toBeNull();
  });
});

describe("buildCardProduct", () => {
  it("shows one price for an in stock product with one price", () => {
    expect(buildCardProduct(source())).toMatchObject({
      listPrice: 10_000,
      pricesDiffer: false,
      inStock: true,
      addVariantId: "v",
    });
  });

  it("shows من when sellable prices differ, ignoring unavailable ones", () => {
    const card = buildCardProduct(
      source({
        variants: [
          variant({ id: "a", price: 12_000 }),
          variant({ id: "b", price: 9_000 }),
          variant({ id: "c", price: 1_000, isAvailable: false }),
        ],
      }),
    );
    expect(card).toMatchObject({ listPrice: 9_000, pricesDiffer: true, addVariantId: "b" });
  });

  it("is out of stock with the lowest live price, no من, and no add variant", () => {
    const card = buildCardProduct(
      source({
        product: { ...product, isAvailable: false },
        variants: [
          variant({ id: "a", price: 12_000 }),
          variant({ id: "b", price: 9_000 }),
          variant({ id: "old", price: 100, archivedAt: new Date() }),
        ],
      }),
    );
    expect(card).toMatchObject({
      inStock: false,
      listPrice: 9_000,
      pricesDiffer: false,
      addVariantId: null,
    });
  });

  it("has no price when no live variant is left", () => {
    const card = buildCardProduct(source({ variants: [variant({ archivedAt: new Date() })] }));
    expect(card).toMatchObject({ inStock: false, listPrice: null, addVariantId: null });
  });

  it("is out of stock when its category is not shown", () => {
    expect(
      buildCardProduct(source({ product: { ...product, categoryShown: false } })),
    ).toMatchObject({ inStock: false, addVariantId: null, listPrice: 10_000 });
  });
});

describe("compareListedProducts", () => {
  const p = (id: string, inStock: boolean, day: number) => ({
    id,
    inStock,
    createdAt: new Date(Date.UTC(2026, 0, day)),
  });

  it("puts in stock first, then newest first, then the higher id", () => {
    const rows = [
      p("a", false, 9),
      p("b", true, 1),
      p("c", true, 5),
      p("e", true, 5),
      p("d", false, 2),
    ];
    expect([...rows].sort(compareListedProducts).map((r) => r.id)).toEqual([
      "e",
      "c",
      "b",
      "a",
      "d",
    ]);
  });
});
