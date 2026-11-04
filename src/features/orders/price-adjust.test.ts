import { describe, expect, it } from "vitest";
import {
  canAdjustPrices,
  checkAdjustedPrice,
  differsFromCatalog,
  differsFromSaved,
  fieldErrors,
  lineErrorsFromIssues,
  previewTotals,
  priceDiscount,
  priceNotice,
  pricesLocked,
} from "./price-adjust";
import { adjustPricesSchema, adjustedPriceField } from "./schemas";
import { ORDER_STATUSES } from "./status";

// covers: AC-1, AC-2, AC-3, AC-6, AC-7, AC-13 (spec 0022)

describe("canAdjustPrices and pricesLocked", () => {
  it("lets only an open electrician order be adjusted", () => {
    const open = ["new", "confirmed", "preparing", "ready", "out_for_delivery"];
    for (const status of ORDER_STATUSES) {
      expect(canAdjustPrices("electrician", status)).toBe(open.includes(status));
      expect(pricesLocked("electrician", status)).toBe(!open.includes(status));
    }
  });

  it("never adjusts or shows the locked line on customer, admin, or guest orders", () => {
    for (const role of ["customer", "admin", null] as const) {
      for (const status of ORDER_STATUSES) {
        expect(canAdjustPrices(role, status)).toBe(false);
        expect(pricesLocked(role, status)).toBe(false);
      }
    }
  });
});

describe("adjustedPriceField", () => {
  it.each([
    ["0", 0],
    ["0.00", 0],
    ["00", 0],
    ["١٢٫٥", 1250],
    ["١٢.٥", 1250],
    ["1,250", 125_000],
    [" 19.9 ", 1990],
  ])("takes %j as %i agorot", (text, agorot) => {
    expect(adjustedPriceField.parse(text)).toBe(agorot);
  });

  it.each([
    ["", "required"],
    ["   ", "required"],
    ["-5", "price_invalid"],
    ["1.234", "price_invalid"],
    ["abc", "price_invalid"],
  ])("refuses %j as %s", (text, message) => {
    const parsed = adjustedPriceField.safeParse(text);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(message);
  });
});

describe("checkAdjustedPrice", () => {
  it("takes a price up to and equal to the catalog price, and 0", () => {
    expect(checkAdjustedPrice("100", 12_500)).toEqual({ ok: true, agorot: 10_000 });
    expect(checkAdjustedPrice("125", 12_500)).toEqual({ ok: true, agorot: 12_500 });
    expect(checkAdjustedPrice("0", 12_500)).toEqual({ ok: true, agorot: 0 });
  });

  it("names each problem", () => {
    expect(checkAdjustedPrice("", 12_500)).toEqual({ ok: false, error: "required" });
    expect(checkAdjustedPrice("1.2.3", 12_500)).toEqual({ ok: false, error: "price_invalid" });
    expect(checkAdjustedPrice("125.01", 12_500)).toEqual({ ok: false, error: "above_catalog" });
  });
});

describe("priceDiscount", () => {
  it("sums the catalog totals and the discount over the quantity", () => {
    expect(
      priceDiscount([
        { catalogUnitPrice: 12_500, unitPrice: 10_000, quantity: 2 },
        { catalogUnitPrice: 4_000, unitPrice: 4_000, quantity: 3 },
      ]),
    ).toEqual({ catalogSubtotal: 37_000, discount: 5_000 });
  });

  it("is 0 with no cut and with no lines", () => {
    expect(priceDiscount([{ catalogUnitPrice: 500, unitPrice: 500, quantity: 1 }]).discount).toBe(
      0,
    );
    expect(priceDiscount([])).toEqual({ catalogSubtotal: 0, discount: 0 });
  });
});

describe("previewTotals", () => {
  const lines = [
    { unitPrice: 12_500, quantity: 2, typed: undefined },
    { unitPrice: 4_000, quantity: 3, typed: undefined },
  ];

  it("shows the saved totals while nothing is typed", () => {
    expect(previewTotals(lines, 2_000, 0)).toEqual({
      subtotal: 37_000,
      total: 39_000,
      unitPrices: [12_500, 4_000],
      lineTotals: [25_000, 12_000],
    });
  });

  it("previews a parsed value, even above the catalog, and keeps an unparsed line saved", () => {
    expect(
      previewTotals(
        [
          { ...lines[0], typed: "200" },
          { ...lines[1], typed: "abc" },
        ],
        0,
        0,
      ),
    ).toEqual({
      subtotal: 52_000,
      total: 52_000,
      unitPrices: [20_000, 4_000],
      lineTotals: [40_000, 12_000],
    });
    expect(previewTotals([{ ...lines[0], typed: "" }], 0, 0).total).toBe(25_000);
  });

  it("falls back to the saved totals when the preview would go below 0", () => {
    expect(previewTotals([{ ...lines[0], typed: "0" }], 0, 10_000)).toMatchObject({
      subtotal: 25_000,
      total: 15_000,
      lineTotals: [0],
    });
  });
});

