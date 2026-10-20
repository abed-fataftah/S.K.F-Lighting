import { describe, expect, it } from "vitest";
import { commitQuantity, stepQuantity } from "./quantity";

// covers: AC-9 (spec 0003): the stepper clamps typed values on blur and Enter.
describe("commitQuantity", () => {
  it.each([
    ["0", 1],
    ["1", 1],
    ["42", 42],
    ["99", 99],
    ["100", 99],
    ["007", 7],
    [" 5 ", 5],
    // covers: AC-9 (spec 0005)
    ["١٢", 12],
    ["۷", 7],
    ["\u200f15", 15],
  ])("turns %j into %i", (typed, expected) => {
    expect(commitQuantity(typed, 3)).toBe(expected);
  });

  it.each(["", "  ", "abc", "-4", "2.5", "١٫٥"])("keeps the last value for %j", (typed) => {
    expect(commitQuantity(typed, 3)).toBe(3);
  });
});

describe("stepQuantity", () => {
  it("steps up and down by one", () => {
    expect(stepQuantity(5, 1)).toBe(6);
    expect(stepQuantity(5, -1)).toBe(4);
  });

  it("never goes below 1 or above 99", () => {
    expect(stepQuantity(1, -1)).toBe(1);
    expect(stepQuantity(99, 1)).toBe(99);
  });
});
