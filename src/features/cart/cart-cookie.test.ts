import { describe, expect, it } from "vitest";
import {
  addLine,
  MAX_CART_LINES,
  parseCart,
  removeLine,
  serializeCart,
  setQuantity,
  type CartLine,
} from "./cart-cookie";

// covers: AC-4 (spec 0004)

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const lines = (count: number): CartLine[] =>
  Array.from({ length: count }, (_, i) => ({ variantId: id(i + 1), quantity: 1 }));

describe("parseCart", () => {
  it("reads what serializeCart wrote, in order", () => {
    const cart = [
      { variantId: id(2), quantity: 3 },
      { variantId: id(1), quantity: 99 },
    ];
    expect(parseCart(serializeCart(cart))).toEqual(cart);
  });

  it.each([undefined, "", "not json", "{}", "null", "42", '"text"'])("empties %j", (raw) => {
    expect(parseCart(raw)).toEqual([]);
  });

  it("drops entries with a bad id or a quantity outside 1 to 99", () => {
    const raw = JSON.stringify([
      { v: "nope", q: 1 },
      { v: id(1), q: 0 },
      { v: id(2), q: 100 },
      { v: id(3), q: 1.5 },
      { v: id(4), q: "2" },
      null,
      { v: id(5), q: 2 },
    ]);
    expect(parseCart(raw)).toEqual([{ variantId: id(5), quantity: 2 }]);
  });

  it("merges repeats, capped at 99, and lowercases ids", () => {
    const raw = JSON.stringify([
      { v: id(1).toUpperCase(), q: 60 },
      { v: id(1), q: 60 },
    ]);
    expect(parseCart(raw)).toEqual([{ variantId: id(1), quantity: 99 }]);
  });

  it("cuts after 30 lines", () => {
    expect(parseCart(serializeCart(lines(35)))).toHaveLength(MAX_CART_LINES);
  });

  it("never holds a price or a name", () => {
    expect(serializeCart(lines(1))).toBe(`[{"v":"${id(1)}","q":1}]`);
  });
});

describe("addLine", () => {
  it("appends a new variant", () => {
    expect(addLine(lines(1), id(9), 2)).toEqual({
      ok: true,
      lines: [...lines(1), { variantId: id(9), quantity: 2 }],
    });
  });

  it("adds to an existing line, capped at 99", () => {
    const result = addLine([{ variantId: id(1), quantity: 90 }], id(1), 20);
    expect(result).toEqual({ ok: true, lines: [{ variantId: id(1), quantity: 99 }] });
  });

  it("refuses a 31st line but still merges into a full cart", () => {
    expect(addLine(lines(30), id(99), 1)).toEqual({ ok: false, error: "cart_full" });
    expect(addLine(lines(30), id(1), 1).ok).toBe(true);
  });
});

describe("setQuantity and removeLine", () => {
  it("sets a quantity within 1 to 99 and ignores unknown ids", () => {
    expect(setQuantity(lines(1), id(1), 150)).toEqual([{ variantId: id(1), quantity: 99 }]);
    expect(setQuantity(lines(1), id(1), 0)).toEqual([{ variantId: id(1), quantity: 1 }]);
    expect(setQuantity(lines(1), id(5), 4)).toEqual(lines(1));
  });

  it("removes one line and keeps the rest in order", () => {
    expect(removeLine(lines(3), id(2))).toEqual([lines(3)[0], lines(3)[2]]);
  });
});
