import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import {
  fieldMessageKey,
  paymentFieldErrors,
  paymentNotice,
  paymentSchema,
  reversalSchema,
  type PaymentError,
  type PaymentField,
  type PaymentFieldError,
} from "./schemas";

const ids = {
  paymentId: "6f1d2a8e-3b4c-4d5e-8f60-718293a4b5c6",
  orderId: "0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3",
};

const TODAY = "2026-11-05";

const base = {
  ...ids,
  kind: "payment" as const,
  expectedAmountPaid: 0,
  amount: "100",
  method: "cash" as const,
  receivedOn: TODAY,
};

const errorsOf = (
  input: unknown,
  options: Parameters<typeof paymentSchema>[0] = { today: TODAY },
) => {
  const parsed = paymentSchema(options).safeParse(input);
  return parsed.success ? null : paymentFieldErrors(parsed.error);
};

// covers: AC-3, AC-4 (spec 0023)
describe("paymentSchema", () => {
  it("parses a cash payment to agorot and drops any cheque fields", () => {
    const parsed = paymentSchema({ today: TODAY }).parse({
      ...base,
      amount: "1,250.5",
      chequeNumber: "123",
      chequeBank: "بنك فلسطين",
      chequeDueDate: "2026-12-01",
      note: "  دفعة أولى  ",
    });
    expect(parsed).toMatchObject({
      amount: 125_050,
      method: "cash",
      cheque: null,
      note: "دفعة أولى",
    });
  });

  it("requires all three cheque fields for a cheque, and keeps them tidied", () => {
    expect(errorsOf({ ...base, method: "cheque" })).toEqual({
      chequeNumber: "required",
      chequeBank: "required",
      chequeDueDate: "required",
    });
    const parsed = paymentSchema({ today: TODAY }).parse({
      ...base,
      method: "cheque",
      chequeNumber: "٠٠١٢٣٤",
      chequeBank: " بنك  القدس ",
      chequeDueDate: "2027-01-15",
    });
    expect(parsed.cheque).toEqual({ number: "001234", bank: "بنك القدس", dueDate: "2027-01-15" });
  });

  it("takes a cheque date before the payment date, and refuses a day that does not exist", () => {
    expect(
      errorsOf({
        ...base,
        method: "cheque",
        chequeNumber: "1",
        chequeBank: "بنك",
        chequeDueDate: "2025-01-01",
      }),
    ).toBeNull();
    expect(
      errorsOf({
        ...base,
        method: "cheque",
        chequeNumber: "1",
        chequeBank: "بنك",
        chequeDueDate: "2026-02-30",
      }),
    ).toEqual({ chequeDueDate: "required" });
  });

  it("reads Arabic digits in the amount", () => {
    expect(paymentSchema({ today: TODAY }).parse({ ...base, amount: "١٢٫٥" }).amount).toBe(1_250);
  });

  it.each([
    ["", "required"],
    ["   ", "required"],
    ["0", "amount_invalid"],
    ["0.00", "amount_invalid"],
    ["-5", "amount_invalid"],
    ["12.345", "amount_invalid"],
    ["abc", "amount_invalid"],
  ] as const)("refuses the amount %j as %s", (amount, code) => {
    expect(errorsOf({ ...base, amount })).toEqual({ amount: code });
  });

  it("checks the limit only when the browser passes one", () => {
    expect(errorsOf({ ...base, amount: "151" }, { today: TODAY, limit: 15_000 })).toEqual({
      amount: "too_much",
    });
    expect(errorsOf({ ...base, amount: "150" }, { today: TODAY, limit: 15_000 })).toBeNull();
    expect(errorsOf({ ...base, amount: "151" })).toBeNull();
  });

  it("refuses a date after today, before the order's day, or missing", () => {
    expect(errorsOf({ ...base, receivedOn: "2026-11-06" })).toEqual({ receivedOn: "date_future" });
    expect(
      errorsOf({ ...base, receivedOn: "2026-10-31" }, { today: TODAY, minDay: "2026-11-01" }),
    ).toEqual({ receivedOn: "before_order" });
    expect(errorsOf({ ...base, receivedOn: "" })).toEqual({ receivedOn: "required" });
    expect(
      errorsOf({ ...base, receivedOn: "2026-11-01" }, { today: TODAY, minDay: "2026-11-01" }),
    ).toBeNull();
  });

  it("marks every problem at once", () => {
    expect(
      errorsOf({ ...base, amount: "", method: "cheque", chequeBank: "بنك", receivedOn: "x" }),
    ).toEqual({
      amount: "required",
      chequeNumber: "required",
      chequeDueDate: "required",
      receivedOn: "required",
    });
  });

  it("keeps a blank note as none and refuses one over 200 characters", () => {
    expect(paymentSchema({ today: TODAY }).parse({ ...base, note: "   " }).note).toBeUndefined();
    expect(errorsOf({ ...base, note: "ن".repeat(201) })).toEqual({ note: "too_long" });
  });

  it("refuses a broken shape without field errors", () => {
    expect(errorsOf({ ...base, paymentId: "nope" })).toEqual({});
    expect(errorsOf({ ...base, kind: "reversal" })).toEqual({});
  });
});

