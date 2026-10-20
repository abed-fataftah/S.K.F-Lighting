import { describe, expect, it } from "vitest";
import { fieldErrorsOf, formValues } from "@/lib/form-errors";
import { checkoutSchema } from "./schemas";

// covers: AC-6, AC-12 (spec 0004); AC-9, AC-10 (spec 0005)

const KEY = "3f6c1a52-8e1b-4c1e-9a55-2b1f0e7d9c11";
const ZONE = "8a1d2b3c-4d5e-4f60-8a71-b2c3d4e5f607";

const pickup = {
  idempotencyKey: KEY,
  name: "أحمد خليل",
  phone: "0599 123 456",
  fulfilment: "pickup",
  notes: "",
  expectedTotal: "12500",
};

const delivery = {
  ...pickup,
  fulfilment: "delivery",
  zoneId: ZONE,
  city: "رام الله",
  address: "شارع الإرسال، بناية 4",
};

const errorsOf = (input: Record<string, unknown>) => {
  const result = checkoutSchema.safeParse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("checkoutSchema", () => {
  it("parses a pickup order and drops any delivery fields sent with it", () => {
    const result = checkoutSchema.parse({ ...pickup, zoneId: ZONE, city: "نابلس", address: "x" });
    expect(result).toEqual({
      idempotencyKey: KEY,
      name: "أحمد خليل",
      phone: { typed: "0599 123 456", e164: "+970599123456" },
      fulfilment: "pickup",
      notes: undefined,
      expectedTotal: 12_500,
    });
  });

  it("parses a delivery order with zone, city, and address", () => {
    expect(checkoutSchema.parse(delivery)).toMatchObject({
      fulfilment: "delivery",
      zoneId: ZONE,
      city: "رام الله",
      address: "شارع الإرسال، بناية 4",
    });
  });

  it.each([
    ["٠٥٩٩١٢٣٤٥٦", "0599123456"],
    ["‏0599 123 456", "0599 123 456"],
    ["+972 52 123 4567", "+972 52 123 4567"],
  ])("cleans the phone %j to %j and keeps its E.164 form", (typed, cleaned) => {
    const { phone } = checkoutSchema.parse({ ...pickup, phone: typed });
    expect(phone.typed).toBe(cleaned);
    expect(phone.e164).toMatch(/^\+97[02]5\d{8}$/);
  });

  it("asks for a mobile number on a landline, and says required when empty", () => {
    expect(errorsOf({ ...pickup, phone: "02 298 1234" }).phone).toEqual({ code: "phone_mobile" });
    expect(errorsOf({ ...pickup, phone: "  " }).phone).toEqual({ code: "required" });
  });

  it("removes line breaks from name, city, and address but keeps them in notes", () => {
    const result = checkoutSchema.parse({
      ...delivery,
      name: "أحمد\nخليل",
      city: "رام\r\nالله",
      address: "شارع\nالإرسال",
      notes: "الطابق الثاني\nبعد الظهر",
    });
    expect(result).toMatchObject({
      name: "أحمد خليل",
      city: "رام الله",
      address: "شارع الإرسال",
      notes: "الطابق الثاني\nبعد الظهر",
    });
  });

  it("checks every limit after tidying", () => {
    expect(errorsOf({ ...pickup, name: " أ " }).name).toEqual({
      code: "too_short",
      params: { min: 2 },
    });
    expect(errorsOf({ ...pickup, name: "ا".repeat(81) }).name).toEqual({
      code: "too_long",
      params: { max: 80 },
    });
    expect(errorsOf({ ...pickup, notes: "ا".repeat(501) }).notes?.code).toBe("too_long");
    expect(errorsOf({ ...delivery, city: "ر" }).city?.code).toBe("too_short");
    expect(errorsOf({ ...delivery, address: "شارع" }).address?.code).toBe("too_short");
    expect(errorsOf({ ...delivery, address: "ا".repeat(301) }).address?.code).toBe("too_long");
  });

  it("needs a zone, city, and address for delivery", () => {
    const errors = errorsOf({ ...pickup, fulfilment: "delivery" });
    expect(errors.zoneId).toEqual({ code: "zone_required" });
    expect(errors.city).toEqual({ code: "required" });
    expect(errors.address).toEqual({ code: "required" });
  });

  it("refuses an unknown method, a bad key, and a negative total", () => {
    expect(errorsOf({ ...pickup, fulfilment: "drone" }).fulfilment).toBeDefined();
    expect(errorsOf({ ...pickup, idempotencyKey: "abc" }).idempotencyKey).toBeDefined();
    expect(errorsOf({ ...pickup, expectedTotal: "-1" }).expectedTotal).toBeDefined();
  });

  it("never puts a typed value in an error", () => {
    const errors = errorsOf({ ...pickup, phone: "0222222", name: "x" });
    expect(JSON.stringify(errors)).not.toMatch(/0222222/);
  });
});

describe("formValues", () => {
  it("keeps string fields and skips React's internal ones", () => {
    const data = new FormData();
    data.set("name", "أحمد");
    data.set("$ACTION_ID_1", "");
    expect(formValues(data)).toEqual({ name: "أحمد" });
  });
});
