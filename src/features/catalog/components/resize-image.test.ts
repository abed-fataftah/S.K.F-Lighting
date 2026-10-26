import { describe, expect, it } from "vitest";
import { cropPlan, fitWithin } from "./resize-image";

// covers: AC-8 (spec 0006)
describe("fitWithin", () => {
  it.each([
    [4000, 3000, 2000, 1500],
    [3000, 4000, 1500, 2000],
    [2000, 2000, 2000, 2000],
    [800, 600, 800, 600],
    [6000, 1, 2000, 1],
  ])("draws %ix%i at %ix%i", (w, h, width, height) => {
    expect(fitWithin(w, h, 2000)).toEqual({ width, height });
  });
});

// covers: AC-10, AC-11 (spec 0011)
describe("cropPlan", () => {
  const banner = { aspectWidth: 16, aspectHeight: 9, maxWidth: 1600, minWidth: 800 };
  const circle = { aspectWidth: 1, aspectHeight: 1, maxWidth: 800, minWidth: 400 };

  it("cuts the centred 16:9 area of a tall photo and scales it to 1600 wide", () => {
    expect(cropPlan(3000, 3000, banner)).toEqual({
      sx: 0,
      sy: 656,
      sw: 3000,
      sh: 1688,
      width: 1600,
      height: 900,
    });
  });

  it("cuts the centred area of a wide photo", () => {
    expect(cropPlan(4000, 1000, banner)).toEqual({
      sx: 1111,
      sy: 0,
      sw: 1778,
      sh: 1000,
      width: 1600,
      height: 900,
    });
  });

  it("never enlarges a picture already small enough", () => {
    expect(cropPlan(1000, 1000, banner)).toMatchObject({ width: 1000, height: 563 });
    expect(cropPlan(600, 900, circle)).toMatchObject({ sx: 0, sy: 150, width: 600, height: 600 });
  });

  it("refuses a crop narrower than the least width", () => {
    expect(cropPlan(799, 2000, banner)).toBe("too_small");
    expect(cropPlan(800, 450, banner)).not.toBe("too_small");
    expect(cropPlan(1200, 399, circle)).toBe("too_small");
  });
});
