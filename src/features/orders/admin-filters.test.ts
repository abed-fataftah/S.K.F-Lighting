import { describe, expect, it } from "vitest";
import { shopDayStart } from "@/lib/format";
import {
  hasOrderFilters,
  NO_ORDER_FILTERS,
  orderDays,
  orderFiltersToParams,
  parseOrderFilters,
} from "./admin-filters";

// covers: AC-1, AC-9, AC-10, AC-11, AC-12 (spec 0014)

const TODAY = "2026-10-28";
const parse = (params: Record<string, string | string[]>) => parseOrderFilters(params, TODAY);

describe("parseOrderFilters", () => {
  it("reads nothing as the plain list", () => {
    expect(parse({})).toEqual({ filters: NO_ORDER_FILTERS, days: { from: null, to: null } });
  });

  it("reads each valid value", () => {
    const { filters } = parse({
      status: "out_for_delivery",
      unseen: "1",
      range: "month",
      type: "electrician",
      method: "pickup",
      page: "3",
    });
    expect(filters).toEqual({
      status: "out_for_delivery",
      unseen: true,
      range: "month",
      from: null,
      to: null,
      type: "electrician",
      method: "pickup",
      page: 3,
    });
  });

  it("ignores every broken value, confirmed included", () => {
    expect(
      parse({
        status: "confirmed",
        unseen: "yes",
        range: "year",
        from: "2026-02-30",
        to: "2026-13-01",
        type: "admin",
        method: "post",
        page: "-2",
      }).filters,
    ).toEqual(NO_ORDER_FILTERS);
    expect(parse({ status: "NEW", from: "2026-1-05", to: "28-10-2026" }).filters).toEqual(
      NO_ORDER_FILTERS,
    );
  });

  it("takes the first of a repeated param", () => {
    expect(parse({ status: ["ready", "new"] }).filters.status).toBe("ready");
  });

  it("swaps a from after the to", () => {
    expect(parse({ from: "2026-10-20", to: "2026-10-01" }).filters).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-20",
    });
  });

  it("lets custom dates beat a preset", () => {
    const { filters, days } = parse({ range: "today", from: "2026-10-01" });
    expect(filters).toMatchObject({ range: null, from: "2026-10-01", to: null });
    expect(days).toEqual({ from: "2026-10-01", to: null });
    // A broken custom date does not beat the preset.
    expect(parse({ range: "today", from: "2026-02-30" }).filters.range).toBe("today");
  });
});

describe("orderDays", () => {
  it("resolves the presets against today on the shop's clock", () => {
    const at = (range: "today" | "7d" | "month") =>
      orderDays({ ...NO_ORDER_FILTERS, range }, TODAY);
    expect(at("today")).toEqual({ from: TODAY, to: TODAY });
    expect(at("7d")).toEqual({ from: "2026-10-22", to: TODAY });
    expect(at("month")).toEqual({ from: "2026-10-01", to: TODAY });
    expect(orderDays({ ...NO_ORDER_FILTERS, range: "7d" }, "2026-01-03")).toEqual({
      from: "2025-12-28",
      to: "2026-01-03",
    });
  });

  it("gives instants that cross the summer time change as whole shop days", () => {
    // This month started in summer time (UTC+3) and today is in winter time (UTC+2).
    const days = orderDays({ ...NO_ORDER_FILTERS, range: "month" }, TODAY);
    expect(shopDayStart(days.from!).toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(shopDayStart("2026-10-29").toISOString()).toBe("2026-10-28T22:00:00.000Z");
  });
});

describe("orderFiltersToParams", () => {
  it("writes only the custom dates when both are set, and drops page 1", () => {
    const filters = { ...NO_ORDER_FILTERS, range: "today" as const, from: "2026-10-01", page: 1 };
    expect(orderFiltersToParams(filters).toString()).toBe("from=2026-10-01");
    expect(orderFiltersToParams({ ...NO_ORDER_FILTERS, range: "7d" }).toString()).toBe("range=7d");
  });

  it("round trips through the parser", () => {
    const { filters } = parse({
      status: "new",
      unseen: "1",
      from: "2026-10-01",
      to: "2026-10-09",
      type: "customer",
      method: "delivery",
      page: "2",
    });
    const again = parse(Object.fromEntries(orderFiltersToParams(filters)));
    expect(again.filters).toEqual(filters);
  });

  it("writes a different page when asked, so changing a filter can return to page 1", () => {
    const filters = { ...NO_ORDER_FILTERS, status: "ready" as const, page: 4 };
    expect(orderFiltersToParams(filters, 1).toString()).toBe("status=ready");
    expect(orderFiltersToParams(filters, 5).toString()).toBe("status=ready&page=5");
  });
});

describe("hasOrderFilters", () => {
  it("is false only for the plain list, whatever the page", () => {
    expect(hasOrderFilters({ ...NO_ORDER_FILTERS, page: 3 })).toBe(false);
    expect(hasOrderFilters({ ...NO_ORDER_FILTERS, unseen: true })).toBe(true);
    expect(hasOrderFilters({ ...NO_ORDER_FILTERS, to: TODAY })).toBe(true);
  });
});
