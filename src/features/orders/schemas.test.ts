import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/form-errors";
import { orderLookupSchema } from "./schemas";

// covers: AC-2, AC-3, AC-5 (spec 0015). The lookup form's schema, shared by the action.

const errorsOf = (input: Record<string, string>) => {
  const result = orderLookupSchema.safeParse(input);
  return result.success ? {} : fieldErrorsOf(result.error);
};

describe("orderLookupSchema", () => {
  it.each(["0599123456", "+970599123456", "٠٥٩٩١٢٣٤٥٦", "059 912 3456"])(
    "reads the phone %j as one E.164",
    (phone) => {
      const result = orderLookupSchema.parse({ number: "2600042", phone });
      expect(result).toEqual({
        number: "26-00042",
        phone: { typed: expect.any(String), e164: "+970599123456" },
      });
    },
  );

  it("asks for the number when it is blank", () => {
    expect(errorsOf({ number: "  ", phone: "0599123456" })).toEqual({
      number: { code: "number_required" },
    });
  });

  it("refuses a number the parser does not accept", () => {
    expect(errorsOf({ number: "26/00042", phone: "0599123456" })).toEqual({
      number: { code: "number_format" },
    });
  });

  it("asks for the phone when it is blank and refuses one that is not a mobile", () => {
    expect(errorsOf({ number: "26-00042", phone: "" })).toEqual({ phone: { code: "required" } });
    expect(errorsOf({ number: "26-00042", phone: "123" })).toEqual({
      phone: { code: "phone_mobile" },
    });
  });

  it("reports both fields at once", () => {
    expect(Object.keys(errorsOf({ number: "", phone: "" }))).toEqual(["number", "phone"]);
  });

  it("treats a missing field as required", () => {
    expect(errorsOf({})).toEqual({ number: { code: "required" }, phone: { code: "required" } });
  });
});
