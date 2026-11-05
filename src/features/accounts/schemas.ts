// The account forms (spec 0017 AC-2, AC-5, AC-7 to AC-10), shared by the forms and their Server
// Actions. Name and phone are checkout's own rules, so a profile always passes checkout.
import { z } from "zod";
import { NAME_LIMITS, phoneField } from "@/features/checkout/schemas";
import { personName } from "@/lib/text-schemas";

export { HONEYPOT_FIELD } from "@/features/checkout/schemas";

export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
/** Supabase's password hash reads at most 72 bytes; an Arabic letter takes 2 of them. */
export const PASSWORD_MAX_BYTES = 72;

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

export const accountEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "required")
  .superRefine((email, ctx) => {
    if (email.length > EMAIL_MAX) {
      ctx.addIssue({ code: "custom", message: "too_long", params: { max: EMAIL_MAX } });
    } else if (!z.email().safeParse(email).success) {
      ctx.addIssue({ code: "custom", message: "email_invalid" });
    }
  });

/**
 * A new password: 8 characters or more, at most 72 bytes, no character class rules. Not trimmed:
 * a password may start or end with a space. Supabase still checks length and leaks itself.
 */
export const newPassword = z.string().superRefine((password, ctx) => {
  if (password.length === 0) {
    ctx.addIssue({ code: "custom", message: "required" });
  } else if (Array.from(password).length < PASSWORD_MIN) {
    ctx.addIssue({ code: "custom", message: "too_short", params: { min: PASSWORD_MIN } });
  } else if (utf8Bytes(password) > PASSWORD_MAX_BYTES) {
    ctx.addIssue({ code: "custom", message: "password_too_long" });
  }
});

const anyPassword = z.string().min(1, "required");

const nextField = z
  .string()
  .optional()
  .transform((value) => value || undefined);

export const accountName = personName(NAME_LIMITS);

export const registerSchema = z.object({
  name: accountName,
  phone: phoneField,
  email: accountEmail,
  password: newPassword,
  next: nextField,
});

export const signInSchema = z.object({
  email: accountEmail,
  password: anyPassword,
  next: nextField,
});

export const resetRequestSchema = z.object({ email: accountEmail });

export const setPasswordSchema = z
  .object({ password: newPassword, confirm: anyPassword })
  .refine((form) => form.password === form.confirm, {
    path: ["confirm"],
    message: "password_mismatch",
  });

export const changePasswordSchema = z
  .object({ current: anyPassword, password: newPassword, confirm: anyPassword })
  .refine((form) => form.password === form.confirm, {
    path: ["confirm"],
    message: "password_mismatch",
  })
  .refine((form) => form.password !== form.current, {
    path: ["password"],
    message: "password_same",
  });

export const profileSchema = z.object({ name: accountName, phone: phoneField });

export type RegisterInput = z.output<typeof registerSchema>;
export type ProfileInput = z.output<typeof profileSchema>;

/** The order of the fields on each form, so focus can move to the first one in error. */
export const fieldOrder = {
  register: ["name", "phone", "email", "password"],
  login: ["email", "password"],
  reset: ["email"],
  setPassword: ["password", "confirm"],
  changePassword: ["current", "password", "confirm"],
  profile: ["name", "phone"],
} as const;
