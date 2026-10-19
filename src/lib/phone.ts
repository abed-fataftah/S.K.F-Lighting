// Mobile numbers for Palestine (+970) and Israel (+972), stored in E.164 so lookups match
// however the customer typed the number.

const SEPARATORS = /[\s\-.()]/g;
const INTERNATIONAL = /^(?:\+|00)(?:970|972)(5\d{8})$/;
const LOCAL = /^0(5\d{8})$/;
// Palestinian networks (Jawwal 059, Ooredoo 056); every other 05 prefix is an Israeli network.
const PALESTINIAN_PREFIXES = ["59", "56"];

/**
 * `"0599 123 456"`, `"+970599123456"`, `"+972599123456"`, and `"00970599123456"` all give
 * `"+970599123456"`; non mobiles give `null`. The network prefix picks the country code, not the
 * code the customer typed, since both codes reach either network.
 */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(SEPARATORS, "");
  const national = (INTERNATIONAL.exec(compact) ?? LOCAL.exec(compact))?.[1];
  if (!national) return null;

  const country = PALESTINIAN_PREFIXES.includes(national.slice(0, 2)) ? "970" : "972";
  return `+${country}${national}`;
}