describe("the edit fields", () => {
  const line = { id: "a", unitPrice: 10_000, catalogUnitPrice: 12_500 };

  it("sends a field only when its text differs from the saved price", () => {
    expect(differsFromSaved(line, undefined)).toBe(false);
    expect(differsFromSaved(line, "100")).toBe(false);
    expect(differsFromSaved(line, "100.0")).toBe(true);
    expect(differsFromSaved(line, "")).toBe(true);
  });

  it("strikes the catalog price and offers the reset while the field is off the catalog", () => {
    expect(differsFromCatalog(line, undefined)).toBe(true);
    expect(differsFromCatalog(line, "125")).toBe(false);
    expect(differsFromCatalog(line, "125.00")).toBe(false);
    expect(differsFromCatalog(line, "")).toBe(true);
    expect(differsFromCatalog({ ...line, unitPrice: 12_500 }, undefined)).toBe(false);
  });

  it("checks every field, untouched ones as their saved price", () => {
    const other = { id: "b", unitPrice: 4_000, catalogUnitPrice: 4_000 };
    expect(fieldErrors([line, other], {})).toEqual({});
    expect(fieldErrors([line, other], { a: "", b: "41" })).toEqual({
      a: "required",
      b: "above_catalog",
    });
  });
});

describe("lineErrorsFromIssues", () => {
  const ID_A = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
  const ID_B = "9b1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
  const base = {
    orderId: ID_A,
    expectedTotal: 100,
    lines: [
      { lineId: ID_A, expectedUnitPrice: 100, price: "" },
      { lineId: ID_B, expectedUnitPrice: 100, price: "x" },
    ],
  };

  it("maps each price issue to its lineId", () => {
    const parsed = adjustPricesSchema.safeParse(base);
    expect(parsed.success).toBe(false);
    expect(lineErrorsFromIssues(base, parsed.error?.issues ?? [])).toEqual({
      [ID_A]: "required",
      [ID_B]: "price_invalid",
    });
  });

  it("gives null when anything else is wrong too", () => {
    const bad = { ...base, orderId: "x" };
    const parsed = adjustPricesSchema.safeParse(bad);
    expect(lineErrorsFromIssues(bad, parsed.error?.issues ?? [])).toBeNull();
    expect(lineErrorsFromIssues(null, [{ path: ["orderId"], message: "x" }])).toBeNull();
  });
});

describe("adjustPricesSchema", () => {
  const ID = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";
  const one = { lineId: ID, expectedUnitPrice: 100, price: "1" };

  it("tidies the note and drops a blank one", () => {
    const base = { orderId: ID, expectedTotal: 0, lines: [one] };
    expect(adjustPricesSchema.parse({ ...base, note: "  مشروع   كبير " }).note).toBe("مشروع كبير");
    expect(adjustPricesSchema.parse({ ...base, note: "   " }).note).toBeUndefined();
    expect(adjustPricesSchema.safeParse({ ...base, note: "س".repeat(201) }).success).toBe(false);
  });

  it("refuses no lines, a repeated line, and more than 100", () => {
    const base = { orderId: ID, expectedTotal: 0 };
    expect(adjustPricesSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(adjustPricesSchema.safeParse({ ...base, lines: [one, one] }).success).toBe(false);
    expect(
      adjustPricesSchema.safeParse({ ...base, lines: Array.from({ length: 101 }, () => one) })
        .success,
    ).toBe(false);
  });
});

describe("priceNotice", () => {
  it("refreshes for locked, stale, and not_electrician, and keeps edit mode otherwise", () => {
    expect(priceNotice("locked", false)).toEqual({ key: "pricesLocked", refresh: true });
    expect(priceNotice("stale", false)).toEqual({ key: "pricesStale", refresh: true });
    expect(priceNotice("not_electrician", false)).toEqual({
      key: "pricesNotElectrician",
      refresh: true,
    });
    expect(priceNotice("no_change", false)).toEqual({ key: "pricesNoChange", refresh: false });
    expect(priceNotice("below_paid", false)).toEqual({ key: "pricesBelowPaid", refresh: false });
    expect(priceNotice("not_found", false)).toEqual({ key: "pricesSaveFailed", refresh: false });
    expect(priceNotice("invalid", false)).toEqual({ key: "pricesSaveFailed", refresh: false });
  });

  it("shows nothing for forbidden or for line errors the fields show", () => {
    expect(priceNotice("forbidden", false)).toBeNull();
    expect(priceNotice("invalid", true)).toBeNull();
  });
});
