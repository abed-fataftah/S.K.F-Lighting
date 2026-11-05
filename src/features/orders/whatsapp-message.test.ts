import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  buildNewOrderMessage,
  MAX_WHATSAPP_URL,
  type MessageOrder,
  type OrderMessageContext,
} from "./whatsapp-message";

// covers: AC-12, AC-14 (spec 0004); AC-6 (spec 0005)

const translate = createTranslator({ locale: "ar", messages: ar, namespace: "OrderMessage" });
const context: OrderMessageContext = {
  siteUrl: "https://skf.example",
  whatsappNumber: "970500000000",
  t: (key, values) => translate(key, values),
};

const line = {
  productName: "ثريا كريستال",
  sizeLabel: null,
  colourName: null,
  quantity: 2,
  lineTotal: 250_000,
};

const pickup: MessageOrder = {
  orderNumber: "26-00042",
  customerName: "أحمد خليل",
  customerPhone: "0599 123 456",
  fulfilment: "pickup",
  deliveryZoneName: null,
  city: null,
  address: null,
  deliveryFee: 0,
  notes: null,
  total: 250_000,
  lines: [line],
};

const delivery: MessageOrder = {
  ...pickup,
  fulfilment: "delivery",
  deliveryZoneName: "الضفة الغربية",
  city: "رام الله",
  address: "شارع الإرسال، بناية 4",
  deliveryFee: 2000,
  notes: "الطابق الثاني\nبعد الظهر",
  total: 252_000,
  lines: [
    line,
    {
      ...line,
      productName: "سبوت",
      sizeLabel: "XL",
      colourName: "ذهبي",
      quantity: 1,
      lineTotal: 1990,
    },
  ],
};

describe("buildNewOrderMessage", () => {
  it("writes a pickup order line by line, with no fee or notes line", () => {
    expect(buildNewOrderMessage(pickup, context)).toBe(
      [
        "طلب جديد رقم 26-00042",
        "الاسم: أحمد خليل",
        "الهاتف: 0599 123 456",
        "الاستلام: استلام من المعرض",
        "ثريا كريستال | الكمية 2 | ₪2,500",
        "الإجمالي: ₪2,500",
        "رابط الطلب: https://skf.example/orders/26-00042",
      ].join("\n"),
    );
  });

  it("writes a delivery order with size, colour, fee, and notes", () => {
    expect(buildNewOrderMessage(delivery, context)).toBe(
      [
        "طلب جديد رقم 26-00042",
        "الاسم: أحمد خليل",
        "الهاتف: 0599 123 456",
        "الاستلام: توصيل إلى الضفة الغربية، رام الله، شارع الإرسال، بناية 4",
        "ثريا كريستال | الكمية 2 | ₪2,500",
        "سبوت | XL | ذهبي | الكمية 1 | ₪19.90",
        "التوصيل: ₪20",
        "ملاحظات: الطابق الثاني\nبعد الظهر",
        "الإجمالي: ₪2,520",
        "رابط الطلب: https://skf.example/orders/26-00042",
      ].join("\n"),
    );
  });

  it("has no trailing newline and no hidden direction marks", () => {
    const text = buildNewOrderMessage(delivery, context);
    expect(text.endsWith("\n")).toBe(false);
    expect(text).not.toMatch(/[؜​-‏‪-‮⁠-⁩﻿]/);
  });

  it("drops the product lines when the full link would pass 1,800 characters", () => {
    const big: MessageOrder = {
      ...delivery,
      lines: Array.from({ length: 30 }, (_, i) => ({
        ...line,
        productName: `ثريا كريستال فاخرة رقم ${i + 1}`,
      })),
    };
    const text = buildNewOrderMessage(big, context);
    expect(whatsappUrl(context.whatsappNumber, text).length).toBeLessThanOrEqual(MAX_WHATSAPP_URL);
    expect(text).not.toMatch(/الكمية/);
    expect(text.split("\n")).toEqual([
      "طلب جديد رقم 26-00042",
      "الاسم: أحمد خليل",
      "الهاتف: 0599 123 456",
      "الاستلام: توصيل إلى الضفة الغربية، رام الله، شارع الإرسال، بناية 4",
      "التوصيل: ₪20",
      "ملاحظات: الطابق الثاني",
      "بعد الظهر",
      "الإجمالي: ₪2,520",
      "رابط الطلب: https://skf.example/orders/26-00042",
    ]);
  });

  it("keeps the full form when it fits", () => {
    const text = buildNewOrderMessage(delivery, context);
    expect(whatsappUrl(context.whatsappNumber, text).length).toBeLessThanOrEqual(MAX_WHATSAPP_URL);
    expect(text).toMatch(/الكمية 2/);
  });

  it("treats ICU syntax in customer text as plain text", () => {
    const text = buildNewOrderMessage({ ...pickup, customerName: "{name} أحمد" }, context);
    expect(text).toContain("الاسم: {name} أحمد");
  });
});
