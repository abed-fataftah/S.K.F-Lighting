"use client";

import { useTranslations } from "next-intl";
import { fieldErrorKeys, type FieldError } from "./form-errors";
import { formatNumber } from "./format";

type ValidationKey = (typeof fieldErrorKeys)[keyof typeof fieldErrorKeys];

/** The `Validation.*` message for a field error; limits arrive preformatted (spec 0005 AC-7, AC-13). */
export function fieldErrorText(
  t: (key: ValidationKey, values?: Record<string, string>) => string,
  error: FieldError | undefined,
): string | null {
  if (!error) return null;
  const key = fieldErrorKeys[error.code];
  if (key === "tooShort") return t(key, { min: formatNumber(error.params?.min ?? 1) });
  if (key === "tooLong") return t(key, { max: formatNumber(error.params?.max ?? 1) });
  return t(key);
}

/** The `Validation.*` message for a field error, with its limits filled in. */
export function useFieldErrorText(): (error: FieldError | undefined) => string | null {
  const t = useTranslations("Validation");
  return (error) => fieldErrorText((key, values) => t(key, values), error);
}
