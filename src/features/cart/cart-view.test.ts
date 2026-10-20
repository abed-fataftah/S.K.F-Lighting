import { describe, expect, it } from "vitest";
import { buildCartView, checkoutTotal, type CartRow } from "./cart-view";

// covers: AC-4, AC-5, AC-8 (spec 0004)

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const row = (n: number, over: Partial<CartRow> = {}): CartRow => ({
  variantId: id(n),
  productId: id(100 + n),
  productName: `منتج ${n}`,
  productCode: `P-${n}`,
  slug: `p-${n}`,
  productStatus: "active",
  productAvailable: true,
  variantCode: null,
  sizeLabel: null,
  colourName: null,
  price: 1000 * n,
  variantAvailable: true,
  archivedAt: null,
  ...over,
});

describe("buildCartView", () => {
  it("keeps cart order and prices each line from the live row", () => {
    const view = buildCartView(
      [
        { variantId: id(2), quantity: 3 },
        { variantId: id(1), quantity: 1 },
      ],
      [row(1), row(2, { sizeLabel: "60 سم", colourName: "ذهبي" })],
    );
    expect(view.lines.map((line) => [line.variantId, line.unitPrice, line.lineTotal])).toEqual([
      [id(2), 2000, 6000],
      [id(1), 1000, 1000],
    ]);
    expect(view.lines[0]).toMatchObject({ sizeLabel: "60 سم", colourName: "ذهبي", sellable: true });
    expect(view.subtotal).toBe(7000);
    expect(view.hasUnsellable).toBe(false);
  });

  it("marks a missing variant and leaves it out of the subtotal", () => {
    const view = buildCartView(
      [
        { variantId: id(1), quantity: 2 },
        { variantId: id(9), quantity: 1 },
      ],
      [row(1)],
    );
    expect(view.lines[1]).toMatchObject({ productName: null, sellable: false, lineTotal: 0 });
    expect(view.subtotal).toBe(2000);
    expect(view.hasUnsellable).toBe(true);
  });

  it.each([
    ["a hidden product", { productStatus: "hidden" as const }],
    ["an unavailable product", { productAvailable: false }],
    ["an unavailable variant", { variantAvailable: false }],
    ["an archived variant", { archivedAt: new Date() }],
  ])("marks %s as not sellable", (_name, over) => {
    const view = buildCartView([{ variantId: id(1), quantity: 1 }], [row(1, over)]);
    expect(view.lines[0].sellable).toBe(false);
    expect(view.subtotal).toBe(0);
    expect(view.hasUnsellable).toBe(true);
  });
});

describe("checkoutTotal", () => {
  it("adds the fee to the sellable subtotal", () => {
    const view = buildCartView([{ variantId: id(3), quantity: 2 }], [row(3)]);
    expect(checkoutTotal(view, 0)).toBe(6000);
    expect(checkoutTotal(view, 2000)).toBe(8000);
  });
});
