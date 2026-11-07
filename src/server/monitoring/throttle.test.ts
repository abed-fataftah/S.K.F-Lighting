import { describe, expect, it } from "vitest";
import { errorName, failureOf, mayReport, REPORT_WINDOW_MS } from "./throttle";

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

describe("failureOf", () => {
  it("reports the thrown cause of a failed read, so it keeps its stack", () => {
    const cause = new Error("db down");
    expect(failureOf({ error: "failed", cause })).toBe(cause);
  });

  it("reports the code of a timeout, or of a failure with no Error behind it", () => {
    expect(failureOf({ error: "timeout" })).toBe("timeout");
    expect(failureOf({ error: "failed" })).toBe("failed");
    expect(failureOf({ error: "failed", cause: "0599 123 456" })).toBe("failed");
  });
});

describe("errorName", () => {
  it.each([
    [new TypeError("x"), "TypeError"],
    ["timeout", "timeout"],
    ["http_500", "http_500"],
    ["0599 123 456", "unknown"],
    ["Hebron, Ein Sara St", "unknown"],
    [{ code: 1 }, "unknown"],
    [undefined, "unknown"],
  ])("names %o as %s", (error, name) => {
    expect(errorName(error)).toBe(name);
  });
});
