import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import {
  orderSummaryView,
  type OrderSummaryContext,
  type OrderSummaryProps,
} from "./order-summary-view";

// covers: AC-5, AC-6, AC-7, AC-8 (spec 0013)

const translate = createTranslator({ locale: "ar", messages: ar, namespace: "OrderSummary" });
const context: OrderSummaryContext = {
  t: (key, values) => translate(key, values),
  formatPrice,
  formatNumber,
};

const line = {
  productName: "ثريا كريستال",
  sizeLabel: null,
  colourName: null,
  quantity: 1,
  lineTotal: 125_000,
  imageKey: null,
};

const pickup: OrderSummaryProps = {
  lines: [line],
  fulfilment: "pickup",
  deliveryZoneName: null,
  city: null,
  address: null,
  pickupAddress: "الخليل، شارع السلام",
  notes: null,
  subtotal: 125_000,
  deliveryFee: 0,
  total: 125_000,
};

const delivery: OrderSummaryProps = {
  ...pickup,
  fulfilment: "delivery",
  deliveryZoneName: "الضفة الغربية",
  city: "رام الله",
  address: "شارع الإرسال، عمارة 4",
  pickupAddress: null,
  notes: "اتصل قبل الوصول\nالطابق الثاني",
  deliveryFee: 2_000,
  total: 127_000,
};

describe("orderSummaryView rows", () => {
  it("joins size, colour, and quantity, and formats the saved line total", () => {
    const view = orderSummaryView(
      { ...pickup, lines: [{ ...line, sizeLabel: "80 سم", colourName: "ذهبي", quantity: 3 }] },
      context,
    );
    expect(view.rows).toEqual([
      {
        name: "ثريا كريستال",
        options: `80 سم · ذهبي · الكمية ${formatNumber(3)}`,
        total: formatPrice(125_000),
      },
    ]);
  });

  it.each([
    ["size only", { sizeLabel: "60 سم" }, `60 سم · الكمية ${formatNumber(1)}`],
    ["colour only", { colourName: "أسود" }, `أسود · الكمية ${formatNumber(1)}`],
    ["neither", {}, `الكمية ${formatNumber(1)}`],
  ])("leaves out empty parts (%s)", (_name, over, options) => {
    const view = orderSummaryView({ ...pickup, lines: [{ ...line, ...over }] }, context);
    expect(view.rows[0].options).toBe(options);
  });

  it("keeps the order of the lines it is given", () => {
    const view = orderSummaryView(
      { ...pickup, lines: [line, { ...line, productName: "مصباح طاولة" }] },
      context,
    );
    expect(view.rows.map((row) => row.name)).toEqual(["ثريا كريستال", "مصباح طاولة"]);
  });
});

describe("orderSummaryView receive", () => {
  it("shows pickup at the shop with its address", () => {
    expect(orderSummaryView(pickup, context).receive).toEqual({
      line: "استلام من المعرض",
      where: "الخليل، شارع السلام",
    });
  });

  it("shows no address line for pickup when the shop has none", () => {
    expect(orderSummaryView({ ...pickup, pickupAddress: null }, context).receive.where).toBeNull();
  });

  it("shows the saved zone, city, and address for delivery", () => {
    expect(orderSummaryView(delivery, context).receive).toEqual({
      line: "توصيل إلى الضفة الغربية",
      where: "رام الله، شارع الإرسال، عمارة 4",
    });
  });

  // covers: AC-10 (spec 0015). The customer's order page passes no city or address.
  it("shows only the zone for delivery when city and address are both null", () => {
    expect(orderSummaryView({ ...delivery, city: null, address: null }, context).receive).toEqual({
      line: "توصيل إلى الضفة الغربية",
      where: null,
    });
  });
});

describe("orderSummaryView notes and totals", () => {
  it("passes the notes as saved, line breaks kept, and null when there are none", () => {
    expect(orderSummaryView(delivery, context).notes).toBe("اتصل قبل الوصول\nالطابق الثاني");
    expect(orderSummaryView(pickup, context).notes).toBeNull();
  });

  it("shows the saved subtotal, fee, and total for delivery", () => {
    expect(orderSummaryView(delivery, context).totals).toEqual({
      subtotal: formatPrice(125_000),
      fee: formatPrice(2_000),
      feeIsAmount: true,
      total: formatPrice(127_000),
    });
  });

  it("shows no fee for pickup", () => {
    expect(orderSummaryView(pickup, context).totals).toMatchObject({
      fee: "بدون رسوم",
      feeIsAmount: false,
      total: formatPrice(125_000),
    });
  });

  it("never recomputes: the totals are the saved columns even when lines disagree", () => {
    const view = orderSummaryView({ ...delivery, subtotal: 1, deliveryFee: 2, total: 3 }, context);
    expect(view.totals).toMatchObject({
      subtotal: formatPrice(1),
      fee: formatPrice(2),
      total: formatPrice(3),
    });
  });
});
