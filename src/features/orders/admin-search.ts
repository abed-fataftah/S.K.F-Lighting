// What the owner typed in the orders search (spec 0014 AC-13). Pure: an order number, the short
// form of this year's number, or a phone; anything else is invalid.
import { tidyText, toWesternDigits } from "@/lib/arabic";
import { normalizePhone } from "@/lib/phone";
import { formatOrderNumber, isOrderNumber } from "./order-number";

export type OrderSearch =
  | { readonly kind: "number"; readonly number: string }
  | { readonly kind: "phone"; readonly e164: string }
  | { readonly kind: "invalid" };

const SHORT_FORM = /^\d{1,7}$/;
// A local mobile typed without its leading 0: nine digits, so never a short form.
const NATIONAL_MOBILE = /^5\d{8}$/;
const SEPARATORS = /[\s\-.()]/g;

/** `year` is the shop year on this request, naming the short form's series. */
export function classifyOrderSearch(text: string, year: number): OrderSearch {
  const clean = toWesternDigits(tidyText(text));
  if (isOrderNumber(clean)) return { kind: "number", number: clean };
  if (SHORT_FORM.test(clean)) {
    const seq = Number(clean);
    return seq >= 1
      ? { kind: "number", number: formatOrderNumber(year, seq) }
      : { kind: "invalid" };
  }
  const compact = clean.replace(SEPARATORS, "");
  const e164 =
    normalizePhone(clean) ?? (NATIONAL_MOBILE.test(compact) ? normalizePhone(`0${compact}`) : null);
  return e164 ? { kind: "phone", e164 } : { kind: "invalid" };
}
