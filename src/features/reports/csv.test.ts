import { describe, expect, it } from "vitest";
import { CSV_COLUMNS, csvCell, csvHeader, orderCsvRow, toCsv, type CsvLabels } from "./csv";
import type { ExportOrder } from "./server/queries";

// covers: AC-9, AC-14 (spec 0024)

const labels: CsvLabels = {
  header: Object.fromEntries(
    CSV_COLUMNS.map((column) => [column, `h-${column}`]),
  ) as CsvLabels["header"],
  status: {
    new: "جديد",
    confirmed: "تم التأكيد",
    preparing: "قيد التجهيز",
    ready: "جاهز",
    out_for_delivery: "قيد التوصيل",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  },
  yes: "نعم",
  no: "لا",
  type: { customer: "عميل", electrician: "كهربائي", admin: "المتجر", guest: "زائر" },
  fulfilment: { delivery: "توصيل", pickup: "استلام من المتجر" },
};

const order: ExportOrder = {
  orderNumber: "26-00012",
  // 21:30 on the 5th in Hebron (UTC+2 in November).
  placedAt: new Date("2026-11-05T19:30:00Z"),
  status: "preparing",
  placedByRole: null,
  customerName: "سامي عودة",
  fulfilment: "delivery",
  subtotal: 125_000,
  discountTotal: 1_010,
  deliveryFee: 2_000,
  total: 125_990,
  amountPaid: 50_000,
};

describe("csvCell", () => {
  it("leaves a plain cell alone", () => {
    expect(csvCell("سامي")).toBe("سامي");
  });

  it("quotes a comma, a quote, and a line break, doubling quotes", () => {
    expect(csvCell("أ، ب,ج")).toBe('"أ، ب,ج"');
    expect(csvCell('محل "النور"')).toBe('"محل ""النور"""');
    expect(csvCell("سطر\nثان")).toBe('"سطر\nثان"');
    expect(csvCell("سطر\r\nثان")).toBe('"سطر\r\nثان"');
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("guards a text cell starting with %j", (lead) => {
    expect(csvCell(`${lead}1+1`).replace(/^"/, "")).toMatch(/^'/);
  });

  it("guards after leading spaces, and quotes what still needs it", () => {
    expect(csvCell('  =HYPERLINK("x")')).toBe(`"'  =HYPERLINK(""x"")"`);
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });

  it("never guards a money cell", () => {
    expect(csvCell("-5", "money")).toBe("-5");
  });
});

describe("toCsv", () => {
  it("starts with a byte order mark and ends every line with CRLF", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe("\uFEFFa,b\r\nc,d\r\n");
  });

  it("gives the header row only for an empty period", () => {
    const file = toCsv([csvHeader(labels)]);
    expect(file).toBe(`\uFEFF${CSV_COLUMNS.map((column) => `h-${column}`).join(",")}\r\n`);
  });
});

describe("orderCsvRow", () => {
  it("writes every column in order, money as plain shekels", () => {
    expect(orderCsvRow(order, labels)).toEqual([
      "26-00012",
      "2026-11-05",
      "9:30 م",
      "قيد التجهيز",
      "نعم",
      "زائر",
      "سامي عودة",
      "توصيل",
      "1250",
      "10.10",
      "20",
      "1259.90",
      "500",
      "759.90",
    ]);
  });

  it("marks a cancelled order not counted and leaves المتبقي empty", () => {
    const row = orderCsvRow({ ...order, status: "cancelled" }, labels);
    expect(row[3]).toBe("ملغي");
    expect(row[4]).toBe("لا");
    expect(row[13]).toBe("");
  });

  it("names each placed by role", () => {
    const type = (placedByRole: ExportOrder["placedByRole"]) =>
      orderCsvRow({ ...order, placedByRole }, labels)[5];
    expect([type("customer"), type("electrician"), type("admin"), type(null)]).toEqual([
      "عميل",
      "كهربائي",
      "المتجر",
      "زائر",
    ]);
  });

  it("guards a customer name that would run as a formula", () => {
    expect(orderCsvRow({ ...order, customerName: "=HYPERLINK(1)" }, labels)[6]).toBe(
      "'=HYPERLINK(1)",
    );
  });

  it("writes the shop day, not the UTC day, near midnight", () => {
    // 00:10 on the 6th in Hebron is still the 5th in UTC.
    const row = orderCsvRow({ ...order, placedAt: new Date("2026-11-05T22:10:00Z") }, labels);
    expect(row[1]).toBe("2026-11-06");
    expect(row[2]).toBe("12:10 ص");
  });
});
