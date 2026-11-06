// The short description search engines and link previews show (spec 0009 AC-15, spec 0026 AC-10):
// whitespace collapsed, cut to 155 code points.

const SUMMARY_LENGTH = 155;

/** The text with whitespace collapsed, cut to 155 code points; null when there is none. */
export function summarize(text: string | null): string | null {
  const collapsed = (text ?? "").replace(/\s+/g, " ").trim();
  return collapsed ? Array.from(collapsed).slice(0, SUMMARY_LENGTH).join("") : null;
}

/**
 * A policy body as plain words (AC-10): headings, quotes, list marks, rules, emphasis, and code
 * marks go, a link or image keeps only its text. Whitespace is left for `summarize`.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/^[ \t]*([-*_])([ \t]*\1){2,}[ \t]*$/gm, "")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/([*_])(.+?)\1/g, "$2")
    .replace(/`+([^`]*)`+/g, "$1");
}
