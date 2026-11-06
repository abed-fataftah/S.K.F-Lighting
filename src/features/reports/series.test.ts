import { describe, expect, it } from "vitest";
import {
  averageOrderValue,
  axisLabelIndexes,
  barHeights,
  bucketsFor,
  fillDaySeries,
  rollUpMonths,
} from "./series";

// covers: AC-5, AC-6, AC-14 (spec 0024)

describe("averageOrderValue", () => {
  it("is null with no orders", () => {
    expect(averageOrderValue(0, 0)).toBeNull();
  });

  it("divides an exact amount", () => {
    expect(averageOrderValue(75_000, 3)).toBe(25_000);
  });

  it("rounds to the nearest agora, half up", () => {
    // 1001 / 2 = 500.5 → 501; 1000 / 3 = 333.33 → 333; 2000 / 3 = 666.67 → 667.
    expect(averageOrderValue(1_001, 2)).toBe(501);
    expect(averageOrderValue(1_000, 3)).toBe(333);
    expect(averageOrderValue(2_000, 3)).toBe(667);
  });

  it("stays a safe integer on a large total", () => {
    const average = averageOrderValue(4_000_000_000_001, 2);
    expect(average).toBe(2_000_000_000_001);
    expect(Number.isSafeInteger(average)).toBe(true);
  });
});

describe("fillDaySeries", () => {
  it("fills missing days with 0, in order", () => {
    const rows = [
      { key: "2026-10-30", sales: 500 },
      { key: "2026-11-02", sales: 700 },
    ];
    expect(fillDaySeries(rows, { from: "2026-10-30", to: "2026-11-02" })).toEqual([
      { key: "2026-10-30", sales: 500 },
      { key: "2026-10-31", sales: 0 },
      { key: "2026-11-01", sales: 0 },
      { key: "2026-11-02", sales: 700 },
    ]);
  });

  it("gives one bar for one day", () => {
    expect(fillDaySeries([], { from: "2026-11-06", to: "2026-11-06" })).toEqual([
      { key: "2026-11-06", sales: 0 },
    ]);
  });
});

describe("rollUpMonths", () => {
  it("sums days into months, a partial first and last month holding only their days", () => {
    const days = fillDaySeries(
      [
        { key: "2026-10-30", sales: 100 },
        { key: "2026-10-31", sales: 200 },
        { key: "2026-11-15", sales: 300 },
        { key: "2026-12-02", sales: 400 },
      ],
      { from: "2026-10-30", to: "2026-12-02" },
    );
    expect(rollUpMonths(days)).toEqual([
      { key: "2026-10", sales: 300 },
      { key: "2026-11", sales: 300 },
      { key: "2026-12", sales: 400 },
    ]);
  });

  it("runs across a year end", () => {
    const days = fillDaySeries(
      [
        { key: "2026-12-31", sales: 50 },
        { key: "2027-01-01", sales: 70 },
      ],
      { from: "2026-12-31", to: "2027-01-01" },
    );
    expect(rollUpMonths(days)).toEqual([
      { key: "2026-12", sales: 50 },
      { key: "2027-01", sales: 70 },
    ]);
  });
});

describe("bucketsFor", () => {
  it("switches to months above 62 days", () => {
    expect(bucketsFor({ from: "2026-09-01", to: "2026-11-01" })).toBe("day"); // 62 days
    expect(bucketsFor({ from: "2026-09-01", to: "2026-11-02" })).toBe("month"); // 63 days
    expect(bucketsFor({ from: "2026-11-06", to: "2026-11-06" })).toBe("day");
  });
});

describe("barHeights", () => {
  it("is all zero when every value is zero", () => {
    expect(barHeights([0, 0, 0])).toEqual([0, 0, 0]);
    expect(barHeights([])).toEqual([]);
  });

  it("gives one bar the full height", () => {
    expect(barHeights([4_200])).toEqual([1]);
  });

  it("shares the highest value", () => {
    expect(barHeights([0, 50, 200, 100])).toEqual([0, 0.25, 1, 0.5]);
  });
});

describe("axisLabelIndexes", () => {
  it("labels every bar up to 14", () => {
    expect(axisLabelIndexes(1)).toEqual([0]);
    expect(axisLabelIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(axisLabelIndexes(14)).toHaveLength(14);
  });

  it("labels every ceil(n / 7)th bar from the first above 14", () => {
    expect(axisLabelIndexes(15)).toEqual([0, 3, 6, 9, 12]);
    expect(axisLabelIndexes(30)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(axisLabelIndexes(62)).toEqual([0, 9, 18, 27, 36, 45, 54]);
  });

  it("is empty with no bars", () => {
    expect(axisLabelIndexes(0)).toEqual([]);
  });
});
