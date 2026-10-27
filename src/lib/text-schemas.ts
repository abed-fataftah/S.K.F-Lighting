// Zod helpers for typed text (spec 0005). Number fields clean then validate; free text fields
// tidy then check length (in code points) and then their own rule: Arabic in owner content, or
// a realistic name, place, or address from a customer (spec 0012 AC-1, AC-3, AC-4).
// Shared by the client form and the Server Action, so both give the same answer.
import { z } from "zod";
import { hasArabicLetter, tidyText, toWesternDigits } from "./arabic";

/** Issue messages these schemas raise; each maps to a `Validation.*` message in ar.json. */
export const textErrors = {
  too_short: "tooShort",
  too_long: "tooLong",
  arabic_required: "arabicRequired",
  letters_only: "lettersOnly",
  name_full: "nameFull",
  address_letters: "addressLetters",
  repeated: "repeated",
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
const letterCount = (text: string): number => text.match(/\p{L}/gu)?.length ?? 0;

/** The field's own check after length passes; the first failure it finds, or null. */
type Rule = (text: string) => TextError | null;

function checked(options: TextOptions, rule: Rule) {
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
    } else {
      const error = rule(text);
      if (error) ctx.addIssue({ code: "custom", message: error });
    }
  });
}

function textField(options: TextOptions & { readonly optional?: boolean }, rule: Rule) {
  const multiline = options.multiline ?? false;
  const tidy = (text: string | undefined) => tidyText(text ?? "", { multiline });
  if (options.optional) {
    // Blank after tidying means not filled: no length or rule check.
    return z
      .string()
      .optional()
      .transform((text) => tidy(text) || undefined)
      .pipe(checked(options, rule).optional());
  }
  return z.string().transform(tidy).pipe(checked(options, rule));
}

const anyText: Rule = () => null;
const arabicRule: Rule = (text) => (hasArabicLetter(text) ? null : "arabic_required");

// Letters of any script, combining marks (tashkeel), spaces, hyphens, and apostrophes; a place
// may also hold dots and round brackets (`القدس (الشرقية)`).
const NAME_CHARACTERS = /^[\p{L}\p{M} '’ʼ-]+$/u;
const PLACE_CHARACTERS = /^[\p{L}\p{M} '’ʼ.()-]+$/u;
// One character that is not a digit, five or more times in a row (`ههههه`, `.....`).
const REPEATED_RUN = /([^\p{Nd}])\1{4,}/u;

// Words are split on the single space `tidyText` leaves; a word needs 2 letters, so a lone `'`
// or `اً` (one letter and a mark) does not count.
const nameRule: Rule = (text) => {
  if (!NAME_CHARACTERS.test(text)) return "letters_only";
  const words = text.split(" ").filter((word) => letterCount(word) >= 2);
  return words.length >= 2 ? null : "name_full";
};

const placeRule: Rule = (text) => (PLACE_CHARACTERS.test(text) ? null : "letters_only");

const addressRule: Rule = (text) => {
  if (letterCount(text) < 3) return "address_letters";
  return REPEATED_RUN.test(text) ? "repeated" : null;
};

type Required = TextOptions & { readonly optional?: false };
type Optional = TextOptions & { readonly optional: true };
type RequiredText = z.ZodType<string, string>;
type OptionalText = z.ZodType<string | undefined, string | undefined>;

/** Free text a customer or the owner types (names, addresses, notes): tidied, length checked. */
export function tidiedText(options: Required): RequiredText;
export function tidiedText(options: Optional): OptionalText;
export function tidiedText(options: Required | Optional): RequiredText | OptionalText {
  return textField(options, anyText);
}

/** Owner content that must hold an Arabic letter (product and category names, descriptions). */
export function arabicText(options: Required): RequiredText;
export function arabicText(options: Optional): OptionalText;
export function arabicText(options: Required | Optional): RequiredText | OptionalText {
  return textField(options, arabicRule);
}

/** A person's full name: letters only, at least two words of 2 letters (spec 0012 AC-1). */
export function personName(options: Required): RequiredText {
  return textField(options, nameRule) as RequiredText;
}

/** A city or town: letters, spaces, and simple punctuation, no digits (spec 0012 AC-3). */
export function placeName(options: Required): RequiredText {
  return textField(options, placeRule) as RequiredText;
}

/** A street address: at least 3 letters and no long run of one character (spec 0012 AC-4). */
export function addressText(options: Required): RequiredText {
  return textField(options, addressRule) as RequiredText;
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
