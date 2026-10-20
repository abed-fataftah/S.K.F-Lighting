// Zod helpers for typed text (spec 0005). Number fields clean then validate; free text fields
// tidy then check length (in code points) and, for owner content, that there is Arabic in it.
// Shared by the client form and the Server Action, so both give the same answer.
import { z } from "zod";
import { hasArabicLetter, tidyText, toWesternDigits } from "./arabic";

/** Issue messages these schemas raise; each maps to a `Validation.*` message in ar.json. */
export const textErrors = {
  too_short: "tooShort",
  too_long: "tooLong",
  arabic_required: "arabicRequired",
} as const;

export type TextError = keyof typeof textErrors;

type TextOptions = {
  /** Fewest code points after tidying; a required field needs at least 1. */
  readonly min?: number;
  /** Most code points after tidying. */
  readonly max: number;
  readonly multiline?: boolean;
};

const codePoints = (text: string): number => Array.from(text).length;

function checked(options: TextOptions, requireArabic: boolean) {
  const min = options.min ?? 1;
  return z.string().superRefine((text, ctx) => {
    const length = codePoints(text);
    if (length < min) {
      ctx.addIssue({ code: "custom", message: "too_short" satisfies TextError, params: { min } });
    } else if (length > options.max) {
      ctx.addIssue({
        code: "custom",
        message: "too_long" satisfies TextError,
        params: { max: options.max },
      });
    } else if (requireArabic && !hasArabicLetter(text)) {
      ctx.addIssue({ code: "custom", message: "arabic_required" satisfies TextError });
    }
  });
}

function textField(options: TextOptions & { readonly optional?: boolean }, requireArabic: boolean) {
  const multiline = options.multiline ?? false;
  const tidy = (text: string | undefined) => tidyText(text ?? "", { multiline });
  if (options.optional) {
    // Blank after tidying means not filled: no length or Arabic check.
    return z
      .string()
      .optional()
      .transform((text) => tidy(text) || undefined)
      .pipe(checked(options, requireArabic).optional());
  }
  return z.string().transform(tidy).pipe(checked(options, requireArabic));
}

type Required = TextOptions & { readonly optional?: false };
type Optional = TextOptions & { readonly optional: true };
type RequiredText = z.ZodType<string, string>;
type OptionalText = z.ZodType<string | undefined, string | undefined>;

/** Free text a customer or the owner types (names, addresses, notes): tidied, length checked. */
export function tidiedText(options: Required): RequiredText;
export function tidiedText(options: Optional): OptionalText;
export function tidiedText(options: Required | Optional): RequiredText | OptionalText {
  return textField(options, false);
}

/** Owner content that must hold an Arabic letter (product and category names, descriptions). */
export function arabicText(options: Required): RequiredText;
export function arabicText(options: Optional): OptionalText;
export function arabicText(options: Required | Optional): RequiredText | OptionalText {
  return textField(options, true);
}

/**
 * A number field (phone, price, quantity, code): tidied as one line, Arabic digits made Western,
 * then the field's own step (`prepare`) and its schema.
 */
export function digitsField<P, S extends z.ZodType<unknown, Awaited<P>>>(
  prepare: (clean: string) => P,
  schema: S,
) {
  return z
    .string()
    .transform((text) => prepare(toWesternDigits(tidyText(text))))
    .pipe(schema);
}
