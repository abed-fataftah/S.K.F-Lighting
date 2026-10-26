import { describe, expect, it } from "vitest";
import { isSellable, pickVariantToAdd } from "./sellable";

// covers: AC-3, AC-5 (spec 0004); AC-7 (spec 0008)

const product = { status: "active", isAvailable: true, categoryShown: true } as const;

type TestVariant = {
  id: string;
  isAvailable: boolean;
  archivedAt: Date | null;
  isDefault: boolean;
  sort: number;
};

const variant = (over: Partial<TestVariant> = {}): TestVariant => ({
  id: "v",
  isAvailable: true,
  archivedAt: null,
  isDefault: false,
  sort: 0,
  ...over,
});

describe("isSellable", () => {
  it("is true for an active, available product and variant", () => {
    expect(isSellable(product, variant())).toBe(true);
  });

  it.each([
    ["a hidden product", { ...product, status: "hidden" as const }, variant()],
    ["an archived product", { ...product, status: "archived" as const }, variant()],
    ["an unavailable product", { ...product, isAvailable: false }, variant()],
    ["a product whose category is not shown", { ...product, categoryShown: false }, variant()],
    ["an unavailable variant", product, variant({ isAvailable: false })],
    ["an archived variant", product, variant({ archivedAt: new Date() })],
  ])("is false for %s", (_name, p, v) => {
    expect(isSellable(p, v)).toBe(false);
  });
});

describe("pickVariantToAdd", () => {
  it("prefers the sellable default", () => {
    const picked = pickVariantToAdd(product, [
      variant({ id: "a", sort: 0 }),
      variant({ id: "d", isDefault: true, sort: 5 }),
    ]);
    expect(picked?.id).toBe("d");
  });

  it("falls back to the first sellable by sort", () => {
    const picked = pickVariantToAdd(product, [
      variant({ id: "d", isDefault: true, isAvailable: false }),
      variant({ id: "b", sort: 2 }),
      variant({ id: "a", sort: 1 }),
    ]);
    expect(picked?.id).toBe("a");
  });

  it("is null when nothing can be sold", () => {
    expect(
      pickVariantToAdd({ ...product, status: "hidden" }, [variant({ isDefault: true })]),
    ).toBeNull();
    expect(pickVariantToAdd(product, [])).toBeNull();
  });
});
