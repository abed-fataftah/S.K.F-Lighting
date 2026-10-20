"use client";

import { useTranslations } from "next-intl";
import { fieldErrorKeys, type FieldError } from "./form-errors";

/** The `Validation.*` message for a field error, with its limits filled in. */
export function useFieldErrorText(): (error: FieldError | undefined) => string | null {
  const t = useTranslations("Validation");
  return (error) => {
    if (!error) return null;
    const key = fieldErrorKeys[error.code];
    if (key === "tooShort") return t(key, { min: error.params?.min ?? 1 });
    if (key === "tooLong") return t(key, { max: error.params?.max ?? 1 });
    return t(key);
  };
}
