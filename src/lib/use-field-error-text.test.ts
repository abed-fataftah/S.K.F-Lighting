import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "@/i18n/messages/ar.json";
import { fieldErrorText } from "./use-field-error-text";

// covers: AC-7, AC-13 (spec 0005)

const translate = createTranslator({ locale: "ar", messages: ar, namespace: "Validation" });
const t: Parameters<typeof fieldErrorText>[0] = (key, values) => translate(key, values);

describe("fieldErrorText", () => {
  it("passes the limits through formatNumber, so they group with commas", () => {
    expect(fieldErrorText(t, { code: "too_long", params: { max: 1250 } })).toBe(
      "النص طويل جدًا، الحد الأقصى 1,250 حرفًا",
    );
    expect(fieldErrorText(t, { code: "too_short", params: { min: 2 } })).toBe(
      "النص قصير جدًا، الحد الأدنى 2 أحرف",
    );
  });

  it("shows the plain message for a code with no limits", () => {
    expect(fieldErrorText(t, { code: "arabic_required" })).toBe("اكتب هذا الحقل بالعربية");
  });

  it("shows nothing when there is no error", () => {
    expect(fieldErrorText(t, undefined)).toBeNull();
  });
});
