import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/form-errors";
import { qrImageSrc, signInSchema, verifyTotpSchema } from "./schemas";

// covers: AC-1 (spec 0004)
describe("signInSchema", () => {
  it("trims and lowercases the email, keeps the password as typed", () => {
    expect(
      signInSchema.parse({ email: "  Owner@SKF.ps ", password: " secret ", next: "" }),
    ).toEqual({ email: "owner@skf.ps", password: " secret ", next: undefined });
  });

  it("reports a missing or malformed email and a missing password by code", () => {
    const empty = signInSchema.safeParse({ email: "", password: "" });
    expect(empty.success || fieldErrorsOf(empty.error)).toEqual({
      email: { code: "required" },
      password: { code: "required" },
    });

    const malformed = signInSchema.safeParse({ email: "owner", password: "x" });
    expect(malformed.success || fieldErrorsOf(malformed.error)).toEqual({
      email: { code: "email_invalid" },
    });
  });
});

describe("verifyTotpSchema", () => {
  const factorId = "0b8f4b0e-5d1c-4b52-9a8e-2f1e3d4c5b6a";

  it.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    ["١٢٣٤٥٦", "123456"],
    [" ١٢٣ ٤٥٦ ", "123456"],
  ])("reads %j as %j", (code, expected) => {
    expect(verifyTotpSchema.parse({ factorId, code }).code).toBe(expected);
  });

  it.each(["", "12345", "1234567", "12a456"])("refuses %j", (code) => {
    const result = verifyTotpSchema.safeParse({ factorId, code });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsOf(result.error).code?.code).toBe(code ? "totp_format" : "required");
    }
  });

  it("needs a factor id", () => {
    expect(verifyTotpSchema.safeParse({ factorId: "x", code: "123456" }).success).toBe(false);
  });
});

describe("qrImageSrc", () => {
  it("keeps a data URL", () => {
    const url = "data:image/svg+xml;utf-8,<svg></svg>";
    expect(qrImageSrc(url)).toBe(url);
  });

  it("wraps bare SVG markup in an encoded data URL", () => {
    expect(qrImageSrc('<svg a="1"></svg>')).toBe(
      "data:image/svg+xml;utf-8,%3Csvg%20a%3D%221%22%3E%3C%2Fsvg%3E",
    );
  });
});
