// URL slugs that keep the Arabic name readable, for example `ثريا-كريستال-CH-1020`.
import { stripArabicMarks } from "@/lib/arabic";

const KEPT = /[\p{Script=Arabic}\p{Script=Latin}0-9]/u;
const LETTER_OR_DIGIT = /[\p{L}\p{Nd}]/u;

const isKept = (char: string): boolean => KEPT.test(char) && LETTER_OR_DIGIT.test(char);

/** The cleaned name part shared by product and category slugs. Category actions append `-2`, `-3` on a clash. */
export function slugify(name: string): string {
  return Array.from(stripArabicMarks(name))
    .map((char) => (isKept(char) ? char.toLowerCase() : "-"))
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** `base`, or `base-2`, `base-3`, … : the first one not in `taken` (category slugs, spec 0004 AC-2). */
export function nextFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Set once when a product is created and never regenerated on rename, so shared links keep working. */
export function buildProductSlug(name: string, code: string): string {
  const base = slugify(name);
  return base ? `${base}-${code}` : code;
}
