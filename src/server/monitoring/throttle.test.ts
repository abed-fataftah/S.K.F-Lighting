import { describe, expect, it } from "vitest";
import { errorName, mayReport, REPORT_WINDOW_MS } from "./throttle";

// covers: AC-10 (spec 0027): at most one Sentry event per event name per minute.
describe("mayReport", () => {
  it("sends the first time", () => {
    expect(mayReport(undefined, 1_000)).toBe(true);
  });

  it("holds back a repeat inside the minute", () => {
    expect(mayReport(1_000, 1_000 + REPORT_WINDOW_MS - 1)).toBe(false);
  });

  it("sends again once the minute is over", () => {
    expect(mayReport(1_000, 1_000 + REPORT_WINDOW_MS)).toBe(true);
  });
});

describe("errorName", () => {
  it.each([
    [new TypeError("x"), "TypeError"],
    ["timeout", "timeout"],
    [{ code: 1 }, "unknown"],
    [undefined, "unknown"],
  ])("names %o as %s", (error, name) => {
    expect(errorName(error)).toBe(name);
  });
});
