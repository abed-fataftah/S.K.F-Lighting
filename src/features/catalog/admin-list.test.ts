import { describe, expect, it } from "vitest";
import {
  escapeLike,
  listPrice,
  optionCounts,
  parseCategoryFilter,
  parseProductFilter,
  parseSearch,
  statusLabel,
} from "./admin-list";

// covers: AC-1 (spec 0006)

describe("parseProductFilter", () => {
  it.each([
    [undefined, "all"],
    ["", "all"],
    ["nope", "all"],
    ["available", "available"],
    ["unavailable", "unavailable"],
    ["hidden", "hidden"],
    ["archived", "archived"],
    [["hidden", "archived"], "hidden"],
  ])("reads %j as %s", (value, filter) => {
    expect(parseProductFilter(value)).toBe(filter);
  });
});

describe("parseCategoryFilter", () => {
  it("keeps a uuid and drops anything else", () => {
    expect(parseCategoryFilter("8A1D2B3C-4D5E-4F60-8A71-B2C3D4E5F607")).toBe(
      "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607",
    );
    expect(parseCategoryFilter("lamps")).toBeNull();
    expect(parseCategoryFilter(undefined)).toBeNull();
  });
});

describe("parseSearch", () => {
  it("tidies the text and reads Arabic digits as Western", () => {
    expect(parseSearch("  ثريا   ٦٠ ")).toBe("ثريا 60");
    expect(parseSearch("ch-1020")).toBe("ch-1020");
  });

  it("means no search when nothing is left", () => {
    expect(parseSearch("   ‏ ")).toBeNull();
    expect(parseSearch(undefined)).toBeNull();
  });
});

describe("escapeLike", () => {
  it("makes % and _ and the escape itself match literally", () => {
    expect(escapeLike("50%_off\\x")).toBe("50\\%\\_off\\\\x");
  });
});

describe("statusLabel", () => {
  it.each([
    ["archived", true, "archived"],
    ["archived", false, "archived"],
    ["hidden", true, "hidden"],
    ["active", true, "available"],
    ["active", false, "unavailable"],
  ] as const)("%s with sellable %s is %s", (status, sellable, label) => {
    expect(statusLabel(status, sellable)).toBe(label);
  });
});

describe("listPrice", () => {
  it("shows the lowest price, with من only when prices differ", () => {
    expect(listPrice(10_000, 15_000)).toEqual({ amount: 10_000, from: true });
    expect(listPrice(10_000, 10_000)).toEqual({ amount: 10_000, from: false });
    expect(listPrice(null, null)).toBeNull();
  });
});

describe("optionCounts", () => {
  it("shows each count only above zero, and none for a simple product", () => {
    expect(optionCounts(2, 3)).toEqual([
      { kind: "sizes", count: 2 },
      { kind: "colours", count: 3 },
    ]);
    expect(optionCounts(0, 2)).toEqual([{ kind: "colours", count: 2 }]);
    expect(optionCounts(0, 0)).toEqual([]);
  });
});
