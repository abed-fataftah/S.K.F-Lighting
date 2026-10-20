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

/** Set once when a product is created and never regenerated on rename, so shared links keep working. */
export function buildProductSlug(name: string, code: string): string {
  const base = slugify(name);
  return base ? `${base}-${code}` : code;
}
