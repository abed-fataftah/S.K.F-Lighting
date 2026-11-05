// Arabic text rules (spec 0005): typed digits, tidying text before it is saved, the Arabic letter
// check for owner content, and the folding search uses. Pure string functions, no side effects.
// The only file in src/ allowed to hold Arabic Indic or Persian digits (src/language-rules.test.ts).
//
// No regex here carries the `g` flag where it could be shared: a `/g` regex keeps `lastIndex`
// between `.test()` calls. `.replace()` resets it, so the private `/g` ones below are safe.

/** Tashkeel (harakat, tanween, shadda, sukun, and the Quranic marks), as a character class body. */
export const ARABIC_MARKS_SOURCE = "\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED";

const TATWEEL = "\\u0640";
const MARKS_AND_TATWEEL = new RegExp(`[${ARABIC_MARKS_SOURCE}${TATWEEL}]`, "g");

/** Drops tashkeel and tatweel: `ثُرَيّـا` becomes `ثريا`. */
export function stripArabicMarks(text: string): string {
  return text.replace(MARKS_AND_TATWEEL, "");
}

const EASTERN_DIGITS = /[٠-٩۰-۹٫٬]/g;

function westernDigit(char: string): string {
  if (char === "٫") return ".";
  if (char === "٬") return ",";
  const code = char.charCodeAt(0);
  return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
}

/** `٠٥٩٩` and `۰۵۹۹` become `0599`; `٫` becomes `.` and `٬` becomes `,`. Everything else stays. */
export function toWesternDigits(text: string): string {
  return text.replace(EASTERN_DIGITS, westernDigit);
}

// Soft hyphen, ALM, ZWSP, LRM, RLM, the embeddings and overrides, word joiner, isolates, BOM.
// ZWNJ (U+200C) and ZWJ (U+200D) stay, so emoji sequences survive.
const INVISIBLE = /[\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
// Control characters except tab and newline (carriage returns are already newlines).
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
const SPACE_LIKE = /[\t\p{Zs}]/gu;
const LINE_SEPARATORS = /[\u2028\u2029]/g;
const SPACE_RUNS = / {2,}/g;

/**
 * Tidies typed text before its length and content checks (AC-10): one kind of newline, NFC, no
 * tatweel, no invisible or control characters, plain single spaces, trimmed lines and ends.
 * Single line text joins its lines with a space; multi line text keeps at most one empty line in
 * a row. Idempotent. `"  ثريـــا   كريستال\u200f "` becomes `ثريا كريستال`.
 */
export function tidyText(
  text: string,
  { multiline = false }: { multiline?: boolean } = {},
): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .replace(/ـ/g, "")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .replace(SPACE_LIKE, " ")
    .replace(LINE_SEPARATORS, "\n")
    // Removing a character can leave a letter and its combining mark side by side: compose again.
    .normalize("NFC")
    .split("\n")
    .map((line) => line.replace(SPACE_RUNS, " ").replace(/^ | $/g, ""));

  if (!multiline) return lines.filter((line) => line !== "").join(" ");
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

// A character in the Arabic script that is also a letter: not tatweel (its script is Common),
// digits, or punctuation. The lookahead does what `[A&&B]` with the `v` flag would, within the
// ES2017 target.
const ARABIC_LETTER = /(?=\p{Script=Arabic})\p{L}/u;

/** True when the text holds at least one Arabic letter (Persian, Urdu, and presentation forms count). */
export function hasArabicLetter(text: string): boolean {
  return ARABIC_LETTER.test(text);
}

// Isolated and medial presentation forms of tashkeel (U+FE70 to U+FE7F) and the shadda ligatures
// (U+FC5E to U+FC63): NFKC turns them into a space or tatweel plus a mark, so drop them first.
const MARK_PRESENTATION_FORMS = /[ﱞ-ﱣﹰ-ﹿ]/g;
const HAMZA_ALEF = /[أإآٱ]/g;
const WHITESPACE_RUNS = /\s+/g;

/**
 * The search key (AC-12): forgiving of tashkeel, hamza seats, ta marbuta, alef maqsura, the
 * Persian yeh and keheh (spec 0010 AC-2), Arabic digits, and case. Run it on the query and on the
 * product text, then compare. Idempotent.
 */
export function normalizeForSearch(text: string): string {
  return toWesternDigits(
    stripArabicMarks(tidyText(text).replace(MARK_PRESENTATION_FORMS, "").normalize("NFKC"))
      .replace(HAMZA_ALEF, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ی/g, "ي")
      .replace(/ک/g, "ك"),
  )
    .toLowerCase()
    .replace(WHITESPACE_RUNS, " ")
    .trim();
}
