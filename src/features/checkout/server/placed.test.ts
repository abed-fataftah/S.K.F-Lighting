import { beforeEach, describe, expect, it, vi } from "vitest";
import { CART_COOKIE } from "@/features/cart/cart-cookie";
import { parsePlaced, PLACED_COOKIE } from "../placed-cookie";

// covers: AC-13 (spec 0020): an order sent from a draft keeps the electrician's cart; checkout
// still empties it.

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));

const { rememberPlacedOrder } = await import("./placed");

const ORDER = "0b8f0d7e-3c4a-4e1b-9f2d-6a5c4b3a2f10";

describe("rememberPlacedOrder", () => {
  beforeEach(() => {
    jar.clear();
    jar.set(CART_COOKIE, "cart-value");
  });

  it("remembers the order and empties the cart by default", async () => {
    await rememberPlacedOrder(ORDER);
    expect(parsePlaced(jar.get(PLACED_COOKIE))).toEqual([ORDER]);
    expect(jar.has(CART_COOKIE)).toBe(false);
  });

  it("remembers the order and keeps the cart with clearCart false", async () => {
    await rememberPlacedOrder(ORDER, { clearCart: false });
    expect(parsePlaced(jar.get(PLACED_COOKIE))).toEqual([ORDER]);
    expect(jar.get(CART_COOKIE)).toBe("cart-value");
  });
});
