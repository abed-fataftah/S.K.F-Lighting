import { describe, expect, it } from "vitest";
import { STATS_EXCLUDED_PREFIXES, statsRequest, statsWindow } from "./query";

const ids = { accountId: "acc123", siteTag: "site456" };
const week = { from: "2026-11-01", to: "2026-11-07" };

describe("statsWindow", () => {
  it("runs from the first shop day's start to the start of the day after the last", () => {
    // Shop time is UTC+2 in November, so a shop day starts at 22:00 UTC the day before.
    expect(statsWindow(week)).toEqual({
      geq: "2026-10-31T22:00:00.000Z",
      lt: "2026-11-07T22:00:00.000Z",
    });
  });

  it("follows summer time inside the window", () => {
    // Still summer time (UTC+3) on 20 October 2026.
    expect(statsWindow({ from: "2026-10-20", to: "2026-10-20" }).geq).toBe(
      "2026-10-19T21:00:00.000Z",
    );
  });
});

const andOf = (section: "visits" | "products" | "sources") =>
  statsRequest(section, ids, week).variables.filter.AND as readonly Record<string, unknown>[];

// covers: AC-5 (spec 0027): every query leaves out the same private paths.
describe("statsRequest", () => {
  it.each(["visits", "products", "sources"] as const)(
    "%s leaves out every private prefix and stays on the site and window",
    (section) => {
      expect(statsRequest(section, ids, week).variables.accountTag).toBe("acc123");
      const and = andOf(section);
      expect(and[0]).toMatchObject({
        siteTag: "site456",
        datetime_geq: statsWindow(week).geq,
        datetime_lt: statsWindow(week).lt,
      });
      expect(and.slice(1)).toEqual(
        STATS_EXCLUDED_PREFIXES.map((prefix) => ({ requestPath_notlike: `${prefix}%` })),
      );
    },
  );

  it("groups visits by hour, with room for 30 days of hours", () => {
    const { query } = statsRequest("visits", ids, week);
    expect(query).toContain("dimensions { datetimeHour }");
    expect(query).toContain("limit: 800");
  });

  it("takes the top 50 product paths by page views", () => {
    const { query } = statsRequest("products", ids, week);
    expect(query).toContain("dimensions { requestPath }");
    expect(query).toContain("limit: 50, orderBy: [count_DESC]");
    expect(andOf("products")[0]).toMatchObject({ requestPath_like: "/p/%" });
  });

  it("takes the top 50 referrer hosts by visits", () => {
    const { query } = statsRequest("sources", ids, week);
    expect(query).toContain("dimensions { refererHost }");
    expect(query).toContain("limit: 50, orderBy: [sum_visits_DESC]");
  });
});
