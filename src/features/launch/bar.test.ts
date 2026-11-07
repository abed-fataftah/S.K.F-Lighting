import { describe, expect, it } from "vitest";
import { judgePage, LAUNCH_BAR, type PageMetrics } from "./bar";

const atLimits: PageMetrics = {
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  performance: 0.8,
  accessibility: 0.95,
};

// covers: AC-14 (spec 0028): the five measures and their exact limits.
describe("judgePage", () => {
  it("holds the decided bar", () => {
    expect(LAUNCH_BAR).toEqual({
      lcpMs: 2500,
      cls: 0.1,
      tbtMs: 200,
      performance: 0.8,
      accessibility: 0.95,
    });
  });

  it("passes exactly at every limit, and well inside them", () => {
    expect(judgePage(atLimits)).toEqual({ pass: true, failures: [] });
    expect(judgePage({ lcpMs: 1200, cls: 0, tbtMs: 0, performance: 1, accessibility: 1 })).toEqual({
      pass: true,
      failures: [],
    });
  });

  it.each([
    ["lcpMs", { lcpMs: 2501 }],
    ["cls", { cls: 0.11 }],
    ["tbtMs", { tbtMs: 201 }],
    ["performance", { performance: 0.79 }],
    ["accessibility", { accessibility: 0.94 }],
  ] as const)("fails just past the %s limit", (measure, change) => {
    expect(judgePage({ ...atLimits, ...change })).toEqual({ pass: false, failures: [measure] });
  });

  it("fails a measure Lighthouse could not take", () => {
    expect(judgePage({ ...atLimits, performance: null, lcpMs: null })).toEqual({
      pass: false,
      failures: ["lcpMs", "performance"],
    });
  });

  it("lists every failure in a fixed order", () => {
    expect(
      judgePage({ lcpMs: 4000, cls: 0.3, tbtMs: 600, performance: 0.4, accessibility: 0.8 })
        .failures,
    ).toEqual(["lcpMs", "cls", "tbtMs", "performance", "accessibility"]);
  });
});
