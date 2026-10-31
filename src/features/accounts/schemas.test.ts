import { describe, expect, it } from "vitest";
import { fieldErrorsOf } from "@/lib/form-errors";
import {
  accountEmail,
  changePasswordSchema,
  newPassword,
  profileSchema,
  registerSchema,
  setPasswordSchema,
  signInSchema,
} from "./schemas";

// covers: AC-2, AC-5, AC-8, AC-9, AC-10 (spec 0017)

const codesOf = (schema: { safeParse: (v: unknown) => unknown }, value: unknown) => {
  const result = schema.safeParse(value) as { success: boolean; error?: never };
  return result.success ? {} : fieldErrorsOf(result.error!);
};

describe("accountEmail", () => {
  it("trims and lowercases", () => {
    expect(accountEmail.parse("  Ali@Example.COM ")).toBe("ali@example.com");
  });

  it.each([
    ["", "required"],
    ["   ", "required"],
    ["ali", "email_invalid"],
    ["ali@", "email_invalid"],
  ])("refuses %j with %s", (value, code) => {
    expect(codesOf(accountEmail, value)).toEqual({ form: { code } });
  });

  it("refuses more than 254 characters", () => {
    const email = `${"a".repeat(64)}@${"b".repeat(186)}.com`;
    expect(email.length).toBe(255);
    expect(codesOf(accountEmail, email)).toEqual({
      form: { code: "too_long", params: { max: 254 } },
    });
  });
});

describe("newPassword", () => {
  it.each(["12345678", "        ", "كلمةسرية", "a".repeat(72), "ب".repeat(36)])(
    "accepts %j",
    (value) => {
      expect(newPassword.safeParse(value).success).toBe(true);
    },
  );

  it("keeps spaces at the ends", () => {
    expect(newPassword.parse(" pass word ")).toBe(" pass word ");
  });

  it.each([
    ["", { code: "required" }],
    ["1234567", { code: "too_short", params: { min: 8 } }],
    ["a".repeat(73), { code: "password_too_long" }],
    // 37 Arabic letters are 74 bytes in UTF-8.
    ["ب".repeat(37), { code: "password_too_long" }],
  ])("refuses %j", (value, error) => {
    expect(codesOf(newPassword, value)).toEqual({ form: error });
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "أحمد يوسف",
    phone: "٠٥٩٩ ١٢٣ ٤٥٦",
    email: "Ahmad@Example.com",
    password: "a good password",
  };

  it("cleans every field and keeps the phone in both forms", () => {
    expect(registerSchema.parse({ ...valid, next: "" })).toEqual({
      name: "أحمد يوسف",
      phone: { typed: "0599 123 456", e164: "+970599123456" },
      email: "ahmad@example.com",
      password: "a good password",
      next: undefined,
    });
  });

  it("reports each field's own error", () => {
    expect(
      codesOf(registerSchema, { name: "أحمد", phone: "0222", email: "x", password: "short" }),
    ).toEqual({
      name: { code: "name_full" },
      phone: { code: "phone_mobile" },
      email: { code: "email_invalid" },
      password: { code: "too_short", params: { min: 8 } },
    });
  });
});

describe("signInSchema", () => {
  it("needs any password, without the new password rules", () => {
    expect(signInSchema.parse({ email: "a@b.co", password: "x" })).toMatchObject({
      password: "x",
    });
    expect(codesOf(signInSchema, { email: "a@b.co", password: "" })).toEqual({
      password: { code: "required" },
    });
  });
});

describe("setPasswordSchema", () => {
  it("needs the confirmation to match", () => {
    expect(codesOf(setPasswordSchema, { password: "12345678", confirm: "12345679" })).toEqual({
      confirm: { code: "password_mismatch" },
    });
    expect(setPasswordSchema.safeParse({ password: "12345678", confirm: "12345678" }).success).toBe(
      true,
    );
  });
});

describe("changePasswordSchema", () => {
  it("needs a match and a new password that differs from the current one", () => {
    expect(
      codesOf(changePasswordSchema, { current: "old pass", password: "new pass1", confirm: "x" }),
    ).toEqual({ confirm: { code: "password_mismatch" } });
    expect(
      codesOf(changePasswordSchema, {
        current: "same pass",
        password: "same pass",
        confirm: "same pass",
      }),
    ).toEqual({ password: { code: "password_same" } });
  });

  it("needs the current password", () => {
    expect(
      codesOf(changePasswordSchema, { current: "", password: "new pass1", confirm: "new pass1" }),
    ).toEqual({ current: { code: "required" } });
  });
});

describe("profileSchema", () => {
  it("uses the checkout rules for name and phone", () => {
    expect(profileSchema.parse({ name: "  سارة   علي ", phone: "+970 599 123 456" })).toEqual({
      name: "سارة علي",
      phone: { typed: "+970 599 123 456", e164: "+970599123456" },
    });
    expect(codesOf(profileSchema, { name: "سارة 2", phone: "" })).toEqual({
      name: { code: "letters_only" },
      phone: { code: "required" },
    });
  });
});
