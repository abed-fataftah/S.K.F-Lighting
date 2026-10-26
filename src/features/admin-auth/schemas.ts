// The dashboard sign in forms (spec 0004 AC-1), shared by the forms and their Server Actions.
import { z } from "zod";
import { digitsField } from "@/lib/text-schemas";

const nextField = z
  .string()
  .optional()
  .transform((value) => value || undefined);

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "required")
    .pipe(z.email({ error: "email_invalid" })),
  // Not trimmed: a password may start or end with a space. Supabase Auth checks it.
  password: z.string().min(1, "required"),
  next: nextField,
});

export type SignInInput = z.output<typeof signInSchema>;

/** Six digits from the authenticator app; Arabic digits and spaces (`١٢٣ ٤٥٦`) are accepted. */
export const totpCodeField = digitsField(
  (clean) => clean.replace(/\s+/g, ""),
  z
    .string()
    .min(1, "required")
    .regex(/^\d{6}$/, "totp_format"),
);

export const verifyTotpSchema = z.object({
  factorId: z.guid(),
  code: totpCodeField,
  next: nextField,
});

export type VerifyTotpInput = z.output<typeof verifyTotpSchema>;

/**
 * Supabase returns the QR code either as a `data:` URL or as bare SVG markup, depending on the
 * Auth version; an <img> needs the URL.
 */
export function qrImageSrc(qrCode: string): string {
  return qrCode.startsWith("data:")
    ? qrCode
    : `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
}
