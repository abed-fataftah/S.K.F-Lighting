import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { formatNumber } from "@/lib/format";
import { myOrdersLimit, myOrdersStep, orderMoneyLine } from "./my-orders";

const t = createTranslator({ locale: "ar", messages: ar, namespace: "MyOrders" });

// covers: AC-4 (spec 0018)
describe("orderMoneyLine", () => {
  it.each([
    ["new", 0, 25_000, { kind: "none" }],
    ["preparing", 10_000, 25_000, { kind: "remaining", amount: 15_000 }],
    ["delivered", 24_999, 25_000, { kind: "remaining", amount: 1 }],
    ["ready", 25_000, 25_000, { kind: "paid" }],
    ["delivered", 30_000, 25_000, { kind: "paid" }],
    ["cancelled", 10_000, 25_000, { kind: "none" }],
    ["cancelled", 25_000, 25_000, { kind: "none" }],
  ] as const)("reads %s with %i paid of %i", (status, paid, total, line) => {
    expect(orderMoneyLine(status, paid, total)).toEqual(line);
  });
});

// covers: AC-5 (spec 0018)
describe("myOrdersLimit", () => {
  it.each([
    [1, 20],
    [2, 40],
    [1000, 20_000],
    [999_999_999, 20_000],
  ])("shows %i steps as %i orders", (page, limit) => {
    expect(myOrdersLimit(page)).toBe(limit);
  });
});

describe("myOrdersStep", () => {
  it("offers the next page and its first new card when more exist", () => {
    expect(myOrdersStep(1, 20, 21)).toEqual({ hasMore: true, nextPage: 2, nextPosition: 21 });
  });

  it.each([
    ["everything shown", 2, 21, 21],
    ["a page past the end", 9, 21, 21],
    ["no orders", 1, 0, 0],
    ["the cap", 1000, 20_000, 25_000],
  ])("stops on %s", (_, page, shown, total) => {
    expect(myOrdersStep(page, shown, total).hasMore).toBe(false);
  });
});

// covers: AC-3 (spec 0018). Lines, not quantities, in the Arabic plural forms.
describe("the item count", () => {
  it.each([
    [1, "منتج واحد"],
    [2, "منتجان"],
    [3, "3 منتجات"],
    [10, "10 منتجات"],
    [11, "11 منتجًا"],
    [100, "100 منتج"],
    [1200, "1,200 منتج"],
  ])("reads %i lines", (count, text) => {
    expect(t("count", { count, shown: formatNumber(count) })).toBe(text);
  });
});
