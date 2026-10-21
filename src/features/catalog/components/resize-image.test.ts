import { describe, expect, it } from "vitest";
import { fitWithin } from "./resize-image";

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
