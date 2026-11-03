// What the owner typed in the customers search (spec 0019 AC-3). Pure: an email, a full phone, or
// a name; digits that are not a full phone are never a name search.
import { normalizeForSearch, tidyText, toWesternDigits } from "@/lib/arabic";
import { parseSearchPhone } from "@/lib/phone";

export type CustomerSearch =
  | { readonly kind: "email"; readonly text: string }
  | { readonly kind: "phone"; readonly e164: string }
  | { readonly kind: "name"; readonly folded: string }
  | { readonly kind: "invalid" };

const LETTER = /\p{L}/u;
/** A name search needs this many folded characters, so one letter never lists everyone. */
const NAME_MIN = 2;

export function classifyCustomerSearch(text: string): CustomerSearch {
  const clean = toWesternDigits(tidyText(text));
  if (clean.includes("@")) return { kind: "email", text: clean.toLowerCase() };
  const e164 = parseSearchPhone(clean);
  if (e164) return { kind: "phone", e164 };
  if (!LETTER.test(clean)) return { kind: "invalid" };
  const folded = normalizeForSearch(clean);
  return Array.from(folded).length >= NAME_MIN ? { kind: "name", folded } : { kind: "invalid" };
}