// covers: AC-6 (spec 0023)
describe("reversalSchema", () => {
  const reversal = {
    reversalId: ids.paymentId,
    orderId: ids.orderId,
    paymentId: "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5",
    expectedAmountPaid: 10_000,
  };

  it("needs a reason, tidied", () => {
    expect(reversalSchema.parse({ ...reversal, reason: "  شيك  مرتجع " }).reason).toBe("شيك مرتجع");
    const parsed = reversalSchema.safeParse({ ...reversal, reason: "  " });
    expect(parsed.success ? null : paymentFieldErrors(parsed.error)).toEqual({
      reason: "required",
    });
  });
});

const t = createTranslator({ locale: "ar", messages: ar, namespace: "AdminPayments" });

// covers: AC-3, AC-6, AC-7 (spec 0023)
describe("fieldMessageKey", () => {
  it.each([
    ["amount", "required", "payment", "أدخل المبلغ."],
    ["amount", "amount_invalid", "payment", "اكتب مبلغاً صحيحاً."],
    ["amount", "too_much", "payment", "المبلغ أكبر من المتبقي (₪150)."],
    ["amount", "too_much", "refund", "المبلغ أكبر من المدفوع (₪150)."],
    ["chequeNumber", "required", "payment", "أدخل رقم الشيك."],
    ["chequeBank", "required", "payment", "أدخل اسم البنك."],
    ["chequeDueDate", "required", "payment", "أدخل تاريخ الشيك."],
    ["receivedOn", "required", "payment", "أدخل التاريخ."],
    ["receivedOn", "date_future", "payment", "لا يمكن أن يكون التاريخ بعد اليوم."],
    ["receivedOn", "before_order", "payment", "التاريخ قبل تاريخ الطلب."],
    ["reason", "required", "payment", "اكتب سبب العكس."],
  ] as const satisfies readonly (readonly [PaymentField, PaymentFieldError, string, string])[])(
    "%s %s (%s)",
    (field, code, kind, text) => {
      const key = fieldMessageKey(field, code, kind);
      expect(t.markup(`errors.${key}`, { limit: "₪150", ltr: (chunks) => chunks })).toBe(text);
    },
  );
});

// covers: AC-7 (spec 0023)
describe("paymentNotice", () => {
  it.each([
    ["forbidden", false, null],
    ["too_much", false, null],
    ["invalid", true, null],
    ["invalid", false, { key: "failed", refresh: false }],
    ["not_found", false, { key: "notFound", refresh: true }],
    ["not_allowed", false, { key: "notAllowed", refresh: true }],
    ["stale", false, { key: "stale", refresh: true }],
    ["is_reversal", false, { key: "reversed", refresh: true }],
    ["already_reversed", false, { key: "reversed", refresh: true }],
    ["out_of_range", false, { key: "outOfRange", refresh: false }],
  ] as const satisfies readonly (readonly [PaymentError, boolean, unknown])[])(
    "%s (field errors: %s)",
    (error, hasFieldErrors, notice) => {
      expect(paymentNotice(error, hasFieldErrors)).toEqual(notice);
    },
  );
});
