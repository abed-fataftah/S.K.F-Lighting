// Field errors a form shows (spec 0004 AC-6, AC-2). Schemas raise these codes as issue messages;
// the action sends `{ field: { code, params } }` back and the form looks the code up in
// `Validation.*` (ar.json). Values typed by the customer never travel in an error.
import type { z } from "zod";
import { textErrors } from "./text-schemas";

export const fieldErrorKeys = {
  ...textErrors,
  required: "required",
  invalid: "invalid",
  phone_mobile: "phoneMobile",
  price_invalid: "priceInvalid",
  code_invalid: "codeInvalid",
  code_taken: "codeTaken",
  category_required: "categoryRequired",
  name_taken: "nameTaken",
  duplicate: "duplicate",
  zone_required: "zoneRequired",
  email_invalid: "emailInvalid",
  totp_format: "totpFormat",
} as const;

export type FieldErrorCode = keyof typeof fieldErrorKeys;

export type FieldError = {
  readonly code: FieldErrorCode;
  readonly params?: Readonly<Record<string, number>>;
};

export type FieldErrors = Readonly<Record<string, FieldError>>;

const isCode = (message: string): message is FieldErrorCode => message in fieldErrorKeys;

function numericParams(params: unknown): Readonly<Record<string, number>> | undefined {
  if (!params || typeof params !== "object") return undefined;
  const entries = Object.entries(params).filter(([, value]) => typeof value === "number");
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * The first issue per field, as a code (a missing or wrong typed value is `required`). A field is
 * its full path, so a row inside a list reads `sizes.1.label`; a flat form's keys are its names.
 */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return error.issues.reduce<Record<string, FieldError>>((errors, issue) => {
    const field = issue.path.length ? issue.path.map(String).join(".") : "form";
    if (errors[field]) return errors;
    const code: FieldErrorCode = isCode(issue.message)
      ? issue.message
      : issue.code === "invalid_type"
        ? "required"
        : "invalid";
    const params = issue.code === "custom" ? numericParams(issue.params) : undefined;
    return { ...errors, [field]: params ? { code, params } : { code } };
  }, {});
}

/** Plain string values of a submitted form; files and repeated keys are not used here. */
export function formValues(formData: FormData): Readonly<Record<string, string>> {
  return Object.fromEntries(
    [...formData.entries()].flatMap(([key, value]) =>
      typeof value === "string" && !key.startsWith("$") ? [[key, value]] : [],
    ),
  );
}
