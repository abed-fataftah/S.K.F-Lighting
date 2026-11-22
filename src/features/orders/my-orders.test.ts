import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
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
    // Spec 0023 AC-13: a cancelled order shows only the money still owed back.
    ["cancelled", 0, 25_000, { kind: "none" }],
    ["cancelled", 10_000, 25_000, { kind: "refund", amount: 10_000 }],
    ["cancelled", 25_000, 25_000, { kind: "refund", amount: 25_000 }],
    // Everything paid on a cancelled order is owed back, even past the total.
    ["cancelled", 30_000, 25_000, { kind: "refund", amount: 30_000 }],
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

  it("points a later step at the first card it adds", () => {
    expect(myOrdersStep(2, 40, 50)).toEqual({ hasMore: true, nextPage: 3, nextPosition: 41 });
  });

  it("still offers more on the step just before the cap", () => {
    expect(myOrdersStep(999, 19_980, 25_000).hasMore).toBe(true);
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

// covers: AC-3, AC-4, AC-5 (spec 0018). The card and list lines, with the price kept left to right.
describe("the My Orders lines", () => {
  const ltr = (chunks: string) => `[${chunks}]`;

  it("reads what is still owed, with the price in its own left to right run", () => {
    expect(t.markup("remaining", { price: formatPrice(1_000), ltr })).toBe("المتبقي [₪10]");
  });

  it("reads the money owed back on a cancelled order", () => {
    expect(t.markup("refundDue", { price: formatPrice(1_000), ltr })).toBe("مبلغ يُعاد إليك [₪10]");
  });

  it("reads a paid order", () => {
    expect(t("paid")).toBe("مدفوع");
  });

  it("names each view link by its order number", () => {
    expect(t("viewLabel", { number: "SKF-2026-0042" })).toBe("عرض الطلب SKF-2026-0042");
  });

  it("reads the count line with formatted numbers", () => {
    expect(t("shownOf", { shown: formatNumber(20), total: formatNumber(1_200) })).toBe(
      "تم عرض 20 من 1,200 طلب",
    );
  });
});
