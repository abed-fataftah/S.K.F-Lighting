// Mobile numbers for Palestine (+970) and Israel (+972), stored in E.164 so lookups match
// however the customer typed the number.
import { tidyText, toWesternDigits } from "./arabic";

const SEPARATORS = /[\s\-.()]/g;
const INTERNATIONAL = /^(?:\+|00)(?:970|972)(5\d{8})$/;
const LOCAL = /^0(5\d{8})$/;
// Palestinian networks (Jawwal 059, Ooredoo 056); every other 05 prefix is an Israeli network.
const PALESTINIAN_PREFIXES = ["59", "56"];

/**
 * `"0599 123 456"`, `"+970599123456"`, `"+972599123456"`, and `"00970599123456"` all give
 * `"+970599123456"`; non mobiles give `null`. The network prefix picks the country code, not the
 * code the customer typed, since both codes reach either network. Arabic digits (`٠٥٩٩…`) and a
 * pasted direction mark are cleaned first, so it is safe outside a `digitsField` schema too.
 */
export function normalizePhone(raw: string): string | null {
  const compact = toWesternDigits(tidyText(raw)).replace(SEPARATORS, "");
  const national = (INTERNATIONAL.exec(compact) ?? LOCAL.exec(compact))?.[1];
  if (!national) return null;

  const country = PALESTINIAN_PREFIXES.includes(national.slice(0, 2)) ? "970" : "972";
  return `+${country}${national}`;
}

// A local mobile typed without its leading 0: nine digits.
const NATIONAL_MOBILE = /^5\d{8}$/;

/**
 * A full mobile number typed into a dashboard search (spec 0014 AC-13, spec 0019 AC-3), as E.164,
 * or null. Takes everything `normalizePhone` takes, plus the nine digits without the leading 0.
 * Partial numbers are not a phone.
 */
export function parseSearchPhone(text: string): string | null {
  const clean = toWesternDigits(tidyText(text));
  const compact = clean.replace(SEPARATORS, "");
  return (
    normalizePhone(clean) ?? (NATIONAL_MOBILE.test(compact) ? normalizePhone(`0${compact}`) : null)
  );
}
